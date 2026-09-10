#!/usr/bin/env python3
"""
JDIH Mahkamah Agung RI — Playwright Scraper
Menggunakan browser headless (Chromium) untuk melewati Cloudflare challenge.

Install sekali:
    pip install playwright
    playwright install chromium

Jalankan:
    python jdih_ma_playwright.py --output-json ma_peraturan.json
    python jdih_ma_playwright.py --no-pdf --max-pages 5 --output-json ma_peraturan.json
"""

import argparse
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [MA] %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("jdih_ma_playwright.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

BASE_URL  = "https://jdih.mahkamahagung.go.id"
LIST_URL  = BASE_URL + "/dokumen"
SOURCE    = "jdih.mahkamahagung.go.id"

BULAN_ID = {
    "januari":"01","februari":"02","maret":"03","april":"04",
    "mei":"05","juni":"06","juli":"07","agustus":"08",
    "september":"09","oktober":"10","november":"11","desember":"12",
}

CATEGORY_PREFIX = {
    "peraturan mahkamah agung": "PERMA",
    "perma": "PERMA",
    "surat edaran mahkamah agung": "SEMA",
    "sema": "SEMA",
    "keputusan ketua mahkamah agung": "SK-KMA",
    "keputusan mahkamah agung": "SK-MA",
    "keputusan": "SK-MA",
    "instruksi": "INSTR-MA",
    "undang-undang": "UU",
    "peraturan pemerintah": "PP",
    "peraturan presiden": "PERPRES",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", raw)
    if m:
        mon = BULAN_ID.get(m.group(2).lower())
        if mon:
            return f"{m.group(3)}-{mon}-{m.group(1).zfill(2)}"
    m2 = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m2:
        return raw[:10]
    m3 = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if m3:
        return f"{m3.group(3)}-{m3.group(2).zfill(2)}-{m3.group(1).zfill(2)}"
    return None


def make_rule_code(category: str, nomor: str, tahun: str, idx: int) -> str:
    prefix = "MA"
    for key, pfx in CATEGORY_PREFIX.items():
        if key in (category or "").lower():
            prefix = pfx
            break
    clean_n = re.sub(r"[^A-Za-z0-9]", "", nomor) if nomor else str(idx)
    clean_y = re.sub(r"[^0-9]", "", tahun)[:4] if tahun else ""
    return f"{prefix}-{clean_n}-{clean_y}" if clean_y else f"{prefix}-{clean_n or str(idx)}"


def extract_nomor_tahun(text: str) -> Tuple[str, str]:
    m = re.search(r"[Nn]omor\s+(\d+[A-Za-z]?)\s+[Tt]ahun\s+(\d{4})", text)
    if m:
        return m.group(1), m.group(2)
    m2 = re.search(r"[Nn]o\.?\s*(\d+[A-Za-z]?).*?(\d{4})", text)
    if m2:
        return m2.group(1), m2.group(2)
    m3 = re.search(r"(20\d{2}|19\d{2})", text)
    return "", m3.group(1) if m3 else ""


def build_item(title, category, nomor, tahun, date_raw, pdf_url, idx) -> Dict:
    return {
        "rule_code":         make_rule_code(category, nomor, tahun, idx),
        "title":             title[:500],
        "category":          category or "Peraturan MA",
        "regime":            "Nasional",
        "publish_date":      parse_date(date_raw),
        "pdf_url":           pdf_url or None,
        "source":            SOURCE,
        "is_active":         True,
        "processed_at":      datetime.now().isoformat(),
        "processed_by":      "scraper-jdih-ma-playwright",
        "processing_method": "scrape",
        "scraped_at":        datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Network-request interceptor helper
# ---------------------------------------------------------------------------

def intercept_api_response(page) -> Optional[dict]:
    """
    Intercept XHR/fetch responses that look like JSON API responses
    while the page loads. Returns the first JSON payload found.
    """
    captured = {}

    def on_response(response):
        ct = response.headers.get("content-type", "")
        if "json" in ct and response.status == 200:
            try:
                data = response.json()
                if isinstance(data, (dict, list)) and data:
                    captured["data"] = data
                    captured["url"]  = response.url
            except Exception:
                pass

    page.on("response", on_response)
    return captured


# ---------------------------------------------------------------------------
# Parse HTML from loaded page
# ---------------------------------------------------------------------------

def parse_page_html(html: str, page_num: int) -> Tuple[List[Dict], bool]:
    from bs4 import BeautifulSoup

    soup  = BeautifulSoup(html, "html.parser")
    items = []

    # === MA-SPECIFIC PARSING ===
    # From live test, MA page renders document cards with this text pattern:
    #   "23 Juni 2026  5.9K x dilihat  2.1K x diunduh
    #    PERMA NOMOR 3 TAHUN 2026
    #    Peraturan Mahkamah Agung Republik Indonesia Nomor 3 Tahun 2026 tentang ..."
    # The full document titles are inside <a> links to /dokumen/...

    # Strategy 1: find all <a> tags whose text contains "Nomor X Tahun YYYY tentang"
    seen_titles = set()
    for a in soup.find_all("a", href=True):
        text  = a.get_text(strip=True)
        href  = a["href"]

        # Must look like a document title
        if not re.search(r"[Nn]omor\s+\d+.*?[Tt]ahun\s+\d{4}", text):
            continue
        if len(text) < 20:
            continue
        if text in seen_titles:
            continue
        seen_titles.add(text)

        # Build absolute URL
        doc_url = href if href.startswith("http") else BASE_URL + href

        # Look for date and category in surrounding container
        date_raw = ""
        category = "Peraturan MA"
        container = a.parent
        for _ in range(6):
            if container is None:
                break
            ctext = container.get_text(" ", strip=True)
            # Find date in container
            dm = re.search(r"(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})", ctext, re.I)
            if dm and not date_raw:
                date_raw = dm.group(1)
            # Find category badge text like "PERMA NOMOR" or "SEMA NOMOR"
            bm = re.search(r"\b(PERMA|SEMA|SK-KMA|SK-MA|INSTR|KMA)\s+NOMOR", ctext, re.I)
            if bm:
                category = bm.group(1).upper()
                break
            container = container.parent

        # If category not found in container, infer from title
        if category == "Peraturan MA":
            tl = text.lower()
            if "surat edaran" in tl:
                category = "SEMA"
            elif "keputusan ketua" in tl:
                category = "SK-KMA"
            elif "keputusan" in tl:
                category = "SK-MA"
            elif "instruksi" in tl:
                category = "INSTR"

        # PDF url: if the link itself is a PDF use it, else it's a detail page
        pdf_url = doc_url if ".pdf" in doc_url.lower() else ""

        n, y = extract_nomor_tahun(text)
        items.append(build_item(text, category, n, y, date_raw, pdf_url, len(items)))

    # --- Fallback: table rows ---
    if not items:
        table = soup.find("table")
        if table:
            rows    = table.find_all("tr")
            headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th","td"])] if rows else []
            col = {}
            for ci, h in enumerate(headers):
                if any(k in h for k in ("nomor","no.")):       col["nomor"] = ci
                elif any(k in h for k in ("judul","tentang")): col["title"] = ci
                elif any(k in h for k in ("tanggal","tahun")): col["date"]  = ci
                elif any(k in h for k in ("jenis","kategori")): col["cat"] = ci
                elif any(k in h for k in ("pdf","file","download")): col["pdf"] = ci

            for ri, row in enumerate(rows[1:], 1):
                tds = row.find_all("td")
                if len(tds) < 2:
                    continue
                try:
                    nomor    = tds[col.get("nomor",0)].get_text(strip=True) if "nomor" in col else ""
                    title_td = tds[col.get("title",1)]
                    title    = title_td.get_text(strip=True)
                    date_raw = tds[col["date"]].get_text(strip=True) if "date" in col and len(tds) > col["date"] else ""
                    category = tds[col["cat"]].get_text(strip=True)  if "cat"  in col and len(tds) > col["cat"]  else "Peraturan MA"
                    pdf_url  = ""
                    if "pdf" in col and len(tds) > col["pdf"]:
                        a = tds[col["pdf"]].find("a", href=True)
                        if a:
                            href = a["href"]
                            pdf_url = href if href.startswith("http") else BASE_URL + href
                    if not pdf_url:
                        for a in title_td.find_all("a", href=True):
                            if ".pdf" in a["href"].lower():
                                href = a["href"]
                                pdf_url = href if href.startswith("http") else BASE_URL + href
                                break
                    if not title:
                        continue
                    n, y = extract_nomor_tahun(nomor + " " + title)
                    items.append(build_item(title, category, n, y, date_raw, pdf_url, len(items)))
                except Exception as e:
                    logger.debug(f"Row {ri} error: {e}")

    has_next = _has_next(soup, page_num)
    logger.info(f"  Halaman {page_num}: {len(items)} item parsed, has_next={has_next}")
    return items, has_next


def _has_next(soup, current: int) -> bool:
    for a in soup.find_all("a", href=True):
        t = a.get_text(strip=True).lower()
        if t in ("next", ">", "»", "selanjutnya", "berikutnya"):
            return True
        m = re.search(r"[?&/](?:page|hal|p)=(\d+)", a["href"])
        if m and int(m.group(1)) > current:
            return True
    return False


# ---------------------------------------------------------------------------
# Main scraper
# ---------------------------------------------------------------------------

def scrape(output_dir: str = "./pdf_raw", download_pdf: bool = True,
           rate: float = 2.0, max_pages: int = 0,
           headless: bool = True) -> List[Dict]:

    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    all_results: List[Dict] = []
    seen_codes:  set        = set()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ],
        )
        context = browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="id-ID",
            timezone_id="Asia/Jakarta",
            extra_http_headers={
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            },
        )
        # Hide webdriver flag
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        page = context.new_page()

        # ---- intercept JSON API responses ----
        api_captured: List[dict] = []

        def on_response(response):
            try:
                ct  = response.headers.get("content-type", "")
                url = response.url
                if response.status == 200 and "json" in ct:
                    data = response.json()
                    if isinstance(data, (dict, list)) and data:
                        api_captured.append({"url": url, "data": data})
                        logger.info(f"  [intercept] JSON API: {url} ({type(data).__name__})")
            except Exception:
                pass

        page.on("response", on_response)

        # ---- Step 1: visit homepage first to pass Cloudflare ----
        logger.info("Membuka halaman utama untuk mendapat cookie Cloudflare…")
        try:
            page.goto(BASE_URL + "/", wait_until="domcontentloaded", timeout=25000)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except PWTimeout:
                pass
            time.sleep(2)
        except PWTimeout:
            logger.warning("Homepage timeout, lanjut ke list page")

        # ---- Step 2: navigate to document list ----
        logger.info(f"Navigasi ke {LIST_URL}")
        try:
            page.goto(LIST_URL, wait_until="domcontentloaded", timeout=40000)
            # Wait for actual document cards to render (MA renders via JS)
            # Try multiple selectors that might indicate rendered content
            for selector in [
                "text=NOMOR",
                "text=Peraturan Mahkamah Agung",
                "a[href*='/dokumen/']",
                "[class*='card']",
                "[class*='dokumen']",
                "[class*='list']",
                "table tr:nth-child(2)",
            ]:
                try:
                    page.wait_for_selector(selector, timeout=8000)
                    logger.info(f"Content loaded (matched: {selector})")
                    break
                except PWTimeout:
                    continue
            time.sleep(3)  # extra wait for full JS render
        except PWTimeout:
            logger.warning("List page domcontentloaded timeout — parsing whatever is available")

        # ---- Step 3: check for Cloudflare challenge ----
        title_text = page.title().lower()
        if "just a moment" in title_text or "challenge" in title_text:
            logger.info("Cloudflare challenge terdeteksi, tunggu 10 detik…")
            time.sleep(10)
            try:
                page.wait_for_load_state("networkidle", timeout=20000)
            except PWTimeout:
                pass

        # ---- Step 4: check if API JSON was captured during load ----
        if api_captured:
            logger.info(f"API JSON dicapture selama load: {len(api_captured)} response(s)")
            for cap in api_captured:
                data = cap["data"]
                items_raw = (
                    data.get("data") or data.get("results") or data.get("items") or
                    (data if isinstance(data, list) else [])
                )
                for i, item in enumerate(items_raw):
                    if not isinstance(item, dict):
                        continue
                    title    = (item.get("title") or item.get("judul") or "").strip()
                    nomor    = (item.get("nomor") or item.get("number") or "").strip()
                    tahun    = (item.get("tahun") or item.get("year") or "").strip()
                    category = (item.get("jenis") or item.get("type") or item.get("kategori") or "Peraturan MA").strip()
                    date_raw = (item.get("tanggal") or item.get("date") or "").strip()
                    pdf_url  = (item.get("file_url") or item.get("fileUrl") or item.get("pdf_url") or "").strip()
                    if pdf_url and not pdf_url.startswith("http"):
                        pdf_url = BASE_URL + pdf_url
                    if not title:
                        continue
                    n, y = extract_nomor_tahun(nomor + " " + title)
                    if nomor: n = nomor
                    if tahun: y = tahun
                    item_obj = build_item(title, category, n, y, date_raw, pdf_url, len(all_results) + i)
                    code = item_obj["rule_code"]
                    if code not in seen_codes:
                        seen_codes.add(code)
                        all_results.append(item_obj)

            if all_results:
                logger.info(f"API mode: {len(all_results)} item dari JSON responses")
                # Try to get more pages via API
                if api_captured:
                    first_api_url = api_captured[0]["url"]
                    first_data    = api_captured[0]["data"]
                    total = (
                        first_data.get("total") or first_data.get("totalCount") or
                        first_data.get("recordsTotal") or 0
                    )
                    logger.info(f"Total records menurut API: {total}")

        # ---- Step 5: HTML scraping ----
        page_num = 1
        while True:
            html = page.content()
            items, has_next = parse_page_html(html, page_num)

            new = 0
            for item in items:
                code = item["rule_code"]
                if code not in seen_codes:
                    seen_codes.add(code)
                    all_results.append(item)
                    new += 1

            logger.info(f"Halaman {page_num}: {new} item baru (total={len(all_results)})")

            if new == 0 and page_num > 1:
                logger.info("Tidak ada item baru lagi, selesai")
                break

            if not has_next:
                logger.info("Tidak ada halaman berikutnya")
                break
            if max_pages and page_num >= max_pages:
                logger.info(f"Batas {max_pages} halaman tercapai")
                break

            # Navigate to next page — use longer wait + fallback to domcontentloaded
            page_num += 1
            next_url = LIST_URL + f"?page={page_num}"
            logger.info(f"Navigasi ke halaman {page_num}: {next_url}")
            try:
                page.goto(next_url, wait_until="domcontentloaded", timeout=40000)
                # Wait for document cards to appear
                try:
                    page.wait_for_selector(
                        "a[href*='dokumen'], a[href*='peraturan'], div.card, article",
                        timeout=15000
                    )
                except PWTimeout:
                    pass
                time.sleep(rate)
            except PWTimeout:
                logger.warning(f"Timeout halaman {page_num}, mencoba domcontentloaded...")
                try:
                    page.goto(next_url, wait_until="commit", timeout=20000)
                    time.sleep(rate + 2)
                except PWTimeout:
                    logger.warning(f"Halaman {page_num} tidak bisa diakses, berhenti")
                    break

        # ---- Download PDFs ----
        if download_pdf:
            _download_pdfs(all_results, output_path, page, context)

        browser.close()

    logger.info(f"Scraping MA selesai. Total: {len(all_results)} dokumen")
    return all_results


