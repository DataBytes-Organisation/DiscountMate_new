import os
import re
import time
from datetime import datetime
from urllib.parse import quote_plus

from dotenv import load_dotenv
from pymongo.mongo_client import MongoClient
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def get_mongo_collection() -> MongoClient:
    load_dotenv()
    username = os.getenv("MONGO_USERNAME")
    password = os.getenv("MONGO_PASSWORD")
    cluster = os.getenv("MONGO_CLUSTER")
    appname = os.getenv("MONGO_APPNAME")
    db_name = os.getenv("MONGO_DB")

    if not all([username, password, cluster, appname, db_name]):
        print(
            "Missing one or more MongoDB environment variables. Please check .env file."
        )
        raise SystemExit(1)

    uri = (
        "mongodb+srv://"
        + quote_plus(username)
        + ":"
        + quote_plus(password)
        + "@"
        + cluster
        + "/?retryWrites=true&w=majority&appName="
        + appname
    )

    try:
        client = MongoClient(uri)
        db = client[db_name]
        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        coll_name = f"IGA_Catalogue_{ts}"
        print(f"Connected to MongoDB. Using collection: {coll_name}")
        return db[coll_name]
    except Exception as e:
        print("Failed to connect to MongoDB:", e)
        raise SystemExit(1)


def setup_driver() -> webdriver.Chrome:
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    return webdriver.Chrome(options=chrome_options)


def wait_for_any_product(driver: webdriver.Chrome, timeout: int = 20) -> bool:
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CLASS_NAME, "item-container"))
        )
        return True
    except Exception:
        return False


def get_categories(driver: webdriver.Chrome) -> list[dict]:
    categories: dict[str, dict] = {}
    try:
        print("  Finding and clicking the 'Categories' tab...")
        tab = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[normalize-space()='Categories']"))
        )
        tab.click()
        time.sleep(2)

        links = driver.find_elements(By.CSS_SELECTOR, "a[href*='categoryId=']")
        print(f"  Found {len(links)} category links to parse.")
        for link in links:
            href = link.get_attribute("href") or ""
            name = link.text.strip()
            if not href or not name:
                continue
            m = re.search(r"categoryId=(\d+)", href)
            if not m:
                continue
            cat_id = m.group(1)
            if cat_id not in categories:
                categories[cat_id] = {"name": name, "id": cat_id}
    except Exception as e:
        print(f"  Could not extract categories. Error: {e}")
    return list(categories.values())


def parse_card(card_elem) -> dict:
    product_code, item_name, item_size, best_price, item_price, unit_price, special_text, image_url, link = ("N/A",)*9
    try:
        link_elem = card_elem.find_element(By.CSS_SELECTOR, "a[href*='itemId=']")
        raw_link = link_elem.get_attribute("href") or ""
        link = raw_link if raw_link.startswith("http") else f"https://www.iga.com.au{raw_link}"
        match = re.search(r"itemId=(\d+)", raw_link)
        if match:
            product_code = match.group(1)
            
        img_elem = card_elem.find_element(By.TAG_NAME, "img")
        image_url = img_elem.get_attribute("src") or "N/A"
        name_elem = card_elem.find_element(By.CLASS_NAME, "item-name")
        item_name = name_elem.text.strip()
        size_elem = card_elem.find_element(By.CLASS_NAME, "item-size")
        item_size = size_elem.text.strip()
        price_container = card_elem.find_element(By.CLASS_NAME, "item-prices")
        price_text = price_container.text.strip().replace('$', '').split('\n')
        if price_text:
            best_price = price_text[0]
            item_price = best_price
        try:
            unit_price_elem = card_elem.find_element(By.CLASS_NAME, "price-unit")
            unit_price = unit_price_elem.text.strip()
        except Exception: pass
        try:
            special_elem = card_elem.find_element(By.CLASS_NAME, "item-badge-wrapper")
            special_text = special_elem.text.strip()
        except Exception: pass
    except Exception: pass

    return {
        "product_code": product_code, "category": "N/A", "item_name": f"{item_name} {item_size}".strip(),
        "item_price": item_price, "best_price": best_price, "unit_price": unit_price,
        "special_text": special_text, "promo_text": "N/A", "image": image_url,
        "timestamp": datetime.now().isoformat(), "link": link,
    }


def scrape_iga_catalogue():
    start_url = "https://www.iga.com.au/catalogue/#view=list&saleId=60925&areaName=VIC%20Local%20Grocer" #
    base_url = "https://www.iga.com.au/catalogue/"

    collection = get_mongo_collection()
    driver = setup_driver()
    product_map: dict[str, dict] = {}

    try:
        print(f"Navigating directly to catalogue: {start_url}")
        driver.get(start_url)

        sale_id_match = re.search(r"saleId=(\d+)", start_url)
        area_name_match = re.search(r"areaName=([^&]+)", start_url)
        if not sale_id_match or not area_name_match:
            print("Provided URL is missing 'saleId' or 'areaName'. Cannot proceed.")
            return

        sale_id = sale_id_match.group(1)
        area_name = area_name_match.group(1)
        print(f"Using Sale ID: {sale_id} and Area Name: {area_name}")

        if not wait_for_any_product(driver, timeout=20):
            print("Page loaded, but no products were found. Please check the URL.")
            return
        
        print("Extracting all available categories...")
        categories = get_categories(driver)
        if not categories:
            print("No categories found – will scrape the unfiltered list only.")
            categories = [{"name": "All", "id": None}]
        print(f"Found {len(categories)} categories: {[c['name'] for c in categories]}")

        for cat in categories:
            cat_id = cat.get("id"); cat_name = cat.get("name") or "Uncategorised"
            
            cat_url = f"{base_url}#view=list&saleId={sale_id}&categoryId={cat_id}&areaName={area_name}"
            print(f"\nNavigating to category: {cat_name}")
            driver.get(cat_url)

            if not wait_for_any_product(driver, timeout=20):
                print(f"No products found for category {cat_name}. Skipping."); continue
            
            product_cards = driver.find_elements(By.CLASS_NAME, "item-container")
            print(f"  Found {len(product_cards)} product cards on the page.")
            for card in product_cards:
                product = parse_card(card)
                product_code = product.get('product_code')
                if not product_code or product_code == 'N/A': continue
                
                if product_code in product_map:
                    if cat_name not in product_map[product_code]['category']:
                        product_map[product_code]['category'].append(cat_name)
                else:
                    product['category'] = [cat_name]
                    product_map[product_code] = product
            
        docs = list(product_map.values())
        if docs:
            for doc in docs: doc['category'] = ', '.join(doc['category'])
            try:
                collection.insert_many(docs)
                print(f"\nInserted {len(docs)} unique products into MongoDB.")
            except Exception as e: print("Failed to write to MongoDB:", e)
        else: print("No products collected.")

    finally:
        driver.quit()
        print("Scraping complete.")


if __name__ == "__main__":
    print("Starting IGA catalogue scraper…")
    scrape_iga_catalogue()
    print("Done.")