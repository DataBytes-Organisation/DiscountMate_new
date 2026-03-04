import os
import json
import time
import random
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

# run as: DiscountMate_Clone\DiscountMate_new>python experimental\WebAPIScraping\Woolworths_API_Scraper.py 
# -----------------------------
# Path helpers
# -----------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Assumes script is somewhere inside the repo and repo root contains "Master_Data_2026_Onward"
# If you know your script will always be at repo/experimental/..., then REPO_ROOT is 2 levels up, etc.
def find_repo_root(start_dir: str) -> str:
    cur = start_dir
    while True:
        candidate = os.path.join(cur, "Master_Data_2026_Onward")
        if os.path.isdir(candidate):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            raise RuntimeError("Could not find repo root (folder containing 'Master_Data_2026_Onward').")
        cur = parent


REPO_ROOT = find_repo_root(SCRIPT_DIR)

# Load .env from repo root
ENV_PATH = os.path.join(REPO_ROOT, ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

SCRAPERAPI_KEY = os.getenv("SCRAPERAPI_KEY")
if not SCRAPERAPI_KEY:
    raise RuntimeError(
        "SCRAPERAPI_KEY not found. Add it to repo-root .env as:\n"
        "SCRAPERAPI_KEY=your_key_here"
    )
# store the scraper API key in root .env similar to this (this is a mock/madeup key):
#SCRAPERAPI_KEY = soyb854643gighg935xxyu7645348674hfhf9584743a4  # deakin central scraperAPI Key

BRANDS_CSV_PATH = os.path.join(
    REPO_ROOT,
    "Master_Data_2026_Onward",
    "MajorBrandsforSearchAPI_optimal.csv"
)

# Outputs folder next to script
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Auto-save settings
AUTOSAVE_EVERY_N_BRANDS = 5
CHECKPOINT_FILE = os.path.join(OUTPUT_DIR, "woolworths_checkpoint.csv")
PROGRESS_FILE = os.path.join(OUTPUT_DIR, "woolworths_progress.json")

# Delay settings
MIN_DELAY_BETWEEN_REQUESTS = 15
MAX_DELAY_BETWEEN_REQUESTS = 50
MIN_DELAY_BETWEEN_PAGES = 10
MAX_DELAY_BETWEEN_PAGES = 30


def load_brands_from_csv():
    """Load brands from MajorBrandsforSearchAPI_optimal.csv"""
    df = pd.read_csv(BRANDS_CSV_PATH)
    if "Brands" not in df.columns:
        raise RuntimeError(f"'Brands' column not found in {BRANDS_CSV_PATH}. Columns: {list(df.columns)}")
    brands = df["Brands"].dropna().astype(str).tolist()
    print(f"SUCCESS: Loaded {len(brands)} brands from {BRANDS_CSV_PATH}")
    return brands


def load_progress():
    """Load progress from previous run if exists"""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                progress = json.load(f)
            print(f"\nFOUND CHECKPOINT: Resuming from brand #{progress['last_brand_index'] + 1}")
            print(f"Already collected: {progress['products_collected']} products\n")
            return progress
        except Exception:
            pass
    return {"last_brand_index": -1, "products_collected": 0}


def save_progress(brand_index, products_count):
    """Save progress to file"""
    progress = {
        "last_brand_index": brand_index,
        "products_collected": products_count,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)


def load_existing_products():
    """Load products from checkpoint file if exists"""
    if os.path.exists(CHECKPOINT_FILE):
        try:
            df = pd.read_csv(CHECKPOINT_FILE)
            products = df.to_dict("records")
            print(f"Loaded {len(products)} existing products from checkpoint\n")
            return products
        except Exception:
            pass
    return []


def save_checkpoint(all_products, brand_index):
    """Save checkpoint every N brands"""
    if all_products:
        df = pd.DataFrame(all_products)
        df.to_csv(CHECKPOINT_FILE, index=False, encoding="utf-8-sig")
        save_progress(brand_index, len(all_products))
        print(f"CHECKPOINT SAVED: {len(all_products)} products -> {CHECKPOINT_FILE}")


def search_woolworths_brand_direct(brand, page_number=1):
    """Search Woolworths API directly (no proxy)"""
    url = "https://www.woolworths.com.au/apis/ui/Search/products"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.woolworths.com.au/",
    }

    params = {"searchTerm": brand, "pageSize": 36, "pageNumber": page_number}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code == 403:
            return None, "BLOCKED_403"
        elif response.status_code == 429:
            return None, "RATE_LIMITED_429"
        elif response.status_code != 200:
            return None, f"HTTP_{response.status_code}"

        return response.json(), "SUCCESS"

    except requests.exceptions.Timeout:
        return None, "TIMEOUT"
    except requests.exceptions.ConnectionError:
        return None, "CONNECTION_ERROR"
    except Exception as e:
        return None, f"ERROR_{type(e).__name__}"