def _download_pdfs(results: List[Dict], output_path: Path, page, context):
    import requests as req
    for item in results:
        url = item.get("pdf_url")
        if not url:
            continue
        try:
            fname = re.sub(r"[^\w\-.]", "_", url.split("/")[-1].split("?")[0]) or "unnamed.pdf"
            fpath = output_path / fname
            if fpath.exists() and fpath.stat().st_size > 1024:
                continue
            # Use requests with cookies from playwright context
            cookies = {c["name"]: c["value"] for c in context.cookies()}
            r = req.get(url, cookies=cookies, timeout=60, stream=True,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
            r.raise_for_status()
            if "pdf" not in r.headers.get("content-type", "").lower() and not url.lower().endswith(".pdf"):
                continue
            with open(fpath, "wb") as f:
                for chunk in r.iter_content(8192):
                    f.write(chunk)
            logger.info(f"PDF: {fpath.name}")
            time.sleep(0.5)
        except Exception as e:
            logger.error(f"PDF error {url}: {e}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="JDIH Mahkamah Agung — Playwright Scraper (bypass Cloudflare)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--output-json", default="ma_peraturan.json")
    parser.add_argument("--output-dir",  default="./pdf_raw")
    parser.add_argument("--no-pdf",      action="store_true")
    parser.add_argument("--rate",        type=float, default=2.0,
                        help="Jeda antar halaman (detik)")
    parser.add_argument("--max-pages",   type=int,   default=0,
                        help="Batas halaman (0=semua)")
    parser.add_argument("--show-browser", action="store_true",
                        help="Tampilkan browser (non-headless, berguna untuk debug)")
    args = parser.parse_args()

    results = scrape(
        output_dir   = args.output_dir,
        download_pdf = not args.no_pdf,
        rate         = args.rate,
        max_pages    = args.max_pages,
        headless     = not args.show_browser,
    )

    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nSelesai. {len(results)} dokumen → {args.output_json}")
    if not results:
        print("PERINGATAN: 0 dokumen. Coba --show-browser untuk melihat apa yang terjadi.")


if __name__ == "__main__":
    main()
