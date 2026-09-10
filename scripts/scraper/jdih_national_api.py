#!/usr/bin/env python3
"""
JDIH Nasional API Scraper
Mengambil data Mahkamah Agung, Mahkamah Konstitusi, dan Kemendagri
dari API nasional jdihn.go.id yang tersedia tanpa autentikasi.

Endpoint: https://api.peraturan.go.id/v3/search  (primary)
Fallback:  https://jdihn.go.id/api/                (secondary)

Jalankan:
    python jdih_national_api.py --instansi all --output-json national_peraturan.json
    python jdih_national_api.py --instansi ma --output-json ma_peraturan.json
    python jdih_national_api.py --instansi mk --output-json mk_peraturan.json
    python jdih_national_api.py --instansi kemendagri --output-json kemendagri_peraturan.json
"""

import argparse
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [NATIONAL] %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("jdih_national_api.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API Endpoints — tested in order until one works
# ---------------------------------------------------------------------------

# peraturan.go.id v3 — open search API by BPK
PERATURAN_GO_ID = "https://peraturan.go.id"
PERATURAN_SEARCH_V3 = "https://peraturan.go.id/api/search"  # GET ?keyword=&page=&perPage=

# JDIH Nasional API
JDIHN_API = "https://jdihn.go.id/api"
JDIHN_SEARCH = JDIHN_API + "/v1/regulation"   # GET ?keyword=&instansi=&page=&limit=

# BPK Peraturan API
BPK_API  = "https://peraturan.bpk.go.id"
BPK_LIST = BPK_API + "/api/v1/peraturan"

# ---------------------------------------------------------------------------
# Instansi config
# ---------------------------------------------------------------------------

INSTANSI_CONFIG = {
    "ma": {
        "label":    "Mahkamah Agung",
        "source":   "jdih.mahkamahagung.go.id",
        "keywords": ["mahkamah agung", "perma", "sema"],
        "instansi_codes": ["mahkamah agung", "MA"],
        "default_category": "Peraturan MA",
        "rule_prefix": "MA",
    },
    "mk": {
        "label":    "Mahkamah Konstitusi",
        "source":   "jdih.mkri.id",
        "keywords": ["mahkamah konstitusi", "pmk", "mkri"],
        "instansi_codes": ["mahkamah konstitusi", "MK"],
        "default_category": "Peraturan MK",
        "rule_prefix": "MK",
    },
    "kemendagri": {
        "label":    "Kementerian Dalam Negeri",
        "source":   "jdih.kemendagri.co",
        "keywords": ["kementerian dalam negeri", "kemendagri", "mendagri", "permendagri"],
        "instansi_codes": ["kementerian dalam negeri", "kemendagri", "KEMENDAGRI"],
        "default_category": "Peraturan Kemendagri",
        "rule_prefix": "KEMENDAGRI",
    },
}

BULAN_ID = {
    "januari":"01","februari":"02","maret":"03","april":"04",
    "mei":"05","juni":"06","juli":"07","agustus":"08",
    "september":"09","oktober":"10","november":"11","desember":"12",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=4, backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("http://",  adapter)
    s.mount("https://", adapter)
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; LexIntegrity/1.0; +https://github.com/lex-integrity)",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    })
    return s


def parse_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = str(raw).strip()
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
    m4 = re.match(r"^(\d{4})$", raw)
    if m4:
        return f"{m4.group(1)}-01-01"
    return None


def extract_nomor_tahun(text: str) -> Tuple[str, str]:
    m = re.search(r"[Nn]omor\s+(\d+[A-Za-z]?(?:/[A-Z]+)?)\s+[Tt]ahun\s+(\d{4})", text)
    if m:
        return m.group(1), m.group(2)
    m2 = re.search(r"[Nn]o\.?\s*(\d+[A-Za-z]?).*?Tahun\s+(\d{4})", text)
    if m2:
        return m2.group(1), m2.group(2)
    m3 = re.search(r"\b(20\d{2}|19\d{2})\b", text)
    return "", m3.group(1) if m3 else ""


def make_rule_code(prefix: str, nomor: str, tahun: str, title: str, idx: int) -> str:
    if not nomor and not tahun:
        n, y = extract_nomor_tahun(title)
        nomor, tahun = n, y
    clean_n = re.sub(r"[^A-Za-z0-9]", "", nomor) if nomor else str(idx)
    clean_y = re.sub(r"[^0-9]", "", tahun)[:4] if tahun else ""
    return f"{prefix}-{clean_n}-{clean_y}" if clean_y else f"{prefix}-{clean_n}"


def derive_regime(publish_date: Optional[str]) -> str:
    if not publish_date:
        return "Nasional"
    try:
        year = int(publish_date[:4])
        if year >= 2024: return "Prabowo"
        if year >= 2014: return "Jokowi"
        if year >= 2009: return "SBY II"
        if year >= 2004: return "SBY I"
        if year >= 2001: return "Megawati"
        if year >= 1999: return "Gus Dur"
        if year >= 1998: return "Habibie"
        return "Orde Baru"
    except:
        return "Nasional"


def normalize_item(raw: dict, config: dict, idx: int) -> Optional[Dict]:
    """Convert raw API item to canonical rules format."""
    # Try multiple possible field names across different APIs
    title = (
        raw.get("judul") or raw.get("title") or raw.get("nama") or
        raw.get("subject") or ""
    ).strip()
    if not title:
        return None

    nomor = (
        raw.get("nomor") or raw.get("nomor_peraturan") or raw.get("number") or ""
    ).strip()
    tahun = (
        raw.get("tahun") or raw.get("tahun_terbit") or raw.get("year") or ""
    ).strip()
    if isinstance(tahun, int):
        tahun = str(tahun)

    category = (
        raw.get("jenis") or raw.get("jenis_peraturan") or raw.get("type") or
        raw.get("bentuk") or raw.get("kategori") or config["default_category"]
    ).strip()

    date_raw = (
        raw.get("tanggal_penetapan") or raw.get("tanggal_terbit") or
        raw.get("tanggal_diundangkan") or raw.get("tanggal") or
        raw.get("date") or raw.get("tgl_terbit") or
        (tahun if re.match(r"^\d{4}$", tahun) else "")
    )

    pdf_url = (
        raw.get("url_dokumen") or raw.get("fileUrl") or raw.get("pdf_url") or
        raw.get("file_url") or raw.get("url_pdf") or
        raw.get("dokumen_url") or raw.get("link") or ""
    ).strip()
    if pdf_url and not pdf_url.startswith("http"):
        pdf_url = PERATURAN_GO_ID + "/" + pdf_url.lstrip("/")

    # Source URL for detail page
    source_url = (
        raw.get("url") or raw.get("detail_url") or raw.get("link_detail") or ""
    ).strip()

    publish_date = parse_date(str(date_raw)) if date_raw else None

    rule_code = make_rule_code(config["rule_prefix"], nomor, tahun, title, idx)

    return {
        "rule_code":         rule_code,
        "title":             title[:500],
        "category":          category[:100],
        "regime":            derive_regime(publish_date),
        "publish_date":      publish_date,
        "pdf_url":           pdf_url or None,
        "source":            config["source"],
        "source_url":        source_url or None,
        "is_active":         True,
        "processed_at":      datetime.now().isoformat(),
        "processed_by":      "scraper-jdih-national-api",
        "processing_method": "api",
        "scraped_at":        datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# API Strategy 1: peraturan.go.id search API
# ---------------------------------------------------------------------------

class PeraturanGoIdScraper:
    """Scrape from peraturan.go.id — BPK's open national regulation database."""

    BASE = "https://peraturan.go.id"
    ENDPOINTS = [
        "/api/search",
        "/api/v2/search",
        "/api/v1/search",
        "/api/peraturan",
        "/api/v2/peraturan",
    ]

    def __init__(self, session: requests.Session, rate: float = 1.0):
        self.session  = session
        self.rate     = rate
        self._api_url = None

    def _find_api(self) -> Optional[str]:
        if self._api_url:
            return self._api_url
        for ep in self.ENDPOINTS:
            url = self.BASE + ep
            try:
                r = self.session.get(url, params={"keyword": "peraturan", "page": 1, "perPage": 3}, timeout=12)
                if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
                    logger.info(f"peraturan.go.id API found: {url}")
                    self._api_url = url
                    return url
            except Exception:
                pass
        return None

    def fetch(self, keyword: str, max_pages: int = 0) -> List[dict]:
        api_url = self._find_api()
        if not api_url:
            logger.warning("peraturan.go.id API not accessible")
            return []

        results = []
        page    = 1
        per_page = 20

        while True:
            try:
                r = self.session.get(api_url, params={
                    "keyword": keyword, "page": page,
                    "perPage": per_page, "rows": per_page,
                }, timeout=20)
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                logger.error(f"peraturan.go.id page {page}: {e}")
                break

            items = (
                data.get("data") or data.get("results") or data.get("items") or
                (data if isinstance(data, list) else [])
            )
            if not items:
                break

            results.extend(items)
            total = data.get("total") or data.get("totalRows") or 0
            logger.info(f"  peraturan.go.id '{keyword}' page {page}: {len(items)} (total={total}, got={len(results)})")

            if max_pages and page >= max_pages:
                break
            if len(items) < per_page or (total and len(results) >= total):
                break

            page += 1
            time.sleep(self.rate)

        return results


# ---------------------------------------------------------------------------
# API Strategy 2: jdihn.go.id
# ---------------------------------------------------------------------------

class JDIHNScraper:
    """Scrape from jdihn.go.id national API."""

    ENDPOINTS = [
        "https://jdihn.go.id/api/v1/regulation",
        "https://jdihn.go.id/api/regulation",
        "https://api.jdihn.go.id/api/v1/regulation",
        "https://api.jdihn.go.id/v1/regulation",
        "https://jdihn.go.id/produk",
    ]

    def __init__(self, session: requests.Session, rate: float = 1.0):
        self.session  = session
        self.rate     = rate
        self._api_url = None

    def _find_api(self) -> Optional[str]:
        if self._api_url:
            return self._api_url
        for url in self.ENDPOINTS:
            try:
                r = self.session.get(url, params={"page": 1, "limit": 3}, timeout=12)
                if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
                    logger.info(f"JDIHN API found: {url}")
                    self._api_url = url
                    return url
            except Exception:
                pass
        return None

    def fetch(self, instansi: str, keyword: str = "", max_pages: int = 0) -> List[dict]:
        api_url = self._find_api()
        if not api_url:
            logger.warning("JDIHN API not accessible")
            return []

        results = []
        page    = 1
        limit   = 20

        while True:
            params = {"page": page, "limit": limit, "instansi": instansi}
            if keyword:
                params["keyword"] = keyword
            try:
                r = self.session.get(api_url, params=params, timeout=20)
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                logger.error(f"JDIHN page {page}: {e}")
                break

            items = (
                data.get("data") or data.get("results") or data.get("items") or
                (data if isinstance(data, list) else [])
            )
            if not items:
                break

            results.extend(items)
            total = data.get("total") or data.get("totalCount") or 0
            logger.info(f"  JDIHN '{instansi}' page {page}: {len(items)} (total={total}, got={len(results)})")

            if max_pages and page >= max_pages:
                break
            if len(items) < limit or (total and len(results) >= total):
                break

            page += 1
            time.sleep(self.rate)

        return results


# ---------------------------------------------------------------------------
# API Strategy 3: BPK peraturan.bpk.go.id
# ---------------------------------------------------------------------------

class BPKScraper:
    """Scrape from BPK's peraturan.bpk.go.id."""

    ENDPOINTS = [
        "https://peraturan.bpk.go.id/api/v1/peraturan",
        "https://peraturan.bpk.go.id/api/peraturan",
        "https://peraturan.bpk.go.id/search",
    ]

    def __init__(self, session: requests.Session, rate: float = 1.0):
        self.session  = session
        self.rate     = rate
        self._api_url = None

    def _find_api(self) -> Optional[str]:
        if self._api_url:
            return self._api_url
        for url in self.ENDPOINTS:
            try:
                r = self.session.get(url, params={"page": 1, "perPage": 3}, timeout=12)
                if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
                    logger.info(f"BPK API found: {url}")
                    self._api_url = url
                    return url
            except Exception:
                pass
        return None

    def fetch(self, keyword: str, max_pages: int = 0) -> List[dict]:
        api_url = self._find_api()
        if not api_url:
            return []

        results = []
        page    = 1
        per_page = 20

        while True:
            try:
                r = self.session.get(api_url, params={
                    "keyword": keyword, "q": keyword,
                    "page": page, "perPage": per_page,
                }, timeout=20)
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                logger.error(f"BPK page {page}: {e}")
                break

            items = (
                data.get("data") or data.get("results") or
                (data if isinstance(data, list) else [])
            )
            if not items:
                break

            results.extend(items)
            total = data.get("total") or 0
            logger.info(f"  BPK '{keyword}' page {page}: {len(items)} (total={total})")

            if max_pages and page >= max_pages:
                break
            if len(items) < per_page or (total and len(results) >= total):
                break
            page += 1
            time.sleep(self.rate)

        return results


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

class NationalAPIScraper:
    """
    Mencoba semua API sumber nasional secara berurutan.
    Untuk setiap instansi target, ambil data dari sumber yang berhasil.
    """

    def __init__(self, rate: float = 1.0, max_pages: int = 0,
                 output_dir: str = "./pdf_raw", download_pdf: bool = False):
        self.rate         = rate
        self.max_pages    = max_pages
        self.output_dir   = Path(output_dir)
        self.download_pdf = download_pdf
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.session   = make_session()
        self.peraturan = PeraturanGoIdScraper(self.session, rate)
        self.jdihn     = JDIHNScraper(self.session, rate)
        self.bpk       = BPKScraper(self.session, rate)

    def scrape_instansi(self, instansi_key: str) -> List[Dict]:
        config = INSTANSI_CONFIG[instansi_key]
        logger.info(f"\n{'='*60}")
        logger.info(f"Scraping: {config['label']}")
        logger.info(f"{'='*60}")

        raw_items: List[dict] = []

        # Strategy 1: peraturan.go.id
        for kw in config["keywords"][:2]:   # try first 2 keywords
            items = self.peraturan.fetch(kw, self.max_pages)
            if items:
                raw_items.extend(items)
                logger.info(f"  peraturan.go.id '{kw}': {len(items)} item")
                break
            time.sleep(self.rate)

        # Strategy 2: JDIHN
        if not raw_items:
            for code in config["instansi_codes"][:2]:
                items = self.jdihn.fetch(code, max_pages=self.max_pages)
                if items:
                    raw_items.extend(items)
                    logger.info(f"  JDIHN '{code}': {len(items)} item")
                    break
                time.sleep(self.rate)

        # Strategy 3: BPK
        if not raw_items:
            for kw in config["keywords"][:2]:
                items = self.bpk.fetch(kw, self.max_pages)
                if items:
                    raw_items.extend(items)
                    logger.info(f"  BPK '{kw}': {len(items)} item")
                    break
                time.sleep(self.rate)

        if not raw_items:
            logger.warning(f"Semua API gagal untuk {config['label']}")
            return []

        # Normalize + dedupe
        seen     = set()
        results  = []
        for i, raw in enumerate(raw_items):
            item = normalize_item(raw, config, i)
            if not item:
                continue
            if item["rule_code"] not in seen:
                seen.add(item["rule_code"])
                results.append(item)

        logger.info(f"  → {len(results)} dokumen unik untuk {config['label']}")

        if self.download_pdf:
            self._download_pdfs(results)

        return results

    def scrape_all(self, instansi_keys: List[str]) -> Dict[str, List[Dict]]:
        output = {}
        for key in instansi_keys:
            if key not in INSTANSI_CONFIG:
                logger.warning(f"Instansi tidak dikenal: {key}")
                continue
            output[key] = self.scrape_instansi(key)
            time.sleep(self.rate * 2)
        return output

    def _download_pdfs(self, results: List[Dict]):
        for item in results:
            url = item.get("pdf_url")
            if not url:
                continue
            try:
                fname = re.sub(r"[^\w\-.]", "_", url.split("/")[-1].split("?")[0]) or "unnamed.pdf"
                fpath = self.output_dir / fname
                if fpath.exists() and fpath.stat().st_size > 1024:
                    continue
                r = self.session.get(url, timeout=90, stream=True)
                r.raise_for_status()
                if "pdf" not in r.headers.get("content-type","").lower() and not url.lower().endswith(".pdf"):
                    continue
                with open(fpath, "wb") as f:
                    for chunk in r.iter_content(8192):
                        f.write(chunk)
                logger.info(f"PDF: {fpath.name}")
                time.sleep(0.3)
            except Exception as e:
                logger.error(f"PDF error {url}: {e}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="JDIH National API Scraper — MA, MK, Kemendagri via open APIs",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--instansi",
        default="all",
        choices=["all", "ma", "mk", "kemendagri"],
        help="Instansi yang akan di-scrape (default: all)",
    )
    parser.add_argument("--output-json", default="national_peraturan.json",
                        help="File JSON output (untuk mode 'all')")
    parser.add_argument("--output-dir",  default="./pdf_raw")
    parser.add_argument("--no-pdf",      action="store_true")
    parser.add_argument("--rate",        type=float, default=1.0,
                        help="Jeda antar request (detik)")
    parser.add_argument("--max-pages",   type=int,   default=0,
                        help="Batas halaman per instansi (0=semua)")
    args = parser.parse_args()

    scraper = NationalAPIScraper(
        rate         = args.rate,
        max_pages    = args.max_pages,
        output_dir   = args.output_dir,
        download_pdf = not args.no_pdf,
    )

    # Tentukan instansi
    if args.instansi == "all":
        instansi_keys = ["ma", "mk", "kemendagri"]
    else:
        instansi_keys = [args.instansi]

    results_by_instansi = scraper.scrape_all(instansi_keys)

    total = 0
    for key, results in results_by_instansi.items():
        total += len(results)
        config = INSTANSI_CONFIG[key]

        # Simpan per-instansi kalau mode all, atau ke file yang diminta
        if args.instansi == "all":
            fname = f"{key}_peraturan.json"
        else:
            fname = args.output_json

        with open(fname, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"  {config['label']:40s} → {len(results):5d} dokumen → {fname}")

    # Juga simpan gabungan kalau mode all
    if args.instansi == "all":
        all_items = [item for items in results_by_instansi.values() for item in items]
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(all_items, f, indent=2, ensure_ascii=False)
        print(f"\n  Gabungan: {total} dokumen → {args.output_json}")

    print(f"\nSelesai. Total: {total} dokumen.")

    if total == 0:
        print(
            "\nSemua API tidak dapat diakses dari jaringan ini.\n"
            "Kemungkinan penyebab:\n"
            "  1. IP diblokir / rate-limited\n"
            "  2. API hanya tersedia dari jaringan tertentu\n"
            "  3. Endpoint API berubah\n"
            "\nAlternatif:\n"
            "  - Gunakan VPN / proxy\n"
            "  - Gunakan Playwright scraper: jdih_ma_playwright.py / jdih_mk_playwright.py\n"
            "  - Download dataset manual dari https://data.go.id atau https://peraturan.go.id"
        )


if __name__ == "__main__":
    main()
