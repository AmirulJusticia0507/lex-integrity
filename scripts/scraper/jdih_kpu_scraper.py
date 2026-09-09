#!/usr/bin/env python3
"""
JDIH KPU Peraturan Scraper
Mengambil metadata produk hukum dari https://jdih.kpu.go.id/peraturan-kpu
"""

import argparse
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('jdih_kpu_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

BASE_URL = 'https://jdih.kpu.go.id'
LIST_URL = BASE_URL + '/peraturan-kpu'


class JDIHKPUException(Exception):
    pass


class JDIHKPUScraper:
    """Scraper untuk halaman Peraturan KPU"""

    def __init__(self, pages: int = 39, output_dir: str = "./pdf_raw",
                 download_pdf: bool = True, rate: float = 1.0):
        self.pages = pages
        self.output_dir = Path(output_dir)
        self.download_pdf = download_pdf
        self.rate = rate
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': BASE_URL + '/peraturan-kpu'
        })
        return session

    def _fetch_page(self, page: int) -> Optional[str]:
        url = f"{LIST_URL}?page_peraturan={page}"
        try:
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.exceptions.RequestException as e:
            logger.error(f"Error HTTP saat mengambil halaman {page}: {e}")
            return None

    def _parse_page(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, 'html.parser')
        regulations = []
        cards = soup.select('div.card.mt-3')
        for card in cards:
            try:
                reg = self._parse_card(card)
                if reg:
                    regulations.append(reg)
            except Exception as e:
                logger.error(f"Error parsing card: {e}")
                continue
        return regulations

    def _parse_card(self, card) -> Optional[Dict]:
        header = card.find('div', class_='card-header')
        if not header:
            return None

        title_el = header.find('div', class_='search__title')
        if not title_el:
            return None

        nomor_text = title_el.get_text(strip=True)
        badge = header.find('button', class_='btn-danger')
        category = badge.get_text(strip=True) if badge else 'Peraturan Komisi'

        body = card.find('div', class_='card-body')
        desc = body.find('div', class_='search__desc') if body else None
        detail_link = desc.find('a') if desc else None
        detail_url = detail_link['href'] if detail_link and detail_link.has_attr('href') else ''
        title = detail_link.get_text(strip=True) if detail_link else ''

        footer = card.find('div', class_='card-footer')
        views = 0
        downloads = 0
        preview_url = ''
        download_url = ''
        if footer:
            eye_span = footer.find('i', class_='bi-eye')
            if eye_span:
                views_text = eye_span.parent.get_text(strip=True)
                views = self._parse_count(views_text)

            dl_span = footer.find('i', class_='bi-download')
            if dl_span:
                dl_text = dl_span.parent.get_text(strip=True)
                downloads = self._parse_count(dl_text)

            preview_btn = footer.find('button', attrs={'data-src': True})
            if preview_btn:
                preview_url = preview_btn['data-src']

            dl_a = footer.find('a', href=re.compile(r'/peraturan-kpu/download/\d+'))
            if dl_a:
                download_url = dl_a['href']

        pdf_url = preview_url if preview_url else ''
        pdf_filename = ''
        if pdf_url:
            pdf_filename = pdf_url.split('/')[-1]

        regulation = {
            'rule_code': nomor_text,
            'title': title,
            'category': category,
            'detail_url': detail_url,
            'preview_url': pdf_url,
            'download_url': download_url,
            'pdf_filename': pdf_filename,
            'views': views,
            'downloads': downloads,
            'source': 'jdih.kpu.go.id',
            'scraped_at': datetime.now().isoformat()
        }

        if not regulation['title']:
            return None

        if self.download_pdf and pdf_url:
            self._download_pdf(pdf_url, pdf_filename)

        return regulation

    @staticmethod
    def _parse_count(text: str) -> int:
        cleaned = re.sub(r'[^\d]', '', text)
        return int(cleaned) if cleaned else 0

    def _download_pdf(self, url: str, filename: str) -> bool:
        try:
            safe = Path(filename).stem
            safe = ''.join(c for c in safe if c.isalnum() or c in (' ', '-', '_')).rstrip()
            if not safe:
                safe = 'unnamed'
            filepath = self.output_dir / f"{safe}.pdf"
            if filepath.exists() and filepath.stat().st_size > 0:
                return True

            resp = self.session.get(url, timeout=120)
            resp.raise_for_status()
            if 'pdf' not in (resp.headers.get('content-type') or '').lower():
                logger.warning(f"Bukan PDF: {url} ({resp.headers.get('content-type')})")
                return False

            with open(filepath, 'wb') as f:
                f.write(resp.content)
            logger.info(f"PDF berhasil diunduh: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Gagal mengunduh PDF {url}: {e}")
            return False

    def scrape(self) -> List[Dict]:
        logger.info(f"Memulai scraping {self.pages} halaman dari {LIST_URL}")
        all_regulations = []
        seen_urls = set()

        for page in range(1, self.pages + 1):
            html = self._fetch_page(page)
            if not html:
                logger.warning(f"Gagal mengambil halaman {page}")
                continue

            regs = self._parse_page(html)
            new_count = 0
            for reg in regs:
                key = reg['detail_url'] or reg['title']
                if key not in seen_urls:
                    seen_urls.add(key)
                    all_regulations.append(reg)
                    new_count += 1

            logger.info(f"Halaman {page}: {new_count} peraturan baru (total: {len(all_regulations)})")
            import time
            time.sleep(self.rate)

        logger.info(f"Total peraturan berhasil di-scrape: {len(all_regulations)}")
        return all_regulations

    def save_to_json(self, regulations: List[Dict], filename: str):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(regulations, f, indent=2, ensure_ascii=False)
        logger.info(f"Data berhasil disimpan ke {filename}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='JDIH KPU Peraturan Scraper')
    parser.add_argument('--pages', type=int, default=39,
                        help='Jumlah halaman yang akan diambil')
    parser.add_argument('--output-dir', default='./pdf_raw',
                        help='Direktori untuk menyimpan file PDF')
    parser.add_argument('--output-json', default='kpu_peraturan.json',
                        help='File JSON untuk menyimpan hasil')
    parser.add_argument('--no-pdf', action='store_true',
                        help='Jangan mengunduh file PDF')
    parser.add_argument('--rate', type=float, default=1.0,
                        help='Jeda antar permintaan (detik)')

    args = parser.parse_args()

    try:
        scraper = JDIHKPUScraper(
            pages=args.pages,
            output_dir=args.output_dir,
            download_pdf=not args.no_pdf,
            rate=args.rate
        )
        regulations = scraper.scrape()
        if regulations:
            scraper.save_to_json(regulations, args.output_json)
            print(f"Scraping selesai! {len(regulations)} peraturan disimpan ke {args.output_json}")
        else:
            print("Tidak ada data yang berhasil di-scrape")
    except JDIHKPUException as e:
        print(f"Error konfigurasi: {e}")
    except Exception as e:
        print(f"Error tak terduga: {e}")
