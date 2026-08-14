#!/usr/bin/env python3
"""
JDIH Sleman Scraper
Mengambil metadata produk hukum dari https://jdih.slemankab.go.id
Sumber: endpoint DataTables WordPress (wp-admin/admin-ajax.php?action=load_tabel)
"""

import argparse
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('jdih_sleman_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

BASE_URL = 'https://jdih.slemankab.go.id'
AJAX_URL = BASE_URL + '/wp-admin/admin-ajax.php'

# Kode kategori: id -> (kode singkat, nama)
KATEGORI = {
    '1': ('PERDA', 'Peraturan Daerah'),
    '2': ('PERBUP', 'Peraturan Bupati'),
    '3': ('KEPBUP', 'Keputusan Bupati'),
    '4': ('INBUP', 'Instruksi Bupati'),
    '6': ('RAPERDA', 'Rancangan PUU'),
    '8': ('PERDES', 'Peraturan Desa'),
    '18': ('PERKAL', 'Peraturan Kalurahan'),
    '22': ('SE', 'Surat Edaran'),
    '23': ('PERLURAH', 'Peraturan Lurah'),
}

# Reverse map: nama kategori -> kode singkat
JENIS_TO_KODE = {nama: kode for kode, nama in KATEGORI.values()}

BULAN = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
}


class JDIHSlemanException(Exception):
    """Custom exception untuk scraping JDIH Sleman"""
    pass


