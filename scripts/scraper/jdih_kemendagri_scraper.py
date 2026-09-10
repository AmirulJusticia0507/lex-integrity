#!/usr/bin/env python3
"""
JDIH Kemendagri Scraper
Mengambil metadata produk hukum dari https://jdih.kemendagri.co

Data yang tersedia (berdasarkan counter di homepage):
  - Undang-Undang     : ~1,247 dokumen
  - Peraturan Menteri : ~3,891 dokumen
  - Surat Edaran      : ~756 dokumen

Strategi:
  1. Probe API endpoint JSON internal
  2. Scraping HTML per kategori dengan paginasi
  3. Tangani berbagai layout (tabel, card, list)

Jalankan:
  python jdih_kemendagri_scraper.py --output-json kemendagri_peraturan.json
  python jdih_kemendagri_scraper.py --no-pdf --output-json kemendagri_peraturan.json
  python jdih_kemendagri_scraper.py --kategori uu --output-json kemendagri_uu.json
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
        logging.FileHandler('jdih_kemendagri_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Konstanta
# ---------------------------------------------------------------------------
BASE_URL = 'https://jdih.kemendagri.co'
SOURCE   = 'jdih.kemendagri.co'

# Kategori yang akan di-scrape beserta URL dan prefix
CATEGORIES: Dict[str, Dict] = {
    'uu': {
        'label':  'Undang-Undang',
        'prefix': 'UU',
        'urls': [
            BASE_URL + '/undang-undang',
            BASE_URL + '/produk-hukum/uu',
            BASE_URL + '/uu',
            BASE_URL + '/peraturan/uu',
        ],
    },
    'permen': {
        'label':  'Peraturan Menteri',
        'prefix': 'PERMENDAGRI',
        'urls': [
            BASE_URL + '/peraturan-menteri',
            BASE_URL + '/produk-hukum/permen',
            BASE_URL + '/permen',
            BASE_URL + '/permendagri',
        ],
    },
    'se': {
        'label':  'Surat Edaran',
        'prefix': 'SE-MENDAGRI',
        'urls': [
            BASE_URL + '/surat-edaran',
            BASE_URL + '/produk-hukum/se',
            BASE_URL + '/se',
        ],
    },
    'pp': {
        'label':  'Peraturan Pemerintah',
        'prefix': 'PP',
        'urls': [
            BASE_URL + '/peraturan-pemerintah',
            BASE_URL + '/pp',
        ],
    },
    'perpres': {
        'label':  'Peraturan Presiden',
        'prefix': 'PERPRES',
        'urls': [
            BASE_URL + '/peraturan-presiden',
            BASE_URL + '/perpres',
        ],
    },
    'kepmen': {
        'label':  'Keputusan Menteri',
        'prefix': 'KEPMEN',
        'urls': [
            BASE_URL + '/keputusan-menteri',
            BASE_URL + '/kepmen',
        ],
    },
}

# API candidates
API_CANDIDATES = [
    '/api/v1/peraturan',
    '/api/peraturan',
    '/api/v1/produk-hukum',
    '/api/produk-hukum',
    '/api/v1/dokumen',
    '/api/dokumen',
    '/api/v1/regulation',
    '/api/regulation',
    '/api/v1/uu',
    '/api/uu',
]

BULAN_ID = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
}


class JDIHKemendagriException(Exception):
    pass


class JDIHKemendagriScraper:
    """
    Scraper JDIH Kemendagri.
    Mencoba API JSON → scraping HTML per kategori.
    """

    def __init__(self, output_dir: str = './pdf_raw', download_pdf: bool = True,
                 rate: float = 1.5, max_pages: int = 0,
                 kategori: Optional[str] = None):
        self.output_dir   = Path(output_dir)
        self.download_pdf = download_pdf
        self.rate         = rate
        self.max_pages    = max_pages
        # None = scrape semua kategori
        self.target_cats  = [kategori] if kategori and kategori in CATEGORIES else list(CATEGORIES.keys())
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session      = self._create_session()

    # ------------------------------------------------------------------
    # Session
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
            'Referer': BASE_URL,
        })
        return session

    def _seed_cookies(self):
        try:
            resp = self.session.get(BASE_URL + '/', timeout=20)
            if resp.status_code == 200:
                self.session.headers['Referer'] = BASE_URL
                logger.info("Cookie-seeding berhasil")
        except Exception as e:
            logger.debug(f"Cookie seed gagal: {e}")

    # ------------------------------------------------------------------
    # Utilitas
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_date(raw: str) -> Optional[str]:
        if not raw:
            return None
        raw = raw.strip()
        # Hapus prefix seperti "Diundangkan: " atau "Diterbitkan: "
        raw = re.sub(r'^(diundangkan|ditetapkan|diterbitkan|tanggal)\s*:?\s*', '', raw, flags=re.I)
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
        return None

    @staticmethod
    def _make_rule_code(prefix: str, nomor: str, tahun: str, idx: int) -> str:
        clean_nomor = re.sub(r'[^A-Za-z0-9]', '', nomor) if nomor else str(idx)
        clean_tahun = re.sub(r'[^0-9]', '', tahun)[:4] if tahun else ''
        if clean_tahun:
            return f"{prefix}-{clean_nomor}-{clean_tahun}"
        return f"{prefix}-{clean_nomor or str(idx)}"

    @staticmethod
    def _extract_nomor_tahun(text: str) -> Tuple[str, str]:
        # "UU No. 15 Tahun 2024" atau "Nomor 08 Tahun 2024"
        m = re.search(
            r'(?:[Nn]omor|[Nn]o\.?)\s+(\d+[A-Za-z]?(?:/[A-Z]+)?)\s+[Tt]ahun\s+(\d{4})',
            text
        )
        if m:
            return m.group(1), m.group(2)
        # "SE No. 03 Tahun 2024"
        m2 = re.search(r'[Nn]o\.?\s*(\d+[A-Za-z]?).*?Tahun\s+(\d{4})', text)
        if m2:
            return m2.group(1), m2.group(2)
        # Hanya tahun
        m3 = re.search(r'\b(20\d{2}|19\d{2})\b', text)
        if m3:
            return '', m3.group(1)
        return '', ''

    # ------------------------------------------------------------------
    # API probe
    # ------------------------------------------------------------------
    def _probe_api(self) -> Optional[Tuple[str, dict]]:
        for path in API_CANDIDATES:
            url = BASE_URL + path
            try:
                resp = self.session.get(url, params={'page': 1, 'limit': 5}, timeout=15)
                if resp.status_code == 200 and 'json' in resp.headers.get('content-type', ''):
                    data = resp.json()
                    logger.info(f"API ditemukan: {url}")
                    return url, data
            except Exception:
                pass
        return None

    def _scrape_via_api(self, api_url: str, first_resp: dict) -> List[Dict]:
        """Ambil semua data dari API JSON."""
        all_results = []
        page        = 1
        limit       = 20

        while True:
            data = first_resp if page == 1 else self._fetch_api_page(api_url, page, limit)
            if not data:
                break

            items = (
                data.get('data') or data.get('results') or data.get('items') or
                (data if isinstance(data, list) else [])
            )
            if not items:
                break

            for i, item in enumerate(items):
                reg = self._normalize_api_item(item, len(all_results) + i)
                if reg:
                    all_results.append(reg)

            total = data.get('total') or 0
            logger.info(f"API page {page}: {len(items)} (total: {len(all_results)})")

            if self.max_pages and page >= self.max_pages:
                break
            if len(items) < limit or (total and len(all_results) >= total):
                break
            page += 1
            time.sleep(self.rate)

        return all_results

    def _fetch_api_page(self, api_url: str, page: int, limit: int) -> Optional[dict]:
        try:
            resp = self.session.get(api_url, params={'page': page, 'limit': limit}, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"API page {page}: {e}")
            return None

    def _normalize_api_item(self, item: dict, idx: int) -> Optional[Dict]:
        title    = (item.get('title') or item.get('judul') or item.get('name') or '').strip()
        if not title:
            return None
        nomor    = (item.get('nomor') or item.get('number') or '').strip()
        tahun    = (item.get('tahun') or item.get('year') or '').strip()
        category = (item.get('jenis') or item.get('type') or item.get('category') or
                    item.get('kategori') or 'Peraturan').strip()
        date_raw = (item.get('tanggal') or item.get('date') or item.get('diundangkan') or '').strip()
        pdf_url  = (item.get('file_url') or item.get('fileUrl') or item.get('pdf_url') or '').strip()
        if pdf_url and not pdf_url.startswith('http'):
            pdf_url = BASE_URL + pdf_url

        # Tentukan prefix berdasarkan kategori
        prefix = self._get_prefix_from_category(category)
        nomor_v, tahun_v = self._extract_nomor_tahun(nomor + ' ' + tahun + ' ' + title)
        if nomor:
            nomor_v = nomor
        if tahun:
            tahun_v = tahun

        return {
            'rule_code':         self._make_rule_code(prefix, nomor_v, tahun_v, idx),
            'title':             title[:500],
            'category':          category,
            'regime':            'Nasional',
            'publish_date':      self._parse_date(date_raw),
            'pdf_url':           pdf_url or None,
            'source':            SOURCE,
            'is_active':         True,
            'processed_at':      datetime.now().isoformat(),
            'processed_by':      'scraper-jdih-kemendagri',
            'processing_method': 'scrape',
            'scraped_at':        datetime.now().isoformat(),
        }

    @staticmethod
    def _get_prefix_from_category(cat: str) -> str:
        cat_lower = cat.lower()
        if 'undang-undang' in cat_lower or cat_lower.startswith('uu'):
            return 'UU'
        if 'peraturan pemerintah' in cat_lower:
            return 'PP'
        if 'peraturan presiden' in cat_lower:
            return 'PERPRES'
        if 'peraturan menteri' in cat_lower or 'permendagri' in cat_lower:
            return 'PERMENDAGRI'
        if 'keputusan menteri' in cat_lower or 'kepmendagri' in cat_lower:
            return 'KEPMENDAGRI'
        if 'surat edaran' in cat_lower:
            return 'SE-MENDAGRI'
        if 'instruksi' in cat_lower:
            return 'INSTR-MENDAGRI'
        return 'KEMENDAGRI'

    # ------------------------------------------------------------------
    # HTML scraping per kategori
    # ------------------------------------------------------------------
    def _find_accessible_url(self, url_list: List[str]) -> Optional[str]:
        for url in url_list:
            try:
                resp = self.session.get(url, timeout=20)
                if resp.status_code == 200:
                    logger.info(f"URL kategori: {url}")
                    return url
            except Exception:
                pass
        return None

    def _fetch_html(self, base_url: str, page: int) -> Optional[str]:
        candidates = [
            (base_url, {'page': page}),
            (base_url, {'hal': page}),
            (f"{base_url}?page={page}", {}),
            (f"{base_url}/{page}", {}),
        ]
        for url, params in candidates:
            try:
                resp = self.session.get(url, params=params or None, timeout=40)
                if resp.status_code == 200:
                    return resp.text
            except Exception:
                pass
        return None

    def _parse_html(self, html: str, category_info: dict, page_num: int) -> Tuple[List[Dict], bool]:
        soup    = BeautifulSoup(html, 'html.parser')
        items   = []
        prefix  = category_info['prefix']
        cat_label = category_info['label']

        # ---- Layout dari homepage Kemendagri: div dengan struktur card ----
        # <div> > <span class="badge">Undang-Undang</span>
        #       > <h3> UU No. 15 Tahun 2024 tentang... </h3>
        #       > <p>  Diundangkan: 15 Maret 2024  </p>
        #       > <a href="..."> Unduh PDF </a>

        # Layout 1: Cari wrapper card dengan kategori + judul + tanggal + link pdf
        for card in soup.select('div, article, li, section'):
            try:
                # Cek apakah ini card produk hukum (ada badge/jenis + judul bermakna)
                badge_el = card.find(class_=re.compile(r'badge|jenis|type|kategori', re.I))
                title_el = card.find(['h1', 'h2', 'h3', 'h4', 'strong'])

                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                if len(title) < 10:
                    continue

                # Harus mengandung "Tahun" + 4 digit atau nomor dokumen
                if not re.search(r'[Tt]ahun\s+\d{4}|[Nn]omor\s+\d+|[Nn]o\.?\s*\d+', title):
                    continue

                cat_text = badge_el.get_text(strip=True) if badge_el else cat_label

                # Tanggal
                date_raw = ''
                for p in card.find_all(['p', 'span', 'small']):
                    text = p.get_text(strip=True)
                    if re.search(r'(diundangkan|diterbitkan|tanggal|ditetapkan)', text, re.I):
                        date_raw = text
                        break

                # PDF link
                pdf_url = ''
                for a in card.find_all('a', href=True):
                    href = a['href']
                    if ('.pdf' in href.lower() or 'download' in href.lower() or
                            'unduh' in a.get_text(strip=True).lower()):
                        pdf_url = href if href.startswith('http') else BASE_URL + href
                        break

                nomor_v, tahun_v = self._extract_nomor_tahun(title)
                rule_code = self._make_rule_code(prefix, nomor_v, tahun_v, len(items))

                items.append({
                    'rule_code':         rule_code,
                    'title':             title[:500],
                    'category':          cat_text or cat_label,
                    'regime':            'Nasional',
                    'publish_date':      self._parse_date(date_raw),
                    'pdf_url':           pdf_url or None,
                    'source':            SOURCE,
                    'is_active':         True,
                    'processed_at':      datetime.now().isoformat(),
                    'processed_by':      'scraper-jdih-kemendagri',
                    'processing_method': 'scrape',
                    'scraped_at':        datetime.now().isoformat(),
                })
            except Exception as e:
                logger.debug(f"Card parse: {e}")
                continue

        # Layout 2: tabel fallback
        if not items:
            table = soup.find('table')
            if table:
                rows = table.find_all('tr')
                headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(['th', 'td'])] if rows else []
                col = {}
                for ci, h in enumerate(headers):
                    if 'nomor' in h or 'no.' in h:          col['nomor'] = ci
                    elif 'judul' in h or 'tentang' in h:    col['title'] = ci
                    elif 'tanggal' in h or 'tahun' in h:    col['date']  = ci
                    elif 'jenis' in h or 'kategori' in h:   col['cat']   = ci
                    elif 'pdf' in h or 'file' in h:         col['pdf']   = ci

                for row in rows[1:]:
                    tds = row.find_all('td')
                    if len(tds) < 2:
                        continue
                    try:
                        nomor    = tds[col.get('nomor', 0)].get_text(strip=True) if 'nomor' in col else ''
                        title    = tds[col.get('title', 1)].get_text(strip=True)
                        date_raw = tds[col.get('date', 2)].get_text(strip=True) if 'date' in col and len(tds) > col['date'] else ''
                        cat_text = tds[col.get('cat', 0)].get_text(strip=True) if 'cat' in col and len(tds) > col['cat'] else cat_label
                        pdf_url  = ''
                        if 'pdf' in col and len(tds) > col['pdf']:
                            a = tds[col['pdf']].find('a', href=True)
                            if a:
                                href = a['href']
                                pdf_url = href if href.startswith('http') else BASE_URL + href
                        if not title:
                            continue
                        nomor_v, tahun_v = self._extract_nomor_tahun(nomor + ' ' + title)
                        items.append({
                            'rule_code':         self._make_rule_code(prefix, nomor_v, tahun_v, len(items)),
                            'title':             title[:500],
                            'category':          cat_text,
                            'regime':            'Nasional',
                            'publish_date':      self._parse_date(date_raw),
                            'pdf_url':           pdf_url or None,
                            'source':            SOURCE,
                            'is_active':         True,
                            'processed_at':      datetime.now().isoformat(),
                            'processed_by':      'scraper-jdih-kemendagri',
                            'processing_method': 'scrape',
                            'scraped_at':        datetime.now().isoformat(),
                        })
                    except Exception:
                        continue

        has_next = self._has_next_page(soup, page_num)
        logger.info(f"  halaman {page_num}: {len(items)} item, has_next={has_next}")
        return items, has_next

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
        logger.info(f"Memulai scraping JDIH Kemendagri dari {BASE_URL}")

        # Seed cookies
        self._seed_cookies()
        time.sleep(1)

        # Coba API JSON dulu
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
            logger.warning("API tidak menghasilkan data, beralih ke HTML")

        # HTML scraping per kategori
        all_results  = []
        seen_codes   = set()

        for cat_key in self.target_cats:
            cat_info = CATEGORIES[cat_key]
            logger.info(f"Scraping kategori: {cat_info['label']}")

            list_url = self._find_accessible_url(cat_info['urls'])
            if not list_url:
                logger.warning(f"  Tidak bisa akses URL untuk kategori {cat_key}, skip")
                continue

            page = 1
            while True:
                html = self._fetch_html(list_url, page)
                if not html:
                    logger.warning(f"  Halaman {page} tidak bisa diakses")
                    break

                items, has_next = self._parse_html(html, cat_info, page)

                new = 0
                for item in items:
                    code = item['rule_code']
                    if code not in seen_codes:
                        seen_codes.add(code)
                        all_results.append(item)
                        new += 1

                if new == 0 and page > 1:
                    logger.info(f"  Tidak ada item baru di halaman {page}, selesai untuk {cat_key}")
                    break
                if not has_next:
                    break
                if self.max_pages and page >= self.max_pages:
                    break

                page += 1
                time.sleep(self.rate)

            logger.info(f"  Total dari {cat_info['label']}: {sum(1 for r in all_results if r['category'] == cat_info['label'])} item")

        if self.download_pdf:
            for item in all_results:
                if item.get('pdf_url'):
                    self._download_pdf(item['pdf_url'])
                    time.sleep(0.5)

        logger.info(f"Total dokumen Kemendagri: {len(all_results)}")
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
        description='JDIH Kemendagri Scraper',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument('--output-json', default='kemendagri_peraturan.json')
    parser.add_argument('--output-dir',  default='./pdf_raw')
    parser.add_argument('--no-pdf',      action='store_true')
    parser.add_argument('--rate',        type=float, default=1.5)
    parser.add_argument('--max-pages',   type=int,   default=0)
    parser.add_argument(
        '--kategori',
        choices=list(CATEGORIES.keys()),
        default=None,
        help='Scrape satu kategori saja (default: semua)',
    )
    args = parser.parse_args()

    scraper = JDIHKemendagriScraper(
        output_dir   = args.output_dir,
        download_pdf = not args.no_pdf,
        rate         = args.rate,
        max_pages    = args.max_pages,
        kategori     = args.kategori,
    )
    results = scraper.scrape()
    scraper.save_to_json(results, args.output_json)
    print(f"\nSelesai. Total: {len(results)} dokumen → {args.output_json}")


if __name__ == '__main__':
    main()
