#!/usr/bin/env python3
"""
JDIH Mahkamah Konstitusi RI — Playwright Scraper
Menggunakan browser headless (Chromium) untuk melewati Cloudflare challenge.

Install sekali:
    pip install playwright
    playwright install chromium

Jalankan:
    python jdih_mk_playwright.py --output-json mk_peraturan.json
    python jdih_mk_playwright.py --no-pdf --max-pages 10 --output-json mk_peraturan.json
    python jdih_mk_playwright.py --show-browser   # debug mode
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
    format="%(asctime)s [MK] %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("jdih_mk_playwright.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

BASE_URL = "https://jdih.mkri.id"
SOURCE   = "jdih.mkri.id"

# URL kandidat untuk halaman list produk hukum MK
LIST_URLS = [
    BASE_URL + "/produk-hukum",
    BASE_URL + "/index.php/peraturan",
    BASE_URL + "/peraturan",
    BASE_URL + "/regulasi",
    BASE_URL,
]

BULAN_ID = {
    "januari":"01","februari":"02","maret":"03","april":"04",
    "mei":"05","juni":"06","juli":"07","agustus":"08",
    "september":"09","oktober":"10","november":"11","desember":"12",
}

CATEGORY_PREFIX = {
    "peraturan mahkamah konstitusi": "PMK",
    "pmk": "PMK",
    "keputusan mahkamah konstitusi": "SK-MK",
    "keputusan ketua": "SK-MK",
    "surat edaran": "SE-MK",
    "undang-undang dasar": "UUD",
    "undang-undang": "UU",
    "peraturan pemerintah pengganti": "PERPU",
    "putusan": "PUTUSAN-MK",
    "risalah": "RISALAH-MK",
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
    m4 = re.match(r"^(\d{4})$", raw.strip())
    if m4:
        return f"{m4.group(1)}-01-01"
    return None


def make_rule_code(category: str, nomor: str, tahun: str, idx: int) -> str:
    prefix = "MK"
    for key, pfx in CATEGORY_PREFIX.items():
        if key in (category or "").lower():
            prefix = pfx
            break
    clean_n = re.sub(r"[^A-Za-z0-9]", "", nomor) if nomor else str(idx)
    clean_y = re.sub(r"[^0-9]", "", tahun)[:4] if tahun else ""
    return f"{prefix}-{clean_n}-{clean_y}" if clean_y else f"{prefix}-{clean_n or str(idx)}"


def extract_nomor_tahun(text: str) -> Tuple[str, str]:
    m = re.search(r"[Nn]omor\s+(\d+[A-Za-z]?(?:/[A-Z]+)?)\s+[Tt]ahun\s+(\d{4})", text)
    if m:
        return m.group(1), m.group(2)
    m2 = re.search(r"[Nn]o\.?\s*(\d+[A-Za-z]?).*?Tahun\s+(\d{4})", text)
    if m2:
        return m2.group(1), m2.group(2)
    m3 = re.search(r"(20\d{2}|19\d{2})", text)
    return "", m3.group(1) if m3 else ""


def build_item(title, category, nomor, tahun, date_raw, pdf_url, idx) -> Dict:
    return {
        "rule_code":         make_rule_code(category, nomor, tahun, idx),
        "title":             title[:500],
        "category":          category or "Peraturan MK",
        "regime":            "Nasional",
        "publish_date":      parse_date(date_raw),
        "pdf_url":           pdf_url or None,
        "source":            SOURCE,
        "is_active":         True,
        "processed_at":      datetime.now().isoformat(),
        "processed_by":      "scraper-jdih-mk-playwright",
        "processing_method": "scrape",
        "scraped_at":        datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# HTML parser
# ---------------------------------------------------------------------------

def parse_page_html(html: str, page_num: int) -> Tuple[List[Dict], bool]:
    from bs4 import BeautifulSoup
    soup  = BeautifulSoup(html, "html.parser")
    items = []

    # ---- Tabel ----
    table = soup.find("table")
    if table:
        rows    = table.find_all("tr")
        headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th","td"])] if rows else []
        col = {}
        for ci, h in enumerate(headers):
            if any(k in h for k in ("nomor","no.")):        col["nomor"] = ci
            elif any(k in h for k in ("judul","tentang")):  col["title"] = ci
            elif any(k in h for k in ("tanggal","tahun")):  col["date"]  = ci
            elif any(k in h for k in ("jenis","kategori")): col["cat"]   = ci
            elif any(k in h for k in ("pdf","file","dl")):  col["pdf"]   = ci

        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 2:
                continue
            try:
                nomor    = tds[col.get("nomor",0)].get_text(strip=True) if "nomor" in col else ""
                title_td = tds[col.get("title",1)]
                title    = title_td.get_text(strip=True)
                date_raw = tds[col["date"]].get_text(strip=True) if "date" in col and len(tds) > col["date"] else ""
                category = tds[col["cat"]].get_text(strip=True)  if "cat"  in col and len(tds) > col["cat"]  else "Peraturan MK"
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
                logger.debug(f"Row error: {e}")

    # ---- Cards ----
    if not items:
        for sel in ["div.card", "div.item-hukum", "div.produk-hukum",
                    "div.peraturan-item", "li.regulation", "article"]:
            cards = soup.select(sel)
            for ci, card in enumerate(cards):
                try:
                    tel  = (card.find(["h2","h3","h4","h5","strong"]) or
                            card.find(class_=re.compile(r"title|judul", re.I)))
                    title = tel.get_text(strip=True) if tel else card.get_text(" ", strip=True)[:200]
                    if not title or len(title) < 5:
                        continue
                    if not re.search(r"[Tt]ahun\s+\d{4}|[Nn]omor\s+\d+|[Nn]o\.?\s*\d+", title):
                        continue
                    pdf_url = ""
                    for a in card.find_all("a", href=True):
                        if ".pdf" in a["href"].lower() or "download" in a["href"].lower():
                            href = a["href"]
                            pdf_url = href if href.startswith("http") else BASE_URL + href
                            break
                    del_el   = card.find(class_=re.compile(r"date|tanggal", re.I))
                    date_raw = del_el.get_text(strip=True) if del_el else ""
                    cat_el   = card.find(class_=re.compile(r"badge|jenis|type|kategori", re.I))
                    category = cat_el.get_text(strip=True) if cat_el else "Peraturan MK"
                    n, y = extract_nomor_tahun(title)
                    items.append(build_item(title, category, n, y, date_raw, pdf_url, len(items)))
                except Exception as e:
                    logger.debug(f"Card {ci}: {e}")
            if items:
                break

    has_next = _has_next(soup, page_num)
    logger.info(f"  Halaman {page_num}: {len(items)} item, has_next={has_next}")
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
# Main
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
                "--disable-dev-shm-usage",
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
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = context.new_page()

        # Intercept JSON API responses
        api_captured: List[dict] = []

        def on_response(response):
            try:
                ct = response.headers.get("content-type", "")
                if response.status == 200 and "json" in ct:
                    data = response.json()
                    if isinstance(data, (dict, list)) and data:
                        api_captured.append({"url": response.url, "data": data})
                        logger.info(f"  [intercept] JSON: {response.url}")
            except Exception:
                pass

        page.on("response", on_response)

        # ---- Seed cookies from homepage ----
        logger.info("Membuka halaman utama MK…")
        try:
            page.goto(BASE_URL + "/", wait_until="networkidle", timeout=30000)
            time.sleep(2)
        except PWTimeout:
            logger.warning("Homepage timeout")

        # ---- Find accessible list URL ----
        active_list_url = None
        for candidate in LIST_URLS:
            logger.info(f"Mencoba: {candidate}")
            try:
                resp = page.goto(candidate, wait_until="networkidle", timeout=30000)
                time.sleep(2)
                # Check for Cloudflare
                title_text = page.title().lower()
                if "just a moment" in title_text:
                    logger.info("Cloudflare challenge, menunggu 10 detik…")
                    time.sleep(10)
                    try:
                        page.wait_for_load_state("networkidle", timeout=20000)
                    except PWTimeout:
                        pass
                    title_text = page.title().lower()

                if "just a moment" not in title_text:
                    active_list_url = candidate
                    logger.info(f"Halaman list ditemukan: {candidate} (title: {page.title()[:60]})")
                    break
            except PWTimeout:
                logger.warning(f"Timeout: {candidate}")
            except Exception as e:
                logger.warning(f"Error {candidate}: {e}")

        if not active_list_url:
            logger.error("Tidak bisa menemukan halaman list MK yang accessible")
            browser.close()
            return []

        # ---- Process API captures first ----
        if api_captured:
            logger.info(f"API JSON tercapture: {len(api_captured)} response(s)")
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
                    if not title:
                        continue
                    nomor    = (item.get("nomor") or item.get("number") or "").strip()
                    tahun    = (item.get("tahun") or item.get("year") or "").strip()
                    category = (item.get("jenis") or item.get("type") or item.get("kategori") or "Peraturan MK").strip()
                    date_raw = (item.get("tanggal") or item.get("date") or "").strip()
                    pdf_url  = (item.get("file_url") or item.get("fileUrl") or item.get("pdf_url") or "").strip()
                    if pdf_url and not pdf_url.startswith("http"):
                        pdf_url = BASE_URL + pdf_url
                    n, y = extract_nomor_tahun(nomor + " " + title)
                    if nomor: n = nomor
                    if tahun: y = tahun
                    item_obj = build_item(title, category, n, y, date_raw, pdf_url, len(all_results)+i)
                    if item_obj["rule_code"] not in seen_codes:
                        seen_codes.add(item_obj["rule_code"])
                        all_results.append(item_obj)

        # ---- HTML pagination loop ----
        page_num = 1
        while True:
            html = page.content()
            items, has_next = parse_page_html(html, page_num)

            new = 0
            for item in items:
                if item["rule_code"] not in seen_codes:
                    seen_codes.add(item["rule_code"])
                    all_results.append(item)
                    new += 1

            if new == 0 and page_num > 1:
                logger.info(f"Tidak ada item baru di halaman {page_num}")
                break
            if not has_next:
                break
            if max_pages and page_num >= max_pages:
                break

            page_num += 1
            next_url = active_list_url + f"?page={page_num}"
            logger.info(f"Navigasi ke halaman {page_num}")
            try:
                page.goto(next_url, wait_until="networkidle", timeout=30000)
                time.sleep(rate)
            except PWTimeout:
                logger.warning(f"Timeout halaman {page_num}")
                break

        # ---- Download PDFs ----
        if download_pdf and all_results:
            logger.info(f"Mengunduh PDF ({sum(1 for r in all_results if r.get('pdf_url'))} dokumen)…")
            _download_pdfs(all_results, output_path, context)

        browser.close()

    logger.info(f"MK scraping selesai. Total: {len(all_results)} dokumen")
    return all_results


def _download_pdfs(results, output_path, context):
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
            cookies = {c["name"]: c["value"] for c in context.cookies()}
            r = req.get(url, cookies=cookies, timeout=60, stream=True,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
            r.raise_for_status()
            if "pdf" not in r.headers.get("content-type","").lower() and not url.lower().endswith(".pdf"):
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
        description="JDIH Mahkamah Konstitusi — Playwright Scraper (bypass Cloudflare)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--output-json", default="mk_peraturan.json")
    parser.add_argument("--output-dir",  default="./pdf_raw")
    parser.add_argument("--no-pdf",      action="store_true")
    parser.add_argument("--rate",        type=float, default=2.0)
    parser.add_argument("--max-pages",   type=int,   default=0)
    parser.add_argument("--show-browser", action="store_true",
                        help="Tampilkan jendela browser (untuk debug)")
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
        print("PERINGATAN: 0 dokumen. Coba --show-browser untuk debug visual.")


if __name__ == "__main__":
    main()
