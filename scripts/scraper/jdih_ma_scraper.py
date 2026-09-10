#!/usr/bin/env python3
"""
JDIH Mahkamah Agung RI Scraper
Mengambil metadata produk hukum dari https://jdih.mahkamahagung.go.id/dokumen

Strategi:
  1. Coba endpoint JSON/API internal (/api/... atau /dokumen/...)
  2. Fallback ke scraping HTML dengan BeautifulSoup
  3. Deteksi otomatis paginasi dari respons

Jalankan:
  python jdih_ma_scraper.py --output-json ma_peraturan.json
  python jdih_ma_scraper.py --no-pdf --output-json ma_peraturan.json
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
        logging.FileHandler('jdih_ma_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Konstanta
# ---------------------------------------------------------------------------
BASE_URL   = 'https://jdih.mahkamahagung.go.id'
LIST_URL   = BASE_URL + '/dokumen'
SOURCE     = 'jdih.mahkamahagung.go.id'

# Kandidat endpoint API yang akan dicoba berurutan
API_CANDIDATES = [
    '/api/v1/dokumen',
    '/api/dokumen',
    '/api/v1/regulation',
    '/api/regulation',
    '/api/v1/produk-hukum',
    '/api/produk-hukum',
    '/dokumen/data',
    '/dokumen/list',
]

BULAN_ID = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
}

# Pemetaan kategori ke kode singkat untuk rule_code
CATEGORY_PREFIX = {
    'peraturan mahkamah agung': 'PERMA',
    'peraturan ma': 'PERMA',
    'surat edaran mahkamah agung': 'SEMA',
    'surat edaran': 'SEMA',
    'keputusan ketua mahkamah agung': 'SK-KMA',
    'keputusan mahkamah agung': 'SK-MA',
    'keputusan': 'SK',
    'instruksi': 'INSTR',
    'undang-undang': 'UU',
    'peraturan pemerintah': 'PP',
    'peraturan presiden': 'PERPRES',
    'peraturan': 'PERMA',
}


class JDIHMAException(Exception):
    """Custom exception untuk scraping JDIH MA"""
    pass


class JDIHMAScraper:
    """
    Scraper produk hukum JDIH Mahkamah Agung RI.
    Mencoba API JSON terlebih dahulu, lalu fallback ke HTML parsing.
    """

    def __init__(self, output_dir: str = './pdf_raw', download_pdf: bool = True,
                 rate: float = 1.5, max_pages: int = 0):
        self.output_dir  = Path(output_dir)
        self.download_pdf = download_pdf
        self.rate         = rate
        self.max_pages    = max_pages  # 0 = ambil semua
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = self._create_session()

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
            'Upgrade-Insecure-Requests': '1',
            'Referer': LIST_URL,
        })
        return session

    # ------------------------------------------------------------------
    # Normalisasi tanggal
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_date(raw: str) -> Optional[str]:
        if not raw:
            return None
        raw = raw.strip()
        # Format: DD Bulan YYYY  atau  YYYY-MM-DD  atau  DD/MM/YYYY
        m = re.match(r'(\d{1,2})\s+(\w+)\s+(\d{4})', raw)
        if m:
            day, bulan, year = m.group(1), m.group(2).lower(), m.group(3)
            mon = BULAN_ID.get(bulan)
            if mon:
                return f"{year}-{mon}-{day.zfill(2)}"
        m2 = re.match(r'(\d{4})-(\d{2})-(\d{2})', raw)
        if m2:
            return raw[:10]
        m3 = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', raw)
        if m3:
            return f"{m3.group(3)}-{m3.group(2).zfill(2)}-{m3.group(1).zfill(2)}"
        return None

    # ------------------------------------------------------------------
    # Buat rule_code yang unik
    # ------------------------------------------------------------------
    @staticmethod
    def _make_rule_code(category: str, nomor: str, tahun: str, fallback_idx: int) -> str:
        prefix = 'MA'
        cat_lower = (category or '').lower().strip()
        for key, pfx in CATEGORY_PREFIX.items():
            if key in cat_lower:
                prefix = pfx
                break
        # Bersihkan nomor dari karakter non-alfanumerik
        clean_nomor = re.sub(r'[^A-Za-z0-9]', '', nomor) if nomor else str(fallback_idx)
        clean_tahun = re.sub(r'[^0-9]', '', tahun)[:4] if tahun else ''
        if clean_tahun:
            return f"{prefix}-{clean_nomor}-{clean_tahun}"
        return f"{prefix}-{clean_nomor}-IDX{fallback_idx}"

    # ------------------------------------------------------------------
    # Coba API JSON
    # ------------------------------------------------------------------
    def _probe_api(self) -> Optional[Tuple[str, dict]]:
        """
        Coba semua kandidat endpoint API.
        Kembalikan (url, json_response) jika berhasil, None jika tidak.
        """
        for path in API_CANDIDATES:
            url = BASE_URL + path
            try:
                resp = self.session.get(url, params={'page': 1, 'limit': 10}, timeout=20)
                if resp.status_code == 200:
                    ct = resp.headers.get('content-type', '')
                    if 'json' in ct:
                        data = resp.json()
                        logger.info(f"API ditemukan: {url}")
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
            logger.error(f"Error API page {page}: {e}")
            return None

    def _scrape_via_api(self, api_url: str, first_resp: dict) -> List[Dict]:
        """Scrape seluruh data lewat endpoint JSON."""
        results   = []
        page      = 1
        limit     = 20

        while True:
            data = first_resp if page == 1 else self._fetch_api_page(api_url, page, limit)
            if data is None:
                break

            # Cari array data dalam berbagai kemungkinan struktur respons
            items = (
                data.get('data') or data.get('results') or
                data.get('items') or data.get('documents') or
                (data if isinstance(data, list) else [])
            )
            if not items:
                break

            for idx, item in enumerate(items):
                reg = self._normalize_api_item(item, len(results) + idx)
                if reg:
                    results.append(reg)

            total = (
                data.get('total') or data.get('totalCount') or
                data.get('total_count') or 0
            )
            logger.info(f"API halaman {page}: {len(items)} item (total sejauh ini: {len(results)})")

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

        nomor    = (item.get('nomor') or item.get('number') or item.get('no') or '').strip()
        tahun    = (item.get('tahun') or item.get('year') or '').strip()
        category = (item.get('jenis') or item.get('type') or item.get('category') or
                    item.get('kategori') or 'Peraturan MA').strip()
        date_raw = (item.get('tanggal') or item.get('date') or item.get('publish_date') or
                    item.get('tanggalTerbit') or '').strip()
        pdf_url  = (item.get('file_url') or item.get('fileUrl') or item.get('pdf_url') or
                    item.get('url') or '').strip()
        if pdf_url and not pdf_url.startswith('http'):
            pdf_url = BASE_URL + pdf_url

        return {
            'rule_code':    self._make_rule_code(category, nomor, tahun, idx),
            'title':        title[:500],
            'category':     category,
            'regime':       'Nasional',
            'publish_date': self._parse_date(date_raw),
            'pdf_url':      pdf_url or None,
            'source':       SOURCE,
            'is_active':    True,
            'processed_at': datetime.now().isoformat(),
            'processed_by': 'scraper-jdih-ma',
            'processing_method': 'scrape',
            'scraped_at':   datetime.now().isoformat(),
        }

    # ------------------------------------------------------------------
    # Fallback: HTML scraping
    # ------------------------------------------------------------------
    def _fetch_html_page(self, page: int) -> Optional[str]:
        params = {'page': page, 'hal': page, 'p': page}
        urls   = [
            LIST_URL,
            LIST_URL + f'?page={page}',
            LIST_URL + f'?hal={page}',
        ]
        for url in urls:
            try:
                resp = self.session.get(url, params={'page': page}, timeout=40)
                if resp.status_code == 200:
                    return resp.text
                elif resp.status_code == 403:
                    logger.warning(f"HTTP 403 di {url} — server memblokir bot; coba tanpa params")
                    # Coba tanpa parameter halaman di halaman pertama
                    if page == 1:
                        resp2 = self.session.get(LIST_URL, timeout=40)
                        if resp2.status_code == 200:
                            return resp2.text
                    return None
            except requests.exceptions.RequestException as e:
                logger.error(f"Error HTTP halaman {page}: {e}")
        return None

    def _parse_html_page(self, html: str, page_num: int) -> Tuple[List[Dict], bool]:
        """
        Parse satu halaman HTML.
        Kembalikan (list_of_items, has_next_page).
        Mendukung beberapa layout umum JDIH.
        """
        soup  = BeautifulSoup(html, 'html.parser')
        items = []

        # --- Layout 1: tabel <tr> dengan kolom nomor/judul/tanggal/jenis ---
        rows = soup.select('table tr')
        if rows:
            header_texts = [th.get_text(strip=True).lower() for th in rows[0].select('th,td')]
            col_map = {}
            for ci, ht in enumerate(header_texts):
                if any(k in ht for k in ('nomor', 'no.')):
                    col_map['nomor'] = ci
                elif any(k in ht for k in ('judul', 'tentang', 'title')):
                    col_map['title'] = ci
                elif any(k in ht for k in ('tanggal', 'tahun', 'date')):
                    col_map['date'] = ci
                elif any(k in ht for k in ('jenis', 'type', 'kategori')):
                    col_map['category'] = ci
                elif 'download' in ht or 'file' in ht or 'pdf' in ht:
                    col_map['pdf'] = ci

            for ri, row in enumerate(rows[1:], start=1):
                cells = row.select('td')
                if len(cells) < 2:
                    continue
                try:
                    nomor    = cells[col_map.get('nomor', 0)].get_text(strip=True) if 'nomor' in col_map else f'row-{ri}'
                    title_td = cells[col_map.get('title', 1)]
                    title    = title_td.get_text(strip=True)
                    date_raw = cells[col_map.get('date', 2)].get_text(strip=True) if 'date' in col_map and len(cells) > col_map['date'] else ''
                    category = cells[col_map.get('category', 0)].get_text(strip=True) if 'category' in col_map and len(cells) > col_map['category'] else 'Peraturan MA'
                    pdf_url  = ''
                    if 'pdf' in col_map and len(cells) > col_map['pdf']:
                        a_tag = cells[col_map['pdf']].find('a')
                        if a_tag and a_tag.get('href'):
                            href = a_tag['href']
                            pdf_url = href if href.startswith('http') else BASE_URL + href

                    # Cari link PDF di sel judul jika belum ketemu
                    if not pdf_url:
                        a_tag = title_td.find('a')
                        if a_tag and a_tag.get('href'):
                            href = a_tag['href']
                            if '.pdf' in href.lower():
                                pdf_url = href if href.startswith('http') else BASE_URL + href

                    if not title:
                        continue

                    # Ekstrak nomor + tahun dari nomor atau title
                    nomor_val, tahun_val = self._extract_nomor_tahun(nomor + ' ' + title)
                    rule_code = self._make_rule_code(category, nomor_val, tahun_val, len(items) + 1)

                    items.append({
                        'rule_code':    rule_code,
                        'title':        title[:500],
                        'category':     category,
                        'regime':       'Nasional',
                        'publish_date': self._parse_date(date_raw),
                        'pdf_url':      pdf_url or None,
                        'source':       SOURCE,
                        'is_active':    True,
                        'processed_at': datetime.now().isoformat(),
                        'processed_by': 'scraper-jdih-ma',
                        'processing_method': 'scrape',
                        'scraped_at':   datetime.now().isoformat(),
                    })
                except Exception as e:
                    logger.debug(f"Skip baris {ri}: {e}")
                    continue

        # --- Layout 2: card/list div ---
        if not items:
            cards = soup.select(
                'div.card, div.item, div.regulation, '
                'div.dokumen, li.document, article.document'
            )
            for ci, card in enumerate(cards):
                try:
                    item = self._parse_card(card, ci)
                    if item:
                        items.append(item)
                except Exception as e:
                    logger.debug(f"Skip card {ci}: {e}")

        # Deteksi halaman berikutnya
        has_next = self._has_next_page(soup, page_num)

        logger.info(f"Halaman {page_num}: {len(items)} item ditemukan")
        return items, has_next

    def _parse_card(self, card, idx: int) -> Optional[Dict]:
        title_el = (
            card.find(['h2', 'h3', 'h4', 'h5']) or
            card.find(class_=re.compile(r'title|judul', re.I))
        )
        title = title_el.get_text(strip=True) if title_el else card.get_text(strip=True)[:200]
        if not title:
            return None

        pdf_url = ''
        for a in card.find_all('a', href=True):
            href = a['href']
            if '.pdf' in href.lower() or 'download' in href.lower():
                pdf_url = href if href.startswith('http') else BASE_URL + href
                break

        date_el  = card.find(class_=re.compile(r'date|tanggal', re.I))
        date_raw = date_el.get_text(strip=True) if date_el else ''
        cat_el   = card.find(class_=re.compile(r'type|jenis|kategori|badge', re.I))
        category = cat_el.get_text(strip=True) if cat_el else 'Peraturan MA'

        nomor_val, tahun_val = self._extract_nomor_tahun(title)
        rule_code = self._make_rule_code(category, nomor_val, tahun_val, idx)

        return {
            'rule_code':    rule_code,
            'title':        title[:500],
            'category':     category,
            'regime':       'Nasional',
            'publish_date': self._parse_date(date_raw),
            'pdf_url':      pdf_url or None,
            'source':       SOURCE,
            'is_active':    True,
            'processed_at': datetime.now().isoformat(),
            'processed_by': 'scraper-jdih-ma',
            'processing_method': 'scrape',
            'scraped_at':   datetime.now().isoformat(),
        }

    @staticmethod
    def _extract_nomor_tahun(text: str):
        m = re.search(r'[Nn]omor\s+(\d+[A-Za-z]?)\s+[Tt]ahun\s+(\d{4})', text)
        if m:
            return m.group(1), m.group(2)
        m2 = re.search(r'No\.?\s*(\d+[A-Za-z]?).*?(\d{4})', text)
        if m2:
            return m2.group(1), m2.group(2)
        return '', ''

    @staticmethod
    def _has_next_page(soup: BeautifulSoup, current_page: int) -> bool:
        # Cari link "next" / "selanjutnya" atau tombol pagination
        for a in soup.find_all('a', href=True):
            text = a.get_text(strip=True).lower()
            if text in ('next', '>', '»', 'selanjutnya'):
                return True
        nav = soup.find(['nav', 'ul'], class_=re.compile(r'pagination|pager', re.I))
        if nav:
            links = [a['href'] for a in nav.find_all('a', href=True)]
            for link in links:
                m = re.search(r'[?&](?:page|hal|p)=(\d+)', link)
                if m and int(m.group(1)) > current_page:
                    return True
        return False

    # ------------------------------------------------------------------
    # PDF download
    # ------------------------------------------------------------------
    def _download_pdf(self, url: str) -> bool:
        if not url:
            return False
        try:
            filename = url.split('/')[-1].split('?')[0]
            safe     = re.sub(r'[^\w\-.]', '_', filename) or 'unnamed.pdf'
            filepath = self.output_dir / safe
            if filepath.exists() and filepath.stat().st_size > 1024:
                return True
            resp = self.session.get(url, timeout=120, stream=True)
            resp.raise_for_status()
            ct = resp.headers.get('content-type', '')
            if 'pdf' not in ct.lower() and not url.lower().endswith('.pdf'):
                logger.warning(f"Bukan PDF: {url} ({ct})")
                return False
            with open(filepath, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.info(f"PDF diunduh: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Gagal unduh PDF {url}: {e}")
            return False

    # ------------------------------------------------------------------
    # Scrape utama
    # ------------------------------------------------------------------
    def scrape(self) -> List[Dict]:
        logger.info(f"Memulai scraping JDIH Mahkamah Agung dari {LIST_URL}")

        # Langkah 1: coba API JSON
        api_result = self._probe_api()
        if api_result:
            api_url, first_resp = api_result
            results = self._scrape_via_api(api_url, first_resp)
            if results:
                logger.info(f"API scraping selesai: {len(results)} dokumen")
                if self.download_pdf:
                    self._bulk_download_pdfs(results)
                return results
            logger.warning("API ditemukan tapi tidak ada data, beralih ke HTML scraping")

        # Langkah 2: HTML scraping
        logger.info("Menggunakan HTML scraping")
        all_results = []
        seen_codes  = set()
        page        = 1

        while True:
            html = self._fetch_html_page(page)
            if not html:
                logger.warning(f"Gagal ambil halaman {page}, berhenti")
                break

            items, has_next = self._parse_html_page(html, page)

            for item in items:
                code = item['rule_code']
                if code not in seen_codes:
                    seen_codes.add(code)
                    all_results.append(item)

            if not items:
                logger.info(f"Halaman {page}: kosong, selesai")
                break
            if not has_next:
                logger.info(f"Tidak ada halaman berikutnya setelah halaman {page}")
                break
            if self.max_pages and page >= self.max_pages:
                logger.info(f"Batas halaman {self.max_pages} tercapai")
                break

            page += 1
            time.sleep(self.rate)

        logger.info(f"Total dokumen MA berhasil di-scrape: {len(all_results)}")

        if self.download_pdf:
            self._bulk_download_pdfs(all_results)

        return all_results

    def _bulk_download_pdfs(self, results: List[Dict]):
        for item in results:
            if item.get('pdf_url'):
                self._download_pdf(item['pdf_url'])
                time.sleep(0.5)

    def save_to_json(self, data: List[Dict], filename: str):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Data disimpan ke {filename} ({len(data)} record)")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description='JDIH Mahkamah Agung RI Scraper',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument('--output-json', default='ma_peraturan.json',
                        help='File JSON output')
    parser.add_argument('--output-dir', default='./pdf_raw',
                        help='Direktori penyimpanan PDF')
    parser.add_argument('--no-pdf', action='store_true',
                        help='Jangan unduh PDF')
    parser.add_argument('--rate', type=float, default=1.5,
                        help='Jeda antar-request (detik)')
    parser.add_argument('--max-pages', type=int, default=0,
                        help='Batas halaman (0 = semua)')
    args = parser.parse_args()

    scraper = JDIHMAScraper(
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
