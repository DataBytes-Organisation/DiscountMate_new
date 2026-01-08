"""
Multi-Store Catalogue Scraper
Downloads catalogue images from Australian retailers with proper tracking and backup

Key Features:
- Extracts catalogue_on_sale_date from slug/title
- Separate scraped_date tracking
- Full backup before refresh (images + tracking files)
- Update mode: only downloads new catalogues
- Custom mode: saves to separate dated folder

In line with current Deakin University guidelines(Accessed 09/12/2025):
https://www.deakin.edu.au/students/study-support/study-resources/artificial-intelligence/acknowledging-your-use

This component was developed with the assistance of 'Claude Sonnet 4.5' (via GitHub Copilot Pro Education License) for code scaffolding, refactoring, and productionisation tasks.

The author contributed and is responsible for:
- URL pattern investigation and parsing logic
- Architectural design of the scraping pipeline
- Development of the tracking CSV mechanism, including update modes and backup provisions
- Integration, testing, reliability improvements, and validation against live data
- All decision-making regarding process design and operational logic

All submitted code and documentation are supplied as open source and intended for extension and review by future student cohorts.
"""

import sys
import requests
import urllib3
import json
import os
import re
import shutil
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional
import random
import time
import logging
from pathlib import Path

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def setup_logging():
    """Setup logging to file"""
    log_dir = Path('catalogue_data/logs')
    log_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = log_dir / f'scraper_log_{timestamp}.txt'
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            # logging.StreamHandler()  # Uncomment if you want console logs as well
        ]
    )
    return logging.getLogger(__name__)


class CatalogueDateParser:
    """
    Parse catalogue sale dates from title and slug strings
    Examples: 
    - "weekly-woolworths-catalogue-november-25-december-2-2025-vic"
    - "weekly-woolworths-catalogue-november-12-18-2025-sa"
    """
    
    MONTH_MAP = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }
    
    @classmethod
    def extract_date_from_slug(cls, slug: str) -> Optional[str]:
        """
        Extract date from catalogue slug
        Returns: YYYY-MM-DD format or None
        """
        if not slug:
            return None
        
        for month_name, month_num in cls.MONTH_MAP.items():
            if month_name in slug.lower():
                # Pattern: month-DD-YYYY or month-DD-DD-YYYY
                pattern = rf'{month_name}-(\d{{1,2}})-(?:\d{{1,2}}-)?(\d{{4}})'
                match = re.search(pattern, slug.lower())
                
                if match:
                    day = match.group(1).zfill(2)
                    year = match.group(2)
                    return f"{year}-{month_num}-{day}"
        
        return None


class BackupManager:
    """
    Handles full folder and file backup before refresh operations
    """
    
    @staticmethod
    def backup_folder_structure(source_folder: str) -> Optional[str]:
        """
        Create full backup of folder with timestamp
        Returns: backup folder path or None if source doesn't exist
        """
        if not os.path.exists(source_folder):
            logging.info(f"No existing folder to backup: {source_folder}")
            return None
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_folder = f"{source_folder}_backup_{timestamp}"
        
        logging.info(f"Creating full backup from {source_folder} to {backup_folder}")
        
        try:
            shutil.copytree(source_folder, backup_folder)
            file_count = sum([len(files) for r, d, files in os.walk(backup_folder)])
            logging.info(f"Backup SUCCESS - Backed up {file_count} files")
            return backup_folder
        except Exception as e:
            logging.error(f"Backup ERROR: {str(e)}")
            return None
    
    @staticmethod
    def backup_tracking_file(file_path: str) -> Optional[str]:
        """
        Create backup of tracking CSV/JSON file
        Returns: backup file path or None
        """
        if not os.path.exists(file_path):
            logging.info(f"No existing tracking file to backup: {file_path}")
            return None
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = f"{file_path}.backup_{timestamp}"
        
        try:
            shutil.copy2(file_path, backup_path)
            logging.info(f"Tracking file backed up: {backup_path}")
            return backup_path
        except Exception as e:
            logging.error(f"ERROR backing up tracking file: {str(e)}")
            return None