def search_woolworths_brand_scraperapi(brand, page_number=1, retry_count=0):
    """Search Woolworths API via ScraperAPI (fallback when blocked)"""
    target_url = (
        "https://www.woolworths.com.au/apis/ui/Search/products"
        f"?searchTerm={brand}&pageSize=36&pageNumber={page_number}"
    )

    params = {
        "api_key": SCRAPERAPI_KEY,
        "url": target_url,
        "render": "false",
    }

    # new session to improve success rate on retries
    if retry_count > 0:
        params["session_number"] = random.randint(1, 10000)

    try:
        response = requests.get("http://api.scraperapi.com", params=params, timeout=60)

        if response.status_code == 200:
            try:
                return response.json(), "SUCCESS_SCRAPERAPI"
            except json.JSONDecodeError:
                return None, "INVALID_JSON"
        elif response.status_code == 403:
            return None, "SCRAPERAPI_CREDITS_EXHAUSTED"
        else:
            return None, f"SCRAPERAPI_HTTP_{response.status_code}"

    except Exception as e:
        return None, f"SCRAPERAPI_ERROR_{type(e).__name__}"


def search_woolworths_brand_with_fallback(brand, page_number=1):
    """Search with automatic fallback to ScraperAPI if blocked"""
    result, status = search_woolworths_brand_direct(brand, page_number)

    if status == "SUCCESS":
        return result, status, "DIRECT"

    if status in ["BLOCKED_403", "RATE_LIMITED_429", "HTTP_404", "HTTP_500", "TIMEOUT"]:
        print(f"  WARNING: {status} - Switching to ScraperAPI")

        for retry in range(4):
            print(f"    ScraperAPI attempt {retry + 1}/4...")
            result, status = search_woolworths_brand_scraperapi(brand, page_number, retry_count=retry)

            if status == "SUCCESS_SCRAPERAPI":
                print("    SUCCESS via ScraperAPI")
                return result, status, "SCRAPERAPI"

            if status == "SCRAPERAPI_CREDITS_EXHAUSTED":
                print("    ERROR: ScraperAPI credits exhausted")
                return None, status, "SCRAPERAPI"

            print(f"    FAIL: {status}")
            if retry < 3:
                time.sleep(random.uniform(2, 4))

        return None, "SCRAPERAPI_ALL_RETRIES_FAILED", "SCRAPERAPI"

    return None, status, "DIRECT"


