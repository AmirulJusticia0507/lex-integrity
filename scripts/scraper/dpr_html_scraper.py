# DPR HTML Scraper
# Mengambil data peraturan hukum dari DPR RI

import argparse
import asyncio
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('dpr_html_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
class DPRHTMLScraper:
    """Scraper untuk HTML DPR RI"""
    
    def __init__(self, jenis: str = 'UU', tahun: str = '2024', output_dir: str = "./pdf_raw"):
        self.jenis = jenis.upper()
        self.tahun = tahun
        self.output_dir = Path(output_dir)
        self.base_url = "https://www.dpr.go.id"
        self.session = None
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Kategori DPR
        self.kategori_map = {
            'UU': 'undang-undang',
            'PP': 'peraturan-pemerintah',
            'PERPRES': 'peraturan-presiden',
            'PERDA': 'peraturan-daerah'
        }
        
        if self.jenis not in self.kategori_map:
            raise ValueError(f"Jenis tidak valid: {jenis}. Pilihan: {list(self.kategori_map.keys())}")
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def scrape_peraturan(self) -> List[Dict]:
        """Scrape data peraturan dari DPR"""
        logger.info(f"Memulai scraping untuk {self.jenis} {self.tahun}")
        
        all_regulations = []
        
        # Dapatkan daftar kategori berdasarkan tahun
        years = self._parse_years()
        
        for tahun in years:
            try:
                regulations = await self._scrape_tahun(tahun)
                all_regulations.extend(regulations)
                logger.info(f"Berhasil mengambil {len(regulations)} peraturan untuk tahun {tahun}")
                
                # Rate limiting
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Gagal mengambil data untuk tahun {tahun}: {str(e)}")
                continue
        
        logger.info(f"Total peraturan berhasil di-scrape: {len(all_regulations)}")
        return all_regulations
    
    def _parse_years(self) -> List[str]:
        """Parse tahun dari string input"""
        if '-' in self.tahun:
            start, end = self.tahun.split('-')
            return [str(year) for year in range(int(start), int(end) + 1)]
        else:
            return [self.tahun]
    
    async def _scrape_tahun(self, tahun: str) -> List[Dict]:
        """Scrape data untuk satu tahun"""
        # URL untuk kategori tertentu
        kategori = self.kategori_map[self.jenis]
        url = f"{self.base_url}/dokumen/{kategori}/{tahun}/"
        
        async with self.session.get(url) as response:
            if response.status != 200:
                logger.warning(f"Tidak dapat mengakses {url}: {response.status}")
                return []
            
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            regulations = []
            
            # Cari daftar dokumen
            document_list = soup.find('div', class_='document-list') or soup.find('ul', class_='document-items')
            
            if document_list:
                items = document_list.find_all('li') or document_list.find_all('div', class_='document-item')
                for item in items:
                    try:
                        regulation = self._parse_item(item, tahun)
                        if regulation:
                            regulations.append(regulation)
                    except Exception as e:
                        logger.error(f"Error parsing item: {str(e)}")
                        continue
            
            return regulations
    
    def _parse_item(self, item, tahun: str) -> Optional[Dict]:
        """Parse satu item dokumen menjadi format standar"""
        try:
            # Ekstrak metadata
            title_element = item.find('h3') or item.find('h2') or item.find('a')
            link_element = item.find('a')
            
            if not title_element or not link_element:
                return None
            
            title = title_element.get_text(strip=True)
            pdf_url = link_element.get('href')
            
            if not pdf_url:
                return None
            
            # Buat rule_code
            rule_code = f"{self.jenis}-{tahun}"
            
            # Ekstrak nomor jika ada
            nomor_match = title.search(r'No\.\s*(\d+)\s*Tahun\s*(\d+)')
            if nomor_match:
                nomor = f"{nomor_match.group(1)} Tahun {nomor_match.group(2)}"
                rule_code = f"{self.jenis}-{nomor}"
            
            # Ekstrak periode pemerintahan
            regime = self._extract_regime_from_title(title)
            
            regulation = {
                'id': link_element.get('id') or f"dpr_{rule_code}",
                'rule_code': rule_code,
                'title': title,
                'regime': regime,
                'category': self.jenis,
                'publish_date': f"{tahun}-01-01",  # Estimasi, perlu parsing tanggal yang lebih baik
                'pdf_url': urljoin(self.base_url, pdf_url),
                'source': 'dpr',
                'created_at': datetime.now().isoformat()
            }
            
            return regulation
            
        except Exception as e:
            logger.error(f"Error parsing item: {str(e)}")
            return None
    
    def _extract_regime_from_title(self, title: str) -> str:
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
    
    def save_to_json(self, regulations: List[Dict], filename: str):
        """Simpan data peraturan ke file JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            import json
            json.dump(regulations, f, indent=2, ensure_ascii=False)
        logger.info(f"Data berhasil disimpan ke {filename}")
async def main():
    parser = argparse.ArgumentParser(description='DPR HTML Scraper untuk peraturan hukum Indonesia')
    parser.add_argument('--jenis', required=True, choices=['UU', 'PP', 'PERPRES', 'PERDA'],
                       help='Jenis peraturan (UU=Undang-Undang, PP=Peraturan Pemerintah, PERPRES=Peraturan Presiden, PERDA=Peraturan Daerah)')
    parser.add_argument('--tahun', default='2024',
                       help='Tahun atau rentang tahun (contoh: 2024, 2020-2024)')
    parser.add_argument('--output-dir', default='./pdf_raw',
                       help='Direktori untuk menyimpan file PDF yang diunduh')
    parser.add_argument('--output-json', default='dpr_regulations.json',
                       help='File JSON untuk menyimpan data yang di-scrape')
    
    args = parser.parse_args()
    
    try:
        async with DPRHTMLScraper(args.jenis, args.tahun, args.output_dir) as scraper:
            regulations = await scraper.scrape_peraturan()
            
            if regulations:
                scraper.save_to_json(regulations, args.output_json)
                print(f"Scraping selesai! {len(regulations)} peraturan disimpan ke {args.output_json}")
            else:
                print("Tidak ada data yang berhasil di-scrape")
                
    except Exception as e:
        print(f"Error tak terduga: {e}")
if __name__ == "__main__":
    asyncio.run(main())