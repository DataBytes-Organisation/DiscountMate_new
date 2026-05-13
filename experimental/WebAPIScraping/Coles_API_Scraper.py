import requests
import json
import time
import pandas as pd
from datetime import datetime
import os
from dotenv import load_dotenv
import random
import re

# Load environment variables from .env file
from dotenv import load_dotenv
# run as: DiscountMate_Clone\DiscountMate_new>python experimental\WebAPIScraping\Coles_API_Scraper.py 
# ------------------------------------------------------------
# PATH SETUP (script + repo root detection)
# ------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def find_repo_root(start_path):
    """Walk up folders until .git is found (repo root)"""
    path = start_path
    while True:
        if os.path.exists(os.path.join(path, ".git")):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            return start_path
        path = parent

REPO_ROOT = find_repo_root(SCRIPT_DIR)

# ------------------------------------------------------------
# LOAD .ENV FROM REPO ROOT
# ------------------------------------------------------------

ENV_PATH = os.path.join(REPO_ROOT, ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY")
# store the scraper API key in root .env similar to this (this is a mock/madeup key):
#SCRAPERAPI_KEY = soyb854643gighg9358674hfhf7857463hfgsfsvf9584743a4  # deakin central scraperAPI Key

if not SCRAPERAPI_KEY:
    raise RuntimeError(
        "SCRAPERAPI_KEY not found. Add it to repo-root .env as:\n"
        "SCRAPERAPI_KEY=your_key_here"
    )

# ------------------------------------------------------------
# DATA PATHS
# ------------------------------------------------------------

BRANDS_CSV_PATH = os.path.join(
    REPO_ROOT,
    "Master_Data_2026_Onward",
    "MajorBrandsforSearchAPI_optimal.csv"
)

# Output folder next to script
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

CHECKPOINT_FILE = os.path.join(OUTPUT_DIR, "coles_checkpoint.csv")
PROGRESS_FILE = os.path.join(OUTPUT_DIR, "coles_progress.json")

# Delay settings for 24-hour run (650 requests over ~24 hours)
# 650 requests / 24 hours = ~27 requests/hour = ~133 seconds between requests
MIN_DELAY_BETWEEN_REQUESTS = 20   # 30 seconds minimum
MAX_DELAY_BETWEEN_REQUESTS = 80  # 2.5 minutes maximum
MIN_DELAY_BETWEEN_PAGES = 6      # 15 seconds between pages of same brand
MAX_DELAY_BETWEEN_PAGES = 25      # 45 seconds between pages
AUTOSAVE_EVERY_N_BRANDS = 5

# Pagination settings
MAX_PAGES_PER_BRAND = 8  # Try up to 5 pages per brand
PAGE_SIZE = 48           # Coles returns ~48 products per page

def parse_cookie_string(cookie_string):
    """Convert browser cookie string to Python dict"""
    cookies = {}
    for item in cookie_string.split('; '):
        if '=' in item:
            key, value = item.split('=', 1)
            cookies[key] = value
    return cookies

# PASTE YOUR COPIED COOKIE STRING HERE
browser_cookies = """
visid_incap_320649...... like this.....05c8d5f948
"""

COLES_COOKIES = parse_cookie_string(browser_cookies.strip())
print(f"✅ Loaded {len(COLES_COOKIES)} cookies")

#def get_current_coles_build_id():
#    """Extract current Next.js build ID from Coles homepage"""
#    try:
#        response = requests.get('https://www.coles.com.au', timeout=10)
#        if response.status_code == 200:
#            match = re.search(r'"buildId":"([^"]+)"', response.text)
#            if match:
#                build_id = match.group(1)
#                print(f"✅ Detected Coles build ID: {build_id}")
#                return build_id
#    except:
#        pass
#    return "X123"    # new: 20260127.7-95792a7a1587133fb3156d8da8fe0d2cb20a640abuild ID changed again  this was old one"20260121.4-0a09fd6f9303df34732fe202aa5352d377c4f7bc"

def get_current_coles_build_id():
    """Extract current Next.js build ID from Coles homepage"""
    try:
        response = requests.get('https://www.coles.com.au', timeout=10)
        if response.status_code == 200:
            # Look for the pattern: /_next/data/{BUILD_ID}/en/search
            match = re.search(r'/_next/data/([^/]+)/en/', response.text)
            if match:
                build_id = match.group(1)
                print(f"Detected Coles build ID: {build_id}")
                return build_id
    except Exception as e:
        print(f"Could not auto-detect build ID: {e}")
        pass
    
    # Fallback to your latest known build ID
    return "20260226.8-d17cfe0a58d12bdda7eb0bae264e48600cd2d6a6"




COLES_BUILD_ID = get_current_coles_build_id()
COLES_API_BASE = f"https://www.coles.com.au/_next/data/{COLES_BUILD_ID}/en/search/products.json"

def load_brands_from_csv():
    """Load brands from MajorBrandsforSearchAPI.csv"""
    try:
        df = pd.read_csv(BRANDS_CSV_PATH)
        brands = df['Brands'].tolist()
        print(f"SUCCESS: Loaded {len(brands)} brands from CSV")
        return brands
    except FileNotFoundError:
        print("ERROR: MajorBrandsforSearchAPI_optimal.csv not found")
        raise SystemExit(1)
    except Exception as e:
        print(f"ERROR: Failed to load brands CSV: {e}")
        raise SystemExit(1)

def load_progress():
    """Load progress from previous run if exists"""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r') as f:
                progress = json.load(f)
            print(f"\nFOUND CHECKPOINT: Resuming from brand #{progress['last_brand_index'] + 1}")
            print(f"Already collected: {progress['products_collected']} products\n")
            return progress
        except:
            pass
    return {'last_brand_index': -1, 'products_collected': 0}

def save_progress(brand_index, products_count):
    """Save progress to file"""
    progress = {
        'last_brand_index': brand_index,
        'products_collected': products_count,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def load_existing_products():
    """Load products from checkpoint file if exists"""
    if os.path.exists(CHECKPOINT_FILE):
        try:
            df = pd.read_csv(CHECKPOINT_FILE)
            products = df.to_dict('records')
            print(f"Loaded {len(products)} existing products from checkpoint\n")
            return products
        except:
            pass
    return []

def save_checkpoint(all_products, brand_index):
    """Save checkpoint every N brands"""
    if all_products:
        df = pd.DataFrame(all_products)
        df.to_csv(CHECKPOINT_FILE, index=False, encoding='utf-8-sig')
        save_progress(brand_index, len(all_products))
        print(f"  ✓ CHECKPOINT SAVED: {len(all_products)} products")

def search_coles_brand_direct(brand, page_number=1):
    """Search Coles API directly with cookies and pagination"""
    
    headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'referer': f'https://www.coles.com.au/search?q={brand}',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    }
    
    # Coles pagination parameters
    params = {
        'q': brand,
        'page': page_number,
        'pageSize': PAGE_SIZE
    }
    
    try:
        response = requests.get(
            COLES_API_BASE, 
            headers=headers, 
            cookies=COLES_COOKIES, 
            params=params, 
            timeout=15
        )
        
        if response.status_code == 403 or 'Incapsula' in response.text:
            return None, "BLOCKED_403"
        elif response.status_code == 429:
            return None, "RATE_LIMITED_429"
        elif response.status_code != 200:
            return None, f"HTTP_{response.status_code}"
        
        try:
            data = response.json()
            return data, "SUCCESS"
        except json.JSONDecodeError:
            return None, "INVALID_JSON"
        
    except requests.exceptions.Timeout:
        return None, "TIMEOUT"
    except requests.exceptions.ConnectionError:
        return None, "CONNECTION_ERROR"
    except Exception as e:
        return None, f"ERROR_{type(e).__name__}"

def search_coles_brand_scraperapi(brand, page_number=1, retry_count=0):
    """Search Coles API via ScraperAPI with pagination"""
    
    target_url = f"{COLES_API_BASE}?q={brand}&page={page_number}&pageSize={PAGE_SIZE}"
    
    try:
        params = {
            'api_key': SCRAPERAPI_KEY,
            'url': target_url,
            'render': 'false',
        }
        
        if retry_count > 0:
            params['session_number'] = random.randint(1, 10000)
        
        response = requests.get('http://api.scraperapi.com', params=params, timeout=60)
        
        if response.status_code == 200:
            try:
                data = response.json()
                return data, "SUCCESS_SCRAPERAPI"
            except json.JSONDecodeError:
                return None, "INVALID_JSON"
        elif response.status_code == 403:
            return None, "SCRAPERAPI_CREDITS_EXHAUSTED"
        else:
            return None, f"SCRAPERAPI_HTTP_{response.status_code}"
            
    except Exception as e:
        return None, f"SCRAPERAPI_ERROR_{type(e).__name__}"

def search_coles_brand_with_fallback(brand, page_number=1):
    """Search with automatic fallback to ScraperAPI if blocked"""
    
    result, status = search_coles_brand_direct(brand, page_number)
    
    if status == "SUCCESS":
        return result, status, "DIRECT"
    
    # Trigger ScraperAPI fallback for various failure conditions
    if status in ["BLOCKED_403", "RATE_LIMITED_429", "INVALID_JSON", "HTTP_404", "HTTP_500", "TIMEOUT"]:
        print(f"  WARNING: {status} - Switching to ScraperAPI")
        
        for retry in range(4):
            print(f"    ScraperAPI attempt {retry + 1}/4...")
            
            result, status = search_coles_brand_scraperapi(brand, page_number, retry_count=retry)
            
            if status == "SUCCESS_SCRAPERAPI":
                print(f"    SUCCESS via ScraperAPI")
                return result, status, "SCRAPERAPI"
            
            if status == "SCRAPERAPI_CREDITS_EXHAUSTED":
                print(f"    ERROR: ScraperAPI credits exhausted")
                return None, status, "SCRAPERAPI"
            
            print(f"    FAIL: {status}")
            
            if retry < 3:
                time.sleep(random.uniform(2, 4))
        
        return None, "SCRAPERAPI_ALL_RETRIES_FAILED", "SCRAPERAPI"
    
    return None, status, "DIRECT"

def extract_coles_product_data(product, brand_searched):
    """Extract all relevant fields from Coles product data with safe None handling"""
    
    pricing = product.get('pricing') or {}
    unit = pricing.get('unit') or {}
    restrictions = product.get('restrictions') or {}
    merchandise = product.get('merchandiseHeir') or {}
    online_heirs = product.get('onlineHeirs') or []
    multi_buy = pricing.get('multiBuyPromotion') or {}
    
    online_heir_0 = online_heirs[0] if online_heirs else {}
    image_uris = product.get('imageUris') or []
    first_image = image_uris[0] if image_uris else {}
    
    return {
        'Brand_Searched': brand_searched,
        'ProductId': product.get('id', ''),
        'Name': product.get('name', ''),
        'Brand': product.get('brand', ''),
        'Description': product.get('description', ''),
        'Size': product.get('size', ''),
        'Price_Now': pricing.get('now', 0),
        'Price_Was': pricing.get('was', 0),
        'SaveAmount': pricing.get('saveAmount', 0),
        'SaveStatement': pricing.get('saveStatement', ''),
        'UnitPrice': unit.get('price', 0),
        'UnitQuantity': unit.get('ofMeasureQuantity', 0),
        'UnitMeasure': unit.get('ofMeasureUnits', ''),
        'Comparable': pricing.get('comparable', ''),
        'PromotionType': pricing.get('promotionType', ''),
        'SpecialType': pricing.get('specialType', ''),
        'OnlineSpecial': pricing.get('onlineSpecial', False),
        'OfferDescription': pricing.get('offerDescription', ''),
        'MultiBuy_MinQuantity': multi_buy.get('minQuantity', 0),
        'MultiBuy_Reward': multi_buy.get('reward', 0),
        'Availability': product.get('availability', False),
        'AvailabilityType': product.get('availabilityType', ''),
        'AvailableQuantity': product.get('availableQuantity', 0),
        'RetailLimit': restrictions.get('retailLimit', 0),
        'PromotionalLimit': restrictions.get('promotionalLimit', 0),
        'LiquorRestricted': restrictions.get('liquorAgeRestrictionFlag', False),
        'TobaccoRestricted': restrictions.get('tobaccoAgeRestrictionFlag', False),
        'TradeProfitCentre': merchandise.get('tradeProfitCentre', ''),
        'CategoryGroup': merchandise.get('categoryGroup', ''),
        'Category': merchandise.get('category', ''),
        'SubCategory': merchandise.get('subCategory', ''),
        'ClassName': merchandise.get('className', ''),
        'OnlineAisle': online_heir_0.get('aisle', ''),
        'OnlineCategory': online_heir_0.get('category', ''),
        'OnlineSubCategory': online_heir_0.get('subCategory', ''),
        'ImageUri': first_image.get('uri', ''),
        'Timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def main():
    BRANDS = load_brands_from_csv()
    progress = load_progress()
    all_products = load_existing_products()
    
    start_index = progress['last_brand_index'] + 1
    scraperapi_used = False
    
    # Calculate expected runtime
    total_requests_estimate = len(BRANDS) * 2  # Assume ~2 pages per brand on average
    avg_delay = (MIN_DELAY_BETWEEN_REQUESTS + MAX_DELAY_BETWEEN_REQUESTS) / 2
    estimated_hours = (total_requests_estimate * avg_delay) / 3600
    
    print(f"\nStarting Coles search for {len(BRANDS)} brands...")
    print(f"Auto-save checkpoint every {AUTOSAVE_EVERY_N_BRANDS} brands")
    print(f"Delay between brands: {MIN_DELAY_BETWEEN_REQUESTS}-{MAX_DELAY_BETWEEN_REQUESTS} seconds")
    print(f"Delay between pages: {MIN_DELAY_BETWEEN_PAGES}-{MAX_DELAY_BETWEEN_PAGES} seconds")
    print(f"Estimated runtime: ~{estimated_hours:.1f} hours (for ~{total_requests_estimate} requests)")
    print(f"{'='*80}\n")
    
    try:
        for brand_index in range(start_index, len(BRANDS)):
            brand = BRANDS[brand_index]
            brand_count = brand_index + 1
            
            print(f"[{brand_count}/{len(BRANDS)}] Searching Coles for: {brand}...")
            
            page = 1
            brand_products = 0
            
            # PAGINATION LOOP (like Woolworths)
            while page <= MAX_PAGES_PER_BRAND:
                print(f"  Page {page}...", end=" ")
                
                result, status, method = search_coles_brand_with_fallback(brand, page_number=page)
                
                if method == "SCRAPERAPI":
                    scraperapi_used = True
                
                if result:
                    page_props = result.get('pageProps', {})
                    search_results = page_props.get('searchResults', {})
                    results = search_results.get('results', [])
                    
                    if results:
                        extracted = 0
                        for item in results:
                            if item.get('_type') == 'PRODUCT':
                                product_data = extract_coles_product_data(item, brand)
                                all_products.append(product_data)
                                extracted += 1
                        
                        brand_products += extracted
                        method_label = f" ({method})" if method == "SCRAPERAPI" else ""
                        print(f"Found {extracted} products{method_label}")
                        
                        # Stop if less than full page (last page)
                        if extracted < PAGE_SIZE:
                            break
                        
                        page += 1
                        
                        # Delay between pages of same brand
                        if page <= MAX_PAGES_PER_BRAND:
                            delay = random.uniform(MIN_DELAY_BETWEEN_PAGES, MAX_DELAY_BETWEEN_PAGES)
                            print(f"    Waiting {delay:.1f}s before next page...")
                            time.sleep(delay)
                    else:
                        print("No products found")
                        break
                else:
                    print(f"FAIL: {status}")
                    
                    if status == "SCRAPERAPI_CREDITS_EXHAUSTED":
                        print("\nERROR: ScraperAPI credits exhausted - stopping")
                        save_checkpoint(all_products, brand_index)
                        raise SystemExit(1)
                    
                    break
            
            print(f"  Total for {brand}: {brand_products} products")
            
            # Auto-save checkpoint every N brands
            if (brand_count % AUTOSAVE_EVERY_N_BRANDS == 0) or (brand_count == len(BRANDS)):
                save_checkpoint(all_products, brand_index)
            
            print()
            
            # HEAVY DELAY between brands (30s - 2.5 mins)
            if brand_count < len(BRANDS):
                delay = random.uniform(MIN_DELAY_BETWEEN_REQUESTS, MAX_DELAY_BETWEEN_REQUESTS)
                print(f"Waiting {delay:.1f} seconds before next brand...\n")
                time.sleep(delay)
    
    except KeyboardInterrupt:
        print("\n\nINTERRUPTED BY USER!")
        print("Saving progress...")
        save_checkpoint(all_products, brand_index)
        print("You can resume later by running the script again")
        raise SystemExit(0)
    
    except Exception as e:
        print(f"\n\nERROR: {e}")
        print("Saving progress...")
        save_checkpoint(all_products, brand_index)
        raise
    
    # Save final results
    if all_products:
        df_all = pd.DataFrame(all_products)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"coles_brands_{timestamp}.csv"
        df_all.to_csv(filename, index=False, encoding='utf-8-sig')
        
        if os.path.exists(CHECKPOINT_FILE):
            os.remove(CHECKPOINT_FILE)
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
        
        print(f"\n{'='*80}")
        print(f"COMPLETE! Total products: {len(all_products)}")
        print(f"Saved to: {filename}")
        if scraperapi_used:
            print(f"NOTE: ScraperAPI was used for some requests")
        print(f"{'='*80}\n")
        
        print("Products per brand:")
        for brand in BRANDS:
            count = len([p for p in all_products if p['Brand_Searched'] == brand])
            if count > 0:
                print(f"  {brand}: {count} products")
    else:
        print("\nNo products found!")

if __name__ == "__main__":
    main()