def extract_product_data(product, brand_searched):
    additional_attrs = product.get("AdditionalAttributes", {}) or {}
    centre_tag = product.get("CentreTag", {}) or {}

    return {
        "Brand_Searched": brand_searched,
        "Stockcode": product.get("Stockcode", ""),
        "Barcode": product.get("Barcode", ""),
        "Name": product.get("Name", ""),
        "DisplayName": product.get("DisplayName", ""),
        "UrlFriendlyName": product.get("UrlFriendlyName", ""),
        "Description": product.get("Description", "").replace("<br>", " ") if product.get("Description") else "",
        "FullDescription": product.get("FullDescription", ""),
        "PackageSize": product.get("PackageSize", ""),
        "Price": product.get("Price", 0),
        "InstorePrice": product.get("InstorePrice", 0),
        "WasPrice": product.get("WasPrice", 0),
        "InstoreWasPrice": product.get("InstoreWasPrice", 0),
        "IsOnSpecial": product.get("IsOnSpecial", False),
        "InstoreIsOnSpecial": product.get("InstoreIsOnSpecial", False),
        "SavingsAmount": product.get("SavingsAmount", 0),
        "InstoreSavingsAmount": product.get("InstoreSavingsAmount", 0),
        "CupPrice": product.get("CupPrice", 0),
        "CupMeasure": product.get("CupMeasure", ""),
        "CupString": product.get("CupString", ""),
        "IsHalfPrice": product.get("IsHalfPrice", False),
        "IsOnlineOnly": product.get("IsOnlineOnly", False),
        "IsNew": product.get("IsNew", False),
        "IsInStock": product.get("IsInStock", False),
        "IsAvailable": product.get("IsAvailable", False),
        "SupplyLimit": product.get("SupplyLimit", 0),
        "ProductLimit": product.get("ProductLimit", 0),
        "Unit": product.get("Unit", ""),
        "MinimumQuantity": product.get("MinimumQuantity", 0),
        "SmallImageFile": product.get("SmallImageFile", ""),
        "MediumImageFile": product.get("MediumImageFile", ""),
        "LargeImageFile": product.get("LargeImageFile", ""),
        "AgeRestricted": product.get("AgeRestricted", False),
        "IsForDelivery": product.get("IsForDelivery", False),
        "IsForCollection": product.get("IsForCollection", False),
        "IsForExpress": product.get("IsForExpress", False),
        "ProductRestrictionMessage": product.get("ProductRestrictionMessage", ""),
        "ProductWarningMessage": product.get("ProductWarningMessage", ""),
        "SupplyLimitMessage": product.get("SupplyLimitMessage", ""),
        "HealthStarRating": additional_attrs.get("healthstarrating", ""),
        "CountryOfOrigin": additional_attrs.get("countryoforigin", ""),
        "Ingredients": additional_attrs.get("ingredients", ""),
        "AllergyStatement": additional_attrs.get("allergystatement", ""),
        "LifestyleAndDietaryStatement": additional_attrs.get("lifestyleanddietarystatement", ""),
        "StorageInstructions": additional_attrs.get("storageinstructions", ""),
        "ContainsGluten": additional_attrs.get("containsgluten", ""),
        "ContainsNuts": additional_attrs.get("containsnuts", ""),
        "SapDepartmentName": additional_attrs.get("sapdepartmentname", ""),
        "SapCategoryName": additional_attrs.get("sapcategoryname", ""),
        "SapSubCategoryName": additional_attrs.get("sapsubcategoryname", ""),
        "CentreTagType": centre_tag.get("TagType", ""),
        "PromotionType": centre_tag.get("PromotionType", ""),
        "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def main():
    BRANDS = load_brands_from_csv()

    progress = load_progress()
    all_products = load_existing_products()

    start_index = progress["last_brand_index"] + 1
    scraperapi_used = False

    total_requests_estimate = len(BRANDS) * 2
    avg_delay = (MIN_DELAY_BETWEEN_REQUESTS + MAX_DELAY_BETWEEN_REQUESTS) / 2
    estimated_hours = (total_requests_estimate * avg_delay) / 3600

    print(f"\nStarting Woolworths search for {len(BRANDS)} brands...")
    print(f"Brands CSV: {BRANDS_CSV_PATH}")
    print(f"Outputs dir: {OUTPUT_DIR}")
    print(f"Auto-save checkpoint every {AUTOSAVE_EVERY_N_BRANDS} brands")
    print(f"Delay between brands: {MIN_DELAY_BETWEEN_REQUESTS}-{MAX_DELAY_BETWEEN_REQUESTS} seconds")
    print(f"Delay between pages: {MIN_DELAY_BETWEEN_PAGES}-{MAX_DELAY_BETWEEN_PAGES} seconds")
    print(f"Estimated runtime: ~{estimated_hours:.1f} hours")
    print(f"{'='*80}\n")

    try:
        for brand_index in range(start_index, len(BRANDS)):
            brand = BRANDS[brand_index]
            brand_count = brand_index + 1

            print(f"[{brand_count}/{len(BRANDS)}] Searching for: {brand}...")

            page = 1
            brand_products = 0

            while page <= 5:
                print(f"  Page {page}...", end=" ")

                result, status, method = search_woolworths_brand_with_fallback(brand, page_number=page)
                if method == "SCRAPERAPI":
                    scraperapi_used = True

                if result and "Products" in result:
                    outer_products = result["Products"]

                    if not outer_products:
                        print("No more products")
                        break

                    extracted = 0
                    for wrapper in outer_products:
                        if isinstance(wrapper, dict):
                            if "Products" in wrapper and isinstance(wrapper["Products"], list):
                                for product in wrapper["Products"]:
                                    if "Stockcode" in product:
                                        all_products.append(extract_product_data(product, brand))
                                        extracted += 1
                            elif "Stockcode" in wrapper:
                                all_products.append(extract_product_data(wrapper, brand))
                                extracted += 1

                    brand_products += extracted
                    method_label = f" ({method})" if method == "SCRAPERAPI" else ""
                    print(f"Found {extracted} products{method_label}")

                    if extracted < 36:
                        break

                    page += 1
                    if page <= 5:
                        delay = random.uniform(MIN_DELAY_BETWEEN_PAGES, MAX_DELAY_BETWEEN_PAGES)
                        print(f"    Waiting {delay:.1f}s before next page...")
                        time.sleep(delay)
                else:
                    print(f"FAIL: {status}")

                    if status == "SCRAPERAPI_CREDITS_EXHAUSTED":
                        print("\nERROR: ScraperAPI credits exhausted - stopping")
                        save_checkpoint(all_products, brand_index)
                        raise SystemExit(1)

                    break

            print(f"  Total for {brand}: {brand_products} products")

            if (brand_count % AUTOSAVE_EVERY_N_BRANDS == 0) or (brand_count == len(BRANDS)):
                save_checkpoint(all_products, brand_index)

            print()

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

    if all_products:
        df_all = pd.DataFrame(all_products)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        final_path = os.path.join(OUTPUT_DIR, f"woolworths_brands_{timestamp}.csv")
        df_all.to_csv(final_path, index=False, encoding="utf-8-sig")

        # Optional cleanup
        if os.path.exists(CHECKPOINT_FILE):
            os.remove(CHECKPOINT_FILE)
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)

        print(f"\n{'='*80}")
        print(f"COMPLETE! Total products: {len(all_products)}")
        print(f"Saved to: {final_path}")
        if scraperapi_used:
            print("NOTE: ScraperAPI was used for some requests")
        print(f"{'='*80}\n")
    else:
        print("\nNo products found!")


if __name__ == "__main__":
    main()