class JDIHSlemanScraper:
    """Scraper produk hukum JDIH Kabupaten Sleman via endpoint DataTables"""

    def __init__(self, kategori: Optional[str] = None, output_dir: str = "./pdf_raw",
                 download_pdf: bool = True, rate: float = 1.0):
        self.kategori = kategori
        self.output_dir = Path(output_dir)
        self.download_pdf = download_pdf
        self.rate = rate
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Buat session dengan retry policy + header mirip browser"""
        session = requests.Session()

        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "OPTIONS"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': BASE_URL + '/produk-hukum/',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': BASE_URL
        })

        return session

    def _post_page(self, start: int, length: int, kategori: Optional[str]) -> Optional[Dict]:
        """Ambil satu halaman dari endpoint DataTables"""
        data = {
            'action': 'load_tabel',
            'draw': 1,
            'start': start,
            'length': length,
            'search[value]': '',
            'search[regex]': 'false',
            'kategori': kategori or '',
            'cari': '',
            'subject': '',
            'type': '',
            'produk': '',
            'judul': '',
            'status': '',
            'tahun': '',
            'nomor': '',
            'tipe_dokumen': '',
        }
        try:
            resp = self.session.post(AJAX_URL, data=data, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error HTTP saat mengambil halaman start={start}: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON start={start}: {e}")
            return None

    def _fetch_all(self, kategori: Optional[str]) -> List[Dict]:
        """Ambil seluruh data untuk satu kategori (atau semua jika kategori None)"""
        rows = []
        start = 0
        length = 500
        total = None

        while True:
            j = self._post_page(start, length, kategori)
            if j is None:
                break
            if 'data' not in j:
                logger.error(f"Respons tanpa key 'data': {str(j)[:200]}")
                break

            batch = j['data']
            rows.extend(batch)

            if total is None:
                total = j.get('recordsTotal', 0)
                filtered = j.get('recordsFiltered', 0)
                logger.info(f"Total record: {total}, setelah filter: {filtered}")

            start += len(batch)
            if not batch or start >= (total or 0):
                break

            time.sleep(self.rate)

        logger.info(f"Berhasil mengambil {len(rows)} baris untuk kategori={kategori or 'semua'}")
        return rows

    @staticmethod
    def _parse_date(value: str) -> Optional[str]:
        """Parse tanggal format Indonesia '28 Oktober 1988' -> ISO yyyy-mm-dd"""
        if not value:
            return None
        value = re.sub(r'\s+', ' ', value.strip())
        m = re.match(r'^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$', value)
        if m:
            day, month, year = m.group(1), m.group(2).lower(), m.group(3)
            month_num = BULAN.get(month)
            if month_num:
                return f"{year}-{month_num}-{int(day):02d}"
        # format lain seperti '00  0000' -> lewati
        return None

    def _make_rule_code(self, row: Dict, short: str) -> str:
        """Buat rule_code unik: {KODE}-{nomor}-{tahun}"""
        # Field '1' berformat "5 Tahun 1988" -> nomor & tahun
        nomor_full = str(row.get('1') or '').strip()
        nomor_full = re.sub(r'\s+', ' ', nomor_full)
        m = re.match(r'(\d+)', nomor_full)
        num = m.group(1) if m else ''
        num = re.sub(r'^0+', '', num)
        # Cari tahun yang masuk akal (1945-2026); fallback ke grup 4 digit terakhir
        years = re.findall(r'(\d{4})', nomor_full)
        tahun = ''
        for y in years:
            if 1945 <= int(y) <= 2026:
                tahun = y
                break
        if not tahun and years:
            tahun = years[-1]
        code = f"{short}-{num}-{tahun}"
        return code.strip('-')

    def _parse_row(self, row: Dict) -> Optional[Dict]:
        """Parse satu baris DataTables menjadi format aturan standar"""
        try:
            produk_id = str(row.get('17') or '').strip()
            if not produk_id:
                return None

            jenis = str(row.get('2') or '').strip()
            short = JENIS_TO_KODE.get(jenis, 'PRODUK')

            judul = str(row.get('3') or '').strip()
            nomor = str(row.get('1') or '').strip()
            status = str(row.get('5') or '').strip()
            subjek = str(row.get('4') or '').strip()
            tanggal = str(row.get('6') or '').strip()
            tanggal_penetapan = str(row.get('39') or '').strip()
            file_ids = str(row.get('13') or '').strip()
            instansi = str(row.get('35') or '').strip()

            rule_code = self._make_rule_code(row, short)
            publish_date = self._parse_date(tanggal) or self._parse_date(tanggal_penetapan)
            # Jika tahun pada rule_code tidak masuk akal, pakai tahun dari publish_date
            code_parts = rule_code.split('-')
            if len(code_parts) >= 3 and publish_date:
                year_part = code_parts[-1]
                if not year_part.isdigit() or not (1945 <= int(year_part) <= 2026):
                    code_parts[-1] = publish_date[:4]
                    rule_code = '-'.join(code_parts)
            pdf_url = None
            if file_ids:
                first_id = file_ids.split(',')[0].strip()
                if first_id.isdigit():
                    pdf_url = f"{BASE_URL}/download/?id={first_id}"

            regulation = {
                'produk_id': produk_id,
                'rule_code': rule_code,
                'title': judul,
                'regime': subjek or None,
                'category': jenis,
                'publish_date': publish_date,
                'pdf_url': pdf_url,
                'file_ids': file_ids,
                'source': 'jdih.slemankab.go.id',
                'is_active': status.lower() == 'berlaku' if status else True,
                'status': status,
                'instansi': instansi,
                'created_at': datetime.now().isoformat()
            }

            if not regulation['rule_code'] or not regulation['title']:
                logger.warning(f"Baris tidak valid: produk_id={produk_id}")
                return None

            if self.download_pdf and pdf_url and file_ids:
                self._download_pdf(pdf_url, rule_code, file_ids.split(',')[0].strip())

            return regulation

        except Exception as e:
            logger.error(f"Error parsing baris: {e}")
            return None

    def _download_pdf(self, url: str, rule_code: str, file_id: str) -> bool:
        """Download PDF utama dari URL download"""
        try:
            # File yang sama bisa dipakai beberapa peraturan; gunakan id file sebagai nama
            safe = f"{rule_code}_{file_id}"
            safe = ''.join(c for c in safe if c.isalnum() or c in ('-', '_')).rstrip()
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
            time.sleep(self.rate)
            return True

        except Exception as e:
            logger.error(f"Gagal mengunduh PDF {url}: {e}")
            return False

    def scrape(self) -> List[Dict]:
        """Jalankan scraping penuh"""
        if self.kategori:
            kats = [self.kategori]
        else:
            kats = list(KATEGORI.keys())

        all_regulations = []
        seen = set()

        for kat in kats:
            logger.info(f"Scraping kategori: {kat} ({KATEGORI.get(kat, ('?', '?') )[1]})")
            rows = self._fetch_all(kat)
            for row in rows:
                rule = self._parse_row(row)
                if rule:
                    key = rule['rule_code']
                    if key not in seen:
                        seen.add(key)
                        all_regulations.append(rule)
                    else:
                        # Duplikat rule_code (mis. nomor tahun sama) -> tambahkan produk_id
                        rule['rule_code'] = f"{rule['rule_code']}-{rule['produk_id']}"
                        all_regulations.append(rule)
            time.sleep(self.rate * 2)

        logger.info(f"Total peraturan berhasil di-scrape: {len(all_regulations)}")
        return all_regulations

    def save_to_json(self, regulations: List[Dict], filename: str):
        """Simpan data ke file JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(regulations, f, indent=2, ensure_ascii=False)
        logger.info(f"Data berhasil disimpan ke {filename}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='JDIH Sleman Scraper untuk produk hukum')
    parser.add_argument('--kategori', choices=list(KATEGORI.keys()),
                        help='Kategori spesifik (kosongkan untuk semua)')
    parser.add_argument('--output-dir', default='./pdf_raw',
                        help='Direktori untuk menyimpan file PDF')
    parser.add_argument('--output-json', default='sleman_rules.json',
                        help='File JSON untuk menyimpan hasil')
    parser.add_argument('--no-pdf', action='store_true',
                        help='Jangan mengunduh file PDF')
    parser.add_argument('--rate', type=float, default=1.0,
                        help='Jeda antar permintaan (detik)')

    args = parser.parse_args()

    try:
        scraper = JDIHSlemanScraper(
            kategori=args.kategori,
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
    except JDIHSlemanException as e:
        print(f"Error konfigurasi: {e}")
    except Exception as e:
        print(f"Error tak terduga: {e}")
