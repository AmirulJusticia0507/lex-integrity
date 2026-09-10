#!/usr/bin/env python3
"""
JDIH Mahkamah Konstitusi RI Scraper
Mengambil metadata produk hukum dari https://jdih.mkri.id

Strategi:
  1. Coba endpoint API internal/JSON (common MK RI API patterns)
  2. Fallback HTML scraping via BeautifulSoup (multi-layout support)
  3. Tangani Cloudflare/403 dengan cookie-seeding + full browser headers

Jalankan:
  python jdih_mk_scraper.py --output-json mk_peraturan.json
  python jdih_mk_scraper.py --no-pdf --max-pages 10 --output-json mk_peraturan.json
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
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('jdih_mk_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Konstanta
# ---------------------------------------------------------------------------
BASE_URL = 'https://jdih.mkri.id'
SOURCE   = 'jdih.mkri.id'

# Endpoint yang akan dicoba
PAGE_URLS = [
    BASE_URL + '/produk-hukum',
    BASE_URL + '/index.php/produk_hukum',
    BASE_URL + '/regulasi',
    BASE_URL + '/peraturan',
    BASE_URL,
]

API_CANDIDATES = [
    '/api/v1/produk-hukum',
    '/api/produk-hukum',
    '/api/v1/regulation',
    '/api/regulation',
    '/api/v1/peraturan',
    '/api/peraturan',
    '/api/v1/dokumen',
    '/api/dokumen',
]

BULAN_ID = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
}

# Kategori MK
CATEGORY_PREFIX = {
    'peraturan mahkamah konstitusi': 'PMK',
    'peraturan mk': 'PMK',
    'pmk': 'PMK',
    'keputusan mahkamah konstitusi': 'SK-MK',
    'keputusan ketua': 'SK-MK',
    'surat edaran': 'SE-MK',
    'undang-undang dasar': 'UUD',
    'undang-undang': 'UU',
    'peraturan pemerintah pengganti': 'PERPU',
    'risalah': 'RISALAH',
    'putusan': 'PUTUSAN-MK',
}


class JDIHMKException(Exception):
    """Custom exception untuk JDIH MK"""
    pass


class JDIHMKScraper:
    """
    Scraper produk hukum JDIH Mahkamah Konstitusi RI.
    Coba API JSON → fallback HTML. Tangani 403 dengan cookie-seeding.
    """

    def __init__(self, output_dir: str = './pdf_raw', download_pdf: bool = True,
                 rate: float = 1.5, max_pages: int = 0):
        self.output_dir   = Path(output_dir)
        self.download_pdf = download_pdf
        self.rate         = rate
        self.max_pages    = max_pages
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session      = self._create_session()
        self._base_page   = None  # halaman list yang berhasil diakses

    # ------------------------------------------------------------------
    # Session dengan cookie-seeding
    # ------------------------------------------------------------------
    def _create_session(self) -> requests.Session:
        session = requests.Session()
        retry   = Retry(
            total=4,
            backoff_factor=2,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=['HEAD', 'GET', 'OPTIONS'],
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        session.headers.update({
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,'
                      'application/json,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
        })
        return session

    def _seed_cookies(self) -> bool:
        """Kunjungi halaman utama untuk mendapatkan cookies sebelum scraping."""
        for url in [BASE_URL + '/', BASE_URL]:
            try:
                resp = self.session.get(url, timeout=20, allow_redirects=True)
                if resp.status_code == 200:
                    self.session.headers['Referer'] = resp.url
                    logger.info(f"Cookie-seeding berhasil dari {resp.url}")
                    return True
            except Exception as e:
                logger.debug(f"Seed cookie gagal dari {url}: {e}")
        return False

    # ------------------------------------------------------------------
    # Utilitas
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_date(raw: str) -> Optional[str]:
        if not raw:
            return None
        raw = raw.strip()
        m = re.match(r'(\d{1,2})\s+(\w+)\s+(\d{4})', raw)
        if m:
            mon = BULAN_ID.get(m.group(2).lower())
            if mon:
                return f"{m.group(3)}-{mon}-{m.group(1).zfill(2)}"
        m2 = re.match(r'(\d{4})-(\d{2})-(\d{2})', raw)
        if m2:
            return raw[:10]
        m3 = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', raw)
        if m3:
            return f"{m3.group(3)}-{m3.group(2).zfill(2)}-{m3.group(1).zfill(2)}"
        # Hanya tahun
        m4 = re.match(r'^(\d{4})$', raw)
        if m4:
            return f"{m4.group(1)}-01-01"
        return None

    @staticmethod
    def _make_rule_code(category: str, nomor: str, tahun: str, idx: int) -> str:
        prefix = 'MK'
        cat_lower = (category or '').lower().strip()
        for key, pfx in CATEGORY_PREFIX.items():
            if key in cat_lower:
                prefix = pfx
                break
        clean_nomor = re.sub(r'[^A-Za-z0-9]', '', nomor) if nomor else str(idx)
        clean_tahun = re.sub(r'[^0-9]', '', tahun)[:4] if tahun else ''
        if clean_tahun:
            return f"{prefix}-{clean_nomor}-{clean_tahun}"
        return f"{prefix}-{clean_nomor or str(idx)}"

    @staticmethod
    def _extract_nomor_tahun(text: str) -> Tuple[str, str]:
        m = re.search(r'[Nn]omor\s+(\d+[A-Za-z]?(?:/[A-Z]+)?)\s+[Tt]ahun\s+(\d{4})', text)
        if m:
            return m.group(1), m.group(2)
        m2 = re.search(r'[Nn]o\.?\s*(\d+[A-Za-z]?).*?(\d{4})', text)
        if m2:
            return m2.group(1), m2.group(2)
        # Cari hanya tahun
        m3 = re.search(r'(\d{4})', text)
        if m3:
            return '', m3.group(1)
        return '', ''

    # ------------------------------------------------------------------
    # Probe API JSON
    # ------------------------------------------------------------------
    def _probe_api(self) -> Optional[Tuple[str, dict]]:
        for path in API_CANDIDATES:
            url = BASE_URL + path
            try:
                resp = self.session.get(url, params={'page': 1, 'limit': 10}, timeout=20)
                if resp.status_code == 200 and 'json' in resp.headers.get('content-type', ''):
                    data = resp.json()
                    logger.info(f"API JSON ditemukan: {url}")
                    return url, data
            except Exception:
                pass
        return None

    def _fetch_api_page(self, api_url: str, page: int, limit: int = 20) -> Optional[dict]:
        try:
            resp = self.session.get(
                api_url,
                params={'page': page, 'limit': limit, 'per_page': limit},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"API page {page} error: {e}")
            return None

    def _scrape_via_api(self, api_url: str, first_resp: dict) -> List[Dict]:
        results = []
        page    = 1
        limit   = 20

        while True:
            data = first_resp if page == 1 else self._fetch_api_page(api_url, page, limit)
            if not data:
                break

            items = (
                data.get('data') or data.get('results') or
                data.get('items') or data.get('documents') or
                (data if isinstance(data, list) else [])
            )
            if not items:
                break

            for i, item in enumerate(items):
                reg = self._normalize_api_item(item, len(results) + i)
                if reg:
                    results.append(reg)

            total = data.get('total') or data.get('totalCount') or 0
            logger.info(f"API page {page}: {len(items)} item (total: {len(results)})")

            if self.max_pages and page >= self.max_pages:
                break
            if len(items) < limit or (total and len(results) >= total):
                break
            page += 1
            time.sleep(self.rate)

        return results

    def _normalize_api_item(self, item: dict, idx: int) -> Optional[Dict]:
        title    = (item.get('title') or item.get('judul') or item.get('name') or '').strip()
        if not title:
            return None
        nomor    = (item.get('nomor') or item.get('number') or '').strip()
        tahun    = (item.get('tahun') or item.get('year') or '').strip()
        category = (item.get('jenis') or item.get('type') or item.get('kategori') or
                    item.get('category') or 'Peraturan MK').strip()
        date_raw = (item.get('tanggal') or item.get('date') or item.get('tanggalTerbit') or '').strip()
        pdf_url  = (item.get('file_url') or item.get('fileUrl') or item.get('pdf_url') or '').strip()
        if pdf_url and not pdf_url.startswith('http'):
            pdf_url = BASE_URL + pdf_url

        return {
            'rule_code':         self._make_rule_code(category, nomor, tahun, idx),
            'title':             title[:500],
            'category':          category,
            'regime':            'Nasional',
            'publish_date':      self._parse_date(date_raw),
            'pdf_url':           pdf_url or None,
            'source':            SOURCE,
            'is_active':         True,
            'processed_at':      datetime.now().isoformat(),
            'processed_by':      'scraper-jdih-mk',
            'processing_method': 'scrape',
            'scraped_at':        datetime.now().isoformat(),
        }

    # ------------------------------------------------------------------
    # HTML scraping
    # ------------------------------------------------------------------
    def _find_list_url(self) -> Optional[str]:
        """Temukan URL listing yang dapat diakses (HTTP 200)."""
        for url in PAGE_URLS:
            try:
                resp = self.session.get(url, timeout=30)
                if resp.status_code == 200:
                    logger.info(f"Halaman list ditemukan: {url}")
                    self._base_page = url
                    return url
            except Exception as e:
                logger.debug(f"Coba {url}: {e}")
        return None

    def _fetch_html_page(self, base: str, page: int) -> Optional[str]:
        candidates = [
            (base, {'page': page}),
            (base, {'hal': page}),
            (f"{base}?page={page}", {}),
            (f"{base}/{page}", {}),
        ]
        for url, params in candidates:
            try:
                resp = self.session.get(url, params=params if params else None, timeout=40)
                if resp.status_code == 200:
                    return resp.text
            except Exception as e:
                logger.debug(f"HTML page {page} error {url}: {e}")
        return None

    def _parse_html(self, html: str, page_num: int) -> Tuple[List[Dict], bool]:
        soup  = BeautifulSoup(html, 'html.parser')
        items = []

        # Layout 1: tabel
        table = soup.find('table')
        if table:
            rows = table.find_all('tr')
            header_row = rows[0] if rows else None
            headers    = [th.get_text(strip=True).lower() for th in header_row.find_all(['th', 'td'])] if header_row else []

            col = {}
            for ci, h in enumerate(headers):
                if any(k in h for k in ('nomor', 'no.')):   col['nomor']    = ci
                elif any(k in h for k in ('judul', 'tentang')): col['title'] = ci
                elif any(k in h for k in ('tanggal', 'tahun')): col['date']  = ci
                elif any(k in h for k in ('jenis', 'kategori')): col['cat'] = ci
                elif 'pdf' in h or 'file' in h or 'download' in h: col['pdf'] = ci

            for row in rows[1:]:
                tds = row.find_all('td')
                if len(tds) < 2:
                    continue
                try:
                    nomor    = tds[col.get('nomor', 0)].get_text(strip=True) if 'nomor' in col else ''
                    title_td = tds[col.get('title', 1)]
                    title    = title_td.get_text(strip=True)
                    date_raw = tds[col.get('date', 2)].get_text(strip=True) if 'date' in col and len(tds) > col['date'] else ''
                    category = tds[col.get('cat', 0)].get_text(strip=True) if 'cat' in col and len(tds) > col['cat'] else 'Peraturan MK'

                    pdf_url = ''
                    if 'pdf' in col and len(tds) > col['pdf']:
                        a = tds[col['pdf']].find('a', href=True)
                        if a:
                            href = a['href']
                            pdf_url = href if href.startswith('http') else BASE_URL + href
                    if not pdf_url:
                        for a in title_td.find_all('a', href=True):
                            href = a['href']
                            if '.pdf' in href.lower():
                                pdf_url = href if href.startswith('http') else BASE_URL + href
                                break

                    if not title:
                        continue
                    nomor_v, tahun_v = self._extract_nomor_tahun(nomor + ' ' + title)
                    items.append(self._build_item(title, category, nomor_v, tahun_v, date_raw, pdf_url, len(items)))
                except Exception as e:
                    logger.debug(f"Row parse error: {e}")

        # Layout 2: div cards
        if not items:
            for selector in ['div.card', 'div.item-hukum', 'div.produk-hukum',
                             'li.regulation', 'article', 'div.list-item']:
                cards = soup.select(selector)
                for ci, card in enumerate(cards):
                    item = self._parse_generic_card(card, ci)
                    if item:
                        items.append(item)
                if items:
                    break

        has_next = self._has_next_page(soup, page_num)
        logger.info(f"Halaman {page_num}: {len(items)} item, has_next={has_next}")
        return items, has_next

    def _parse_generic_card(self, card, idx: int) -> Optional[Dict]:
        title_el = (card.find(['h2', 'h3', 'h4', 'h5', 'strong']) or
                    card.find(class_=re.compile(r'title|judul', re.I)))
        title = title_el.get_text(strip=True) if title_el else ''
        if not title:
            title = card.get_text(separator=' ', strip=True)[:200]
        if len(title) < 5:
            return None

        pdf_url = ''
        for a in card.find_all('a', href=True):
            if '.pdf' in a['href'].lower() or 'download' in a['href'].lower():
                href = a['href']
                pdf_url = href if href.startswith('http') else BASE_URL + href
                break

        date_el  = card.find(class_=re.compile(r'date|tanggal', re.I))
        date_raw = date_el.get_text(strip=True) if date_el else ''
        cat_el   = card.find(class_=re.compile(r'type|jenis|badge|kategori', re.I))
        category = cat_el.get_text(strip=True) if cat_el else 'Peraturan MK'

        nomor_v, tahun_v = self._extract_nomor_tahun(title)
        return self._build_item(title, category, nomor_v, tahun_v, date_raw, pdf_url, idx)

    def _build_item(self, title, category, nomor, tahun, date_raw, pdf_url, idx) -> Dict:
        return {
            'rule_code':         self._make_rule_code(category, nomor, tahun, idx),
            'title':             title[:500],
            'category':          category,
            'regime':            'Nasional',
            'publish_date':      self._parse_date(date_raw),
            'pdf_url':           pdf_url or None,
            'source':            SOURCE,
            'is_active':         True,
            'processed_at':      datetime.now().isoformat(),
            'processed_by':      'scraper-jdih-mk',
            'processing_method': 'scrape',
            'scraped_at':        datetime.now().isoformat(),
        }

    @staticmethod
    def _has_next_page(soup: BeautifulSoup, current: int) -> bool:
        for a in soup.find_all('a', href=True):
            text = a.get_text(strip=True).lower()
            if text in ('next', '>', '»', 'selanjutnya', 'berikutnya'):
                return True
            m = re.search(r'[?&/](?:page|hal|p)=(\d+)', a['href'])
            if m and int(m.group(1)) > current:
                return True
        return False

    # ------------------------------------------------------------------
    # PDF download
    # ------------------------------------------------------------------
    def _download_pdf(self, url: str):
        try:
            filename = re.sub(r'[^\w\-.]', '_', url.split('/')[-1].split('?')[0]) or 'unnamed.pdf'
            filepath = self.output_dir / filename
            if filepath.exists() and filepath.stat().st_size > 1024:
                return
            resp = self.session.get(url, timeout=120, stream=True)
            resp.raise_for_status()
            if 'pdf' not in resp.headers.get('content-type', '').lower() and not url.lower().endswith('.pdf'):
                return
            with open(filepath, 'wb') as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            logger.info(f"PDF: {filepath}")
        except Exception as e:
            logger.error(f"PDF error {url}: {e}")

    # ------------------------------------------------------------------
    # Scrape utama
    # ------------------------------------------------------------------
    def scrape(self) -> List[Dict]:
        logger.info(f"Memulai scraping JDIH Mahkamah Konstitusi dari {BASE_URL}")

        # Seed cookies dulu
        self._seed_cookies()
        time.sleep(1)

        # Coba API
        api_result = self._probe_api()
        if api_result:
            api_url, first_resp = api_result
            results = self._scrape_via_api(api_url, first_resp)
            if results:
                logger.info(f"API scraping selesai: {len(results)} dokumen")
                if self.download_pdf:
                    for item in results:
                        if item.get('pdf_url'):
                            self._download_pdf(item['pdf_url'])
                            time.sleep(0.5)
                return results

        # HTML fallback
        logger.info("Beralih ke HTML scraping")
        list_url = self._find_list_url()
        if not list_url:
            logger.error("Tidak bisa mengakses halaman list JDIH MK (semua URL 403/404)")
            # Return empty list dengan metadata agar loader tidak crash
            return []

        all_results = []
        seen_codes  = set()
        page        = 1

        while True:
            html = self._fetch_html_page(list_url, page)
            if not html:
                logger.warning(f"Gagal ambil halaman {page}")
                break

            items, has_next = self._parse_html(html, page)

            new = 0
            for item in items:
                code = item['rule_code']
                if code not in seen_codes:
                    seen_codes.add(code)
                    all_results.append(item)
                    new += 1

            if new == 0:
                logger.info("Tidak ada item baru, selesai")
                break
            if not has_next:
                break
            if self.max_pages and page >= self.max_pages:
                break

            page += 1
            time.sleep(self.rate)

        if self.download_pdf:
            for item in all_results:
                if item.get('pdf_url'):
                    self._download_pdf(item['pdf_url'])
                    time.sleep(0.5)

        logger.info(f"Total dokumen MK: {len(all_results)}")
        return all_results

    def save_to_json(self, data: List[Dict], filename: str):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Disimpan ke {filename} ({len(data)} record)")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description='JDIH Mahkamah Konstitusi RI Scraper',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument('--output-json', default='mk_peraturan.json')
    parser.add_argument('--output-dir',  default='./pdf_raw')
    parser.add_argument('--no-pdf',      action='store_true')
    parser.add_argument('--rate',        type=float, default=1.5)
    parser.add_argument('--max-pages',   type=int,   default=0)
    args = parser.parse_args()

    scraper = JDIHMKScraper(
        output_dir   = args.output_dir,
        download_pdf = not args.no_pdf,
        rate         = args.rate,
        max_pages    = args.max_pages,
    )
    results = scraper.scrape()
    scraper.save_to_json(results, args.output_json)
    print(f"\nSelesai. Total: {len(results)} dokumen → {args.output_json}")


if __name__ == '__main__':
    main()
