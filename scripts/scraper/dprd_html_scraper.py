# DPRD HTML Scraper
# Mengambil data peraturan hukum dari DPRD Provinsi di Indonesia

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
        logging.FileHandler('dprd_html_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Daftar DPRD Provinsi di Indonesia
PROVINCES = {
    'jawa_barat': {
        'name': 'Jawa Barat',
        'base_url': 'https://jdprd.jabarprov.go.id',
        'kategori': 'perda'
    },
    'jawa_tengah': {
        'name': 'Jawa Tengah', 
        'base_url': 'https://jdprd.jatengprov.go.id',
        'kategori': 'perda'
    },
    'jawa_timur': {
        'name': 'Jawa Timur',
        'base_url': 'https://jdprd.jatimprov.go.id',
        'kategori': 'perda'
    },
    'sumatera_utara': {
        'name': 'Sumatera Utara',
        'base_url': 'https://www.dprd.sumutprov.go.id',
        'kategori': 'perda'
    },
    'sumatera_selatan': {
        'name': 'Sumatera Selatan',
        'base_url': 'https://www.dprd-sumselprov.go.id',
        'kategori': 'perda'
    },
    'bali': {
        'name': 'Bali',
        'base_url': 'https://dprd.baliprov.go.id',
        'kategori': 'perda'
    }
}
class DPRDHTMLScraper:
    """Scraper untuk HTML DPRD Provinsi"""
    
    def __init__(self, provinsi: str, tahun: str = '2024', output_dir: str = "./pdf_raw"):
        if provinsi not in PROVINCES:
            raise ValueError(f"Provinsi tidak valid: {provinsi}. Pilihan: {list(PROVINCES.keys())}")
        
        self.provinsi = provinsi
        self.province_info = PROVINCES[provinsi]
        self.tahun = tahun
        self.output_dir = Path(output_dir)
        self.base_url = self.province_info['base_url']
        self.session = None
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
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
        """Scrape data peraturan dari DPRD"""
        logger.info(f"Memulai scraping untuk {self.province_info['name']} tahun {self.tahun}")
        
        all_regulations = []
        
        # Dapatkan daftar kategori
        categories = self._get_categories()
        
        for kategori in categories:
            try:
                regulations = await self._scrape_kategori(kategori)
                all_regulations.extend(regulations)
                logger.info(f"Berhasil mengambil {len(regulations)} peraturan dari kategori {kategori}")
                
                # Rate limiting
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Gagal mengambil data dari kategori {kategori}: {str(e)}")
                continue
        
        logger.info(f"Total peraturan berhasil di-scrape: {len(all_regulations)}")
        return all_regulations
    
    def _get_categories(self) -> List[str]:
        """Dapatkan daftar kategori berdasarkan provinsi"""
        provinsi = self.province_info['kategori']
        return [provinsi]
    
    async def _scrape_kategori(self, kategori: str) -> List[Dict]:
        """Scrape data untuk satu kategori"""
        # Buat URL pagination
        url = f"{self.base_url}/peraturan/{kategori}/tahun/{self.tahun}/"
        
        async with self.session.get(url) as response:
            if response.status != 200:
                logger.warning(f"Tidak dapat mengakses {url}: {response.status}")
                return []
            
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            regulations = []
            
            # Cari daftar dokumen
            document_list = soup.find('div', class_='peraturan-list') or soup.find('div', class_='card-list')
            
            if document_list:
                items = document_list.find_all('div', class_='peraturan-item') or document_list.find_all('article')
                for item in items:
                    try:
                        regulation = self._parse_item(item)
                        if regulation:
                            regulations.append(regulation)
                    except Exception as e:
                        logger.error(f"Error parsing item: {str(e)}")
                        continue
            
            # Periksa pagination
            next_page = self._find_next_page(soup)
            if next_page:
                next_regulations = await self._scrape_page(next_page)
                regulations.extend(next_regulations)
            
            return regulations
    
    def _parse_item(self, item) -> Optional[Dict]:
        """Parse satu item peraturan menjadi format standar"""
        try:
            # Ekstrak metadata
            title_element = item.find('h3') or item.find('h4') or item.find('a')
            link_element = item.find('a')
            date_element = item.find('time') or item.find('.tanggal') or item.find('.date')
            
            if not title_element or not link_element:
                return None
            
            title = title_element.get_text(strip=True)
            pdf_url = link_element.get('href')
            date_text = date_element.get_text(strip=True) if date_element else None
            
            if not pdf_url:
                return None
            
            # Parse tanggal
            publish_date = self._parse_date(date_text) if date_text else f"{self.tahun}-01-01"
            
            # Buat rule_code
            tahun = publish_date[:4] if publish_date else self.tahun
            nomor_match = title.search(r'No\.\s*(\d+)\s*Tahun\s*(\d+)')
            
            if nomor_match:
                nomor = f"{nomor_match.group(1)} Tahun {nomor_match.group(2)}"
                rule_code = f"PERDA-{nomor}"
            else:
                rule_code = f"PERDA-{tahun}-01"
            
            # Ekstrak periode pemerintahan
            regime = self._extract_regime_from_title(title)
            
            regulation = {
                'id': link_element.get('id') or f"{self.provinsi}_{rule_code}",
                'rule_code': rule_code,
                'title': title,
                'regime': regime,
                'category': 'PERDA',
                'publish_date': publish_date,
                'pdf_url': urljoin(self.base_url, pdf_url),
                'source': self.provinsi,
                'created_at': datetime.now().isoformat()
            }
            
            return regulation
            
        except Exception as e:
            logger.error(f"Error parsing item: {str(e)}")
            return None
    
    def _parse_date(self, date_text: str) -> str:
        """Parse string tanggal ke format YYYY-MM-DD"""
        # Implementasi parsing tanggal yang lebih baik
        # Untuk saat ini, kembalikan tahun saja
        return f"{self.tahun}-01-01"
    
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
    
    def _find_next_page(self, soup) -> Optional[str]:
        """Cari link halaman berikutnya"""
        next_link = soup.find('a', rel='next') or soup.find('a', class_='next')
        if next_link and next_link.get('href'):
            return urljoin(self.base_url, next_link['href'])
        return None
    
    async def _scrape_page(self, url: str) -> List[Dict]:
        """Scrape satu halaman"""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    return []
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                regulations = []
                document_list = soup.find('div', class_='peraturan-list') or soup.find('div', class_='card-list')
                
                if document_list:
                    items = document_list.find_all('div', class_='peraturan-item') or document_list.find_all('article')
                    for item in items:
                        regulation = self._parse_item(item)
                        if regulation:
                            regulations.append(regulation)
                
                await asyncio.sleep(0.5)  # Rate limiting
                return regulations
                
        except Exception as e:
            logger.error(f"Error scraping page {url}: {str(e)}")
            return []
    
    def save_to_json(self, regulations: List[Dict], filename: str):
        """Simpan data peraturan ke file JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            import json
            json.dump(regulations, f, indent=2, ensure_ascii=False)
        logger.info(f"Data berhasil disimpan ke {filename}")
async def main():
    parser = argparse.ArgumentParser(description='DPRD HTML Scraper untuk peraturan daerah Indonesia')
    parser.add_argument('--provinsi', required=True, choices=list(PROVINCES.keys()),
                       help='Provinsi sumber data (contoh: jawa_barat, jawa_tengah, jawa_timur)')
    parser.add_argument('--tahun', default='2024',
                       help='Tahun atau rentang tahun (contoh: 2024, 2020-2024)')
    parser.add_argument('--output-dir', default='./pdf_raw',
                       help='Direktori untuk menyimpan file PDF yang diunduh')
    parser.add_argument('--output-json', default='dprd_regulations.json',
                       help='File JSON untuk menyimpan data yang di-scrape')
    
    args = parser.parse_args()
    
    try:
        async with DPRDHTMLScraper(args.provinsi, args.tahun, args.output_dir) as scraper:
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