#!/usr/bin/env python3
"""
JDIHN (Jaringan Dokumentasi dan Informasi Hukum Nasional) API Scraper
Mengambil data peraturan hukum dari Setneg, Kemenkumham, dan Pemprov
"""

import argparse
import json
import logging
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
        logging.FileHandler('jdih_api_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class JDIHAPIException(Exception):
    """Custom exception for JDIH API scraping errors"""
    pass


class JDIHAPIScraper:
    """Scraper untuk API JDIHN Setneg, Kemenkumham, dan Pemprov"""
    
    def __init__(self, instansi: str, pages: int = 10, output_dir: str = "./pdf_raw"):
        self.instansi = instansi.lower()
        self.pages = pages
        self.output_dir = Path(output_dir)
        self.session = self._create_session()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # API endpoints
        self.endpoints = {
            'setneg': 'https://jdih.setneg.go.id/api/v1/peraturan',
            'kemenkumham': 'https://jdih.kemenkumham.go.id/api/v1/peraturan',
            'pemprov': 'https://jdih.pemerintah.go.id/api/v1/peraturan'
        }
        
        if self.instansi not in self.endpoints:
            raise JDIHAPIException(f"Instansi tidak didukung: {instansi}. Pilihan: {list(self.endpoints.keys())}")
    
    def _create_session(self) -> requests.Session:
        """Buat session dengan retry policy"""
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
        
        # Set headers untuk meniru browser
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://jdih.setneg.go.id'
        })
        
        return session
    
    def scrape_peraturan(self) -> List[Dict]:
        """Scraping data peraturan dari API"""
        logger.info(f"Memulai scraping untuk instansi: {self.instansi}")
        
        all_regulations = []
        
        for page in range(1, self.pages + 1):
            try:
                regulations = self._fetch_page(page)
                all_regulations.extend(regulations)
                logger.info(f"Berhasil mengambil halaman {page}: {len(regulations)} peraturan")
                
                # Rate limiting
                import time
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"Gagal mengambil halaman {page}: {str(e)}")
                continue
        
        logger.info(f"Total peraturan berhasil di-scrape: {len(all_regulations)}")
        return all_regulations
    
    def _fetch_page(self, page: int) -> List[Dict]:
        """Ambil satu halaman data peraturan"""
        url = f"{self.endpoints[self.instansi]}?page={page}&limit=20"
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Ekstrak peraturan dari respons JSON
            regulations = []
            if 'data' in data:
                for item in data['data']:
                    regulation = self._parse_regulation(item)
                    if regulation:
                        regulations.append(regulation)
            
            return regulations
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error HTTP saat mengambil halaman {page}: {str(e)}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON dari halaman {page}: {str(e)}")
            raise
    
    def _parse_regulation(self, item: Dict) -> Optional[Dict]:
        """Parse satu item peraturan menjadi format standar"""
        try:
            # Ekstrak metadata
            regulation = {
                'id': item.get('id', ''),
                'rule_code': item.get('nomor', ''),
                'title': item.get('judul', ''),
                'regime': self._extract_regime(item.get('judul', '')),
                'category': self._extract_category(item.get('nomor', '')),
                'publish_date': item.get('tanggalTerbit', ''),
                'pdf_url': item.get('fileUrl', ''),
                'source': self.instansi,
                'created_at': datetime.now().isoformat()
            }
            
            # Validasi data wajib
            if not regulation['rule_code'] or not regulation['title']:
                logger.warning(f"Peraturan tidak valid: {item}")
                return None
            
            # Download PDF jika URL tersedia
            if regulation['pdf_url']:
                self._download_pdf(regulation['pdf_url'], regulation['rule_code'])
            
            return regulation
            
        except Exception as e:
            logger.error(f"Error parsing peraturan: {str(e)}")
            return None
    
    def _extract_regime(self, title: str) -> str:
        """Ekstrak periode pemerintahan dari judul"""
        title_lower = title.lower()
        
        if 'prabowo' in title_lower or '2024' in title_lower:
            return 'Prabowo Subianto'
        elif 'jokowi' in title_lower or '2019' in title_lower or '2014' in title_lower:
            return 'Jokowi'
        elif 'sby' in title_lower or '2009' in title_lower or '2004' in title_lower:
            return 'SBY'
        elif 'megawati' in title_lower or '2001' in title_lower or '1999' in title_lower:
            return 'Megawati'
        elif 'reformas' in title_lower:
            return 'Reformasi'
        elif 'orde baru' in title_lower:
            return 'Orde Baru'
        elif '1945' in title_lower or 'pra-kemerdekaan' in title_lower:
            return 'Awal Kemerdekaan'
        else:
            return 'Lainnya'
    
    def _extract_category(self, rule_code: str) -> str:
        """Ekstrak kategori (UU, PP, Perpres, Perda) dari kode peraturan"""
        if rule_code.startswith('UU '):
            return 'UU'
        elif rule_code.startswith('PP '):
            return 'PP'
        elif rule_code.startswith('Perpres '):
            return 'Perpres'
        elif rule_code.startswith('Perda '):
            return 'Perda'
        elif rule_code.startswith('Permen '):
            return 'Permen'
        else:
            return 'Lainnya'
    
    def _download_pdf(self, url: str, filename: str) -> bool:
        """Download PDF dari URL"""
        try:
            response = self.session.get(url, timeout=60)
            response.raise_for_status()
            
            # Sanitize filename
            safe_filename = ''.join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()
            filepath = self.output_dir / f"{safe_filename}.pdf"
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"PDF berhasil diunduh: {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"Gagal mengunduh PDF {url}: {str(e)}")
            return False
    
    def save_to_json(self, regulations: List[Dict], filename: str):
        """Simpan data peraturan ke file JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(regulations, f, indent=2, ensure_ascii=False)
        logger.info(f"Data berhasil disimpan ke {filename}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='JDIHN API Scraper untuk peraturan hukum Indonesia')
    parser.add_argument('--instansi', required=True, choices=['setneg', 'kemenkumham', 'pemprov'],
                       help='Instansi sumber data')
    parser.add_argument('--pages', type=int, default=10,
                       help='Jumlah halaman yang akan diambil')
    parser.add_argument('--output-dir', default='./pdf_raw',
                       help='Direktori untuk menyimpan file PDF yang diunduh')
    parser.add_argument('--output-json', default='regulations.json',
                       help='File JSON untuk menyimpan data yang di-scrape')
    
    args = parser.parse_args()
    
    try:
        scraper = JDIHAPIScraper(args.instansi, args.pages, args.output_dir)
        regulations = scraper.scrape_peraturan()
        
        if regulations:
            scraper.save_to_json(regulations, args.output_json)
            print(f"Scraping selesai! {len(regulations)} peraturan disimpan ke {args.output_json}")
        else:
            print("Tidak ada data yang berhasil di-scrape")
            
    except JDIHAPIException as e:
        print(f"Error konfigurasi: {e}")
    except Exception as e:
        print(f"Error tak terduga: {e}")