class CatalogueDatabase:
    """
    Handles catalogue tracking data storage
    Supports CSV and JSON (MongoDB is not used in this version)
    """
    
    def __init__(self, storage_type='csv', base_path='catalogue_data'):
        self.storage_type = storage_type
        self.base_path = base_path
        self.csv_file = os.path.join(base_path, 'catalogue_tracking.csv')
        self.json_file = os.path.join(base_path, 'catalogue_tracking.json')
        
        os.makedirs(base_path, exist_ok=True)
    
    def load_existing_records(self) -> pd.DataFrame:
        """
        Load existing catalogue records from storage
        """
        if self.storage_type == 'csv':
            if os.path.exists(self.csv_file):
                logging.info(f"Loading records from {self.csv_file}")
                return pd.read_csv(self.csv_file)
            else:
                logging.info("No existing CSV found - starting fresh")
                return pd.DataFrame()
        
        elif self.storage_type == 'json':
            if os.path.exists(self.json_file):
                logging.info(f"Loading records from {self.json_file}")
                with open(self.json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return pd.DataFrame(data)
            else:
                logging.info("No existing JSON found - starting fresh")
                return pd.DataFrame()
        
        # Fallback: treat unknown types as CSV
        logging.warning(f"Unknown storage_type '{self.storage_type}', falling back to CSV")
        if os.path.exists(self.csv_file):
            return pd.read_csv(self.csv_file)
        return pd.DataFrame()
    
    def save_records(self, df: pd.DataFrame, backup=False):
        """
        Save catalogue records to storage
        """
        if backup:
            BackupManager.backup_tracking_file(self.csv_file)
            BackupManager.backup_tracking_file(self.json_file)
        
        # Save CSV
        if self.storage_type in ['csv', 'json']:
            df.to_csv(self.csv_file, index=False)
            logging.info(f"Saved {len(df)} records to {self.csv_file}")
        
        # Save JSON (optional)
        if self.storage_type == 'json':
            records = df.to_dict('records')
            with open(self.json_file, 'w', encoding='utf-8') as f:
                json.dump(records, f, indent=2, ensure_ascii=False)
            logging.info(f"Saved {len(df)} records to {self.json_file}")


class CatalogueMetadataTracker:
    """
    Tracks catalogue metadata with enhanced date extraction
    """
    
    def __init__(self):
        self.catalogues = []
    
    def parse_catalogue_metadata(self, raw_cat: Dict) -> Dict:
        """
        Extract and normalize catalogue metadata
        Now includes catalogue_on_sale_date and scraped_date
        """
        title = raw_cat.get('title', '')
        slug = raw_cat.get('slug', '')
        store = raw_cat.get('store_slug', 'unknown')
        
        # Extract year from title
        year_match = re.search(r'20\d{2}', title)
        year = year_match.group() if year_match else 'Unknown'
        
        # Extract state from title
        state_pattern = r'\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b'
        state_match = re.search(state_pattern, title, re.IGNORECASE)
        state = state_match.group().upper() if state_match else 'Multi-State'
        
        # Extract catalogue sale date from slug
        catalogue_on_sale_date = CatalogueDateParser.extract_date_from_slug(slug)
        if not catalogue_on_sale_date:
            start_timestamp = raw_cat.get('start_date', '')
            if start_timestamp and str(start_timestamp).isdigit():
                catalogue_on_sale_date = datetime.fromtimestamp(int(start_timestamp)).strftime('%Y-%m-%d')
            else:
                catalogue_on_sale_date = 'Unknown'
        
        return {
            'store': store,
            'title': title,
            'slug': slug,
            'year': year,
            'state': state,
            'catalogue_on_sale_date': catalogue_on_sale_date,
            'scraped_date': None,  # set when actually scraped
            'page_count': int(raw_cat.get('page_count', 0)),
            'pages_downloaded': 0,
            'downloaded': False,
            'id': raw_cat.get('id', '')
        }
    
    def load_from_api_data(self, api_catalogues: List[Dict]):
        """
        Convert API data into tracking records
        """
        logging.info(f"Processing {len(api_catalogues)} catalogues from API")
        
        for cat in api_catalogues:
            parsed = self.parse_catalogue_metadata(cat)
            self.catalogues.append(parsed)
        
        logging.info(f"Processed {len(self.catalogues)} catalogues")
    
    def to_dataframe(self) -> pd.DataFrame:
        """
        Convert to pandas DataFrame
        """
        return pd.DataFrame(self.catalogues)
    
    def merge_with_existing(self, existing_df: pd.DataFrame) -> pd.DataFrame:
        """
        Merge new API data with existing download records
        Preserves download history
        """
        new_df = self.to_dataframe()
        
        if existing_df.empty:
            return new_df
        
        merged = new_df.merge(
            existing_df[['slug', 'downloaded', 'scraped_date', 'pages_downloaded']],
            on='slug',
            how='left',
            suffixes=('', '_existing')
        )
        
        # Preserve existing download info
        merged['downloaded'] = merged['downloaded_existing'].fillna(merged['downloaded'])
        merged['scraped_date'] = merged['scraped_date_existing'].fillna(merged['scraped_date'])
        merged['pages_downloaded'] = merged['pages_downloaded_existing'].fillna(merged['pages_downloaded'])
        
        # Remove duplicate columns
        merged = merged[[col for col in merged.columns if not col.endswith('_existing')]]
        
        return merged


class CatalogueDownloader:
    """
    Downloads catalogue page images from CDN
    """
    
    def __init__(self, output_folder='catalogues'):
        self.output_folder = output_folder
        self.cdn_base = "https://caau.syd1.cdn.digitaloceanspaces.com/wp-content/uploads/catalogue"
        
        self.session = requests.Session()
        self.session.verify = False
    
    def fetch_catalogues_from_api(self, store: str, years: List[int]) -> List[Dict]:
        """
        Fetch catalogue metadata from catalogueau.com API
        """
        logging.info(f"Fetching {store.upper()} catalogues...")
        
        base_api = "https://www.catalogueau.com/api/web/catalogue/v1.php"
        all_catalogues = []
        
        for year in years:
            api_url = f"{base_api}?get=archive&store={store}&year={year}&v1"
            
            try:
                response = self.session.get(api_url, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if isinstance(data, list) and len(data) > 0:
                        for cat in data:
                            cat['store_slug'] = store
                        all_catalogues.extend(data)
                        logging.info(f"API {year}: {len(data)} catalogues")
                    else:
                        logging.info(f"API {year}: No catalogues found")
                else:
                    logging.warning(f"API {year}: HTTP {response.status_code}")
            except Exception as e:
                logging.error(f"API {year}: Error - {str(e)[:60]}")
        
        logging.info(f"API Total: {len(all_catalogues)} catalogues")
        return all_catalogues
    
    def download_single_catalogue(self, catalogue: Dict) -> Dict:
        """
        Download all pages from a single catalogue
        Folder structure: store/year/catalogue_slug/page_001.jpg
        """
        store = catalogue['store']
        slug = catalogue['slug']
        title = catalogue['title']
        year = catalogue['year']
        expected_pages = catalogue['page_count']
        
        catalogue_folder = os.path.join(
            self.output_folder,
            store,
            year,
            slug
        )
        os.makedirs(catalogue_folder, exist_ok=True)
        
        logging.info(
            f"DOWNLOAD START: {title} | Store: {store} | Year: {year} | "
            f"Expected pages: {expected_pages} | Folder: {catalogue_folder}"
        )
        
        base_url = f"{self.cdn_base}/{store}/{slug}"
        
        downloaded = 0
        failed_pages = []
        page_num = 1
        consecutive_failures = 0
        max_failures = 3
        
        while True:
            image_url = f"{base_url}/{page_num}.jpg"
            output_path = os.path.join(catalogue_folder, f"page_{page_num:03d}.jpg")
            
            if os.path.exists(output_path):
                logging.info(f"Page {page_num} exists - skipping")
                downloaded += 1
                page_num += 1
                consecutive_failures = 0
                continue
            
            try:
                response = self.session.get(image_url, timeout=30)
                
                if response.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    
                    downloaded += 1
                    consecutive_failures = 0
                    
                    if downloaded % 10 == 0:
                        logging.info(f"Progress: {downloaded}/{expected_pages} pages")
                
                elif response.status_code == 404:
                    logging.info(f"Page {page_num} not found (404) - end of catalogue")
                    break
                else:
                    logging.warning(f"Page {page_num} - HTTP {response.status_code}")
                    failed_pages.append(page_num)
                    consecutive_failures += 1
            
            except Exception as e:
                logging.error(f"Page {page_num} - Error: {str(e)[:80]}")
                failed_pages.append(page_num)
                consecutive_failures += 1
            
            if consecutive_failures >= max_failures:
                logging.warning(f"Stopped after {consecutive_failures} consecutive failures")
                break
            
            if expected_pages > 0 and downloaded >= expected_pages:
                break
            
            page_num += 1
        
        metadata = {
            **catalogue,
            'downloaded': True,
            'scraped_date': datetime.now().isoformat(),
            'pages_downloaded': downloaded,
            'failed_pages': failed_pages
        }
        
        metadata_path = os.path.join(catalogue_folder, 'metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logging.info(
            f"DOWNLOAD COMPLETE! Downloaded {downloaded} pages"
            + (f" | Failed pages: {len(failed_pages)}" if failed_pages else "")
        )
        
        return {
            'slug': slug,
            'success': True,
            'pages_downloaded': downloaded,
            'failed_pages': failed_pages
        }


def get_user_configuration():
    """
    Interactive prompts for user selections
    """
    print("\n" + "="*70)
    print("CATALOGUE SCRAPER - CONFIGURATION")
    print("="*70 + "\n")
    
    available_stores = {
        'woolworths': 'Woolworths',
        'coles': 'Coles',
        'aldi': 'Aldi',
        'iga': 'IGA',
    }
    
    print("Available stores:")
    for slug, name in available_stores.items():
        print(f"  - {name} ({slug})")
    
    # Store selection
    print("\n[INPUT] SELECT STORES:")
    print("  Enter store slugs separated by commas (e.g., woolworths,coles,aldi)")
    print("  Or type 'all' for all stores")
    store_input = input("\n  Your selection: ").strip().lower()
    
    if store_input == 'all':
        selected_stores = list(available_stores.keys())
    else:
        selected_stores = [s.strip() for s in store_input.split(',') if s.strip() in available_stores]
    
    if not selected_stores:
        print("  [ERROR] No valid stores selected")
        return None
    
    print(f"  [SELECTED] {', '.join([available_stores[s] for s in selected_stores])}")
    
    # Year selection
    print("\n[INPUT] SELECT YEARS:")
    print("  Enter years separated by commas (e.g., 2023,2024,2025)")
    print("  Or type 'all' for all years (2020-2025)")
    year_input = input("\n  Your selection: ").strip().lower()
    
    if year_input == 'all':
        selected_years = list(range(2020, 2026))
    else:
        try:
            selected_years = [int(y.strip()) for y in year_input.split(',')]
        except Exception:
            print("  [ERROR] Invalid year format")
            return None
    
    print(f"  [SELECTED] Years: {', '.join(map(str, selected_years))}")
    
    # Mode selection
    print("\n[INPUT] SELECT MODE:")
    print("  1. Update only (download new catalogues)")
    print("  2. Refresh all (re-download everything with backup)")
    print("  3. Custom selection (saves to separate folder)")
    mode_input = input("\n  Your selection (1/2/3): ").strip()
    
    mode = 'update'
    if mode_input == '2':
        confirm = input("\n  [CONFIRM] This will backup and re-download all catalogues. Continue? (yes/no): ").strip().lower()
        if confirm == 'yes':
            mode = 'refresh'
        else:
            print("  [CANCELLED] Refresh operation cancelled")
            return None
    elif mode_input == '3':
        mode = 'custom'
        print("  [INFO] Custom mode - will save to separate dated folder")
    
    # Storage type
    print("\n[INPUT] SELECT STORAGE TYPE:")
    print("  1. CSV")
    print("  2. JSON")
    storage_input = input("\n  Your selection (1/2): ").strip()
    
    storage_map = {'1': 'csv', '2': 'json'}
    storage_type = storage_map.get(storage_input, 'csv')
    
    print(f"  [SELECTED] Storage type: {storage_type.upper()}")
    
    return {
        'stores': selected_stores,
        'years': selected_years,
        'mode': mode,
        'storage_type': storage_type
    }


def get_automated_configuration():
    """
    Automated configuration for Docker/scheduled runs
    Downloads only NEW catalogues (update mode) using CSV storage
    """
    available_stores = ['woolworths', 'coles', 'aldi', 'iga']

    current_year = datetime.now().year
    end_year = current_year + 1  # Include next year for early releases
    
    config = {
        'stores': available_stores,
        'years': list(range(2020, end_year + 1)),
        'mode': 'update',
        'storage_type': 'csv'  # CSV for automated runs
    }
    
    print("\n" + "="*70)
    print("AUTOMATED CONFIGURATION - UPDATE MODE")
    print("="*70)
    print(f"  Stores: {', '.join(config['stores'])}")
    print(f"  Years: {', '.join(map(str, config['years']))} (auto: 2020-{end_year})")
    print(f"  Mode: Update (new catalogues only)")
    print(f"  Storage: CSV")
    print("="*70 + "\n")
    
    return config


def main():
    """
    Main execution function
    """
    logger = setup_logging()
    logger.info("="*70)
    logger.info("MULTI-STORE CATALOGUE SCRAPER - SESSION START")
    logger.info("="*70)
    
    print("\n" + "="*70)
    print("MULTI-STORE CATALOGUE SCRAPER")
    print("="*70)
    
    if '--automated' in sys.argv or '--update-only' in sys.argv:
        config = get_automated_configuration()
    else:
        config = get_user_configuration()
    
    if not config:
        print("\n[ERROR] Configuration failed - exiting")
        logger.error("Configuration failed - exiting")
        return
    
    automated_run = ('--automated' in sys.argv) or ('--update-only' in sys.argv)
    
    logger.info(
        f"Configuration: Stores={config['stores']}, Years={config['years']}, "
        f"Mode={config['mode']}, Storage={config['storage_type']}"
    )
    
    # Determine output folder based on mode
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if config['mode'] == 'custom':
        output_folder = os.path.join(script_dir, f"customDL_{datetime.now().strftime('%Y%m%d')}")
        print(f"\n[INFO] Custom mode - output folder: {output_folder}")
        logger.info(f"Custom mode - output folder: {output_folder}")
    else:
        output_folder = os.path.join(script_dir, 'catalogues')
    
    db = CatalogueDatabase(
        storage_type=config['storage_type'],
        base_path=os.path.join(script_dir, 'catalogue_data')
    )
    
    downloader = CatalogueDownloader(output_folder=output_folder)
    tracker = CatalogueMetadataTracker()
    
    # Refresh mode backups
    if config['mode'] == 'refresh':
        print("\n" + "="*70)
        print("BACKUP PROCESS - REFRESH MODE")
        print("="*70)
        logger.info("BACKUP PROCESS - REFRESH MODE")
        
        BackupManager.backup_folder_structure(output_folder)
        BackupManager.backup_tracking_file(db.csv_file)
        BackupManager.backup_tracking_file(db.json_file)
    
    # Load existing records
    if config['mode'] == 'refresh':
        existing_df = pd.DataFrame()
        print("\n[INFO] Refresh mode - starting with clean slate")
        logger.info("Refresh mode - starting with clean slate")
    else:
        existing_df = db.load_existing_records()
    
    # Fetch from API
    print("\n" + "="*70)
    print("FETCHING CATALOGUE METADATA FROM API")
    print("="*70)
    logger.info("FETCHING CATALOGUE METADATA FROM API")
    
    all_api_catalogues = []
    for store in config['stores']:
        store_catalogues = downloader.fetch_catalogues_from_api(store, config['years'])
        all_api_catalogues.extend(store_catalogues)
    
    tracker.load_from_api_data(all_api_catalogues)
    
    df = tracker.merge_with_existing(existing_df)
    
    # Filter by mode
    if config['mode'] == 'update':
        to_download = df[df['downloaded'] != True]
        print(f"\n[INFO] Found {len(to_download)} new catalogues to download")
        logger.info(f"Found {len(to_download)} new catalogues to download")
    elif config['mode'] == 'refresh':
        to_download = df
        print(f"\n[INFO] Will refresh all {len(to_download)} catalogues")
        logger.info(f"Will refresh all {len(to_download)} catalogues")
    else:
        to_download = df
        print(f"\n[INFO] Custom mode - {len(to_download)} catalogues available")
        logger.info(f"Custom mode - {len(to_download)} catalogues available")
    
    if len(to_download) == 0:
        print("\n[INFO] All catalogues are up to date")
        logger.info("All catalogues are up to date")
        return
    
    # Confirmation (automated vs interactive)
    if automated_run:
        print(f"\n[INFO] Automated run - proceeding to download {len(to_download)} catalogues without prompt")
        logger.info(f"Automated run - proceeding to download {len(to_download)} catalogues without prompt")
    else:
        print(f"\n[CONFIRM] About to download {len(to_download)} catalogues")
        confirm = input("  Continue? (yes/no): ").strip().lower()
        
        if confirm != 'yes':
            print("\n[CANCELLED] Download cancelled")
            logger.info("Download cancelled by user")
            return
    
    # Download
    print("\n" + "="*70)
    print("DOWNLOADING CATALOGUES")
    print("="*70)
    logger.info("DOWNLOADING CATALOGUES - START")
    
    total_catalogues = len(to_download)
    progress_interval = max(1, total_catalogues // 20)  # 5% steps
    
    for idx, (_, catalogue) in enumerate(to_download.iterrows(), 1):
        logger.info(f"[{idx}/{total_catalogues}] {catalogue['store'].upper()} - {catalogue['title']}")
        
        if idx % progress_interval == 0 or idx == total_catalogues:
            progress_pct = (idx / total_catalogues) * 100
            print(f"Progress: {progress_pct:.0f}% ({idx}/{total_catalogues} catalogues)")
        
        try:
            result = downloader.download_single_catalogue(catalogue.to_dict())
            
            df.loc[df['slug'] == catalogue['slug'], 'downloaded'] = True
            df.loc[df['slug'] == catalogue['slug'], 'scraped_date'] = datetime.now().isoformat()
            df.loc[df['slug'] == catalogue['slug'], 'pages_downloaded'] = result['pages_downloaded']
            
            db.save_records(df, backup=False)
        
        except Exception as e:
            logger.error(f"Critical error for {catalogue['slug']}: {str(e)}")
            continue
    
    # Final save with backup
    db.save_records(df, backup=True)
    
    print("\n" + "="*70)
    print("DOWNLOAD COMPLETE")
    print("="*70)
    
    downloaded_count = len(df[df['downloaded'] == True])
    total_pages = df[df['downloaded'] == True]['pages_downloaded'].sum()
    
    print(f"\nSummary:")
    print(f"  Total catalogues: {len(df)}")
    print(f"  Downloaded: {downloaded_count}")
    print(f"  Total pages: {total_pages:,}")
    print(f"\nFiles saved to:")
    print(f"  Catalogues: {os.path.abspath(output_folder)}/")
    print(f"  Tracking data: {os.path.abspath(db.base_path)}/")
    
    logger.info(
        f"DOWNLOAD COMPLETE - Total: {len(df)}, "
        f"Downloaded: {downloaded_count}, Pages: {total_pages:,}"
    )
    logger.info(f"Files saved to: Catalogues={os.path.abspath(output_folder)}, Tracking={os.path.abspath(db.base_path)}")
    logger.info("="*70)
    logger.info("SESSION END")
    logger.info("="*70)


if __name__ == "__main__":
    main()
