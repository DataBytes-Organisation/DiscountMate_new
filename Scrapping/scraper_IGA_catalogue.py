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
            EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='itemId=']"))
        )
        return True
    except Exception:
        return False


def get_categories(driver: webdriver.Chrome) -> list[dict]:
    categories: dict[str, dict] = {}
    try:
        tab = driver.find_element(
            By.XPATH,
            "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'categories')]",
        )
        tab.click()
        time.sleep(1)
        links = driver.find_elements(By.CSS_SELECTOR, "a[href*='categoryId=']")
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
                categories[cat_id] = {"name": name, "id": cat_id, "href": href}
    except Exception as e:
        print("Failed to extract categories:", e)
    return list(categories.values())


def parse_card(card_elem) -> dict:
    product_code = "N/A"
    item_name = "N/A"
    best_price = "N/A"
    unit_price = "N/A"
    promo_text = "N/A"
    image_url = "N/A"
    link = "N/A"

    try:
        link_elem = card_elem.find_element(By.CSS_SELECTOR, "a[href*='itemId=']")
        raw_link = link_elem.get_attribute("href") or ""
        link = raw_link if raw_link.startswith("http") else f"https://www.iga.com.au{raw_link}"
        m = re.search(r"itemId=(\d+)", raw_link)
        if m:
            product_code = m.group(1)
    except Exception:
        pass

    try:
        img_elem = card_elem.find_element(By.TAG_NAME, "img")
        src = img_elem.get_attribute("src")
        if src:
            image_url = src
    except Exception:
        pass

    try:
        text = card_elem.text.strip()
        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
        name_lines: list[str] = []
        prices: list[str] = []
        for line in lines:
            lowered = line.lower()
            if line.startswith("$") and (
                "each" in lowered
                or "pack" in lowered
                or re.match(r"^\$\d", line)
            ):
                prices.append(line)
                continue
            if " per " in lowered:
                unit_price = line
                continue

            if "save" in lowered or "price" in lowered or "%" in line:
                promo_text = line
                continue
            name_lines.append(line)
        if name_lines:
            item_name = " ".join(name_lines)
        if prices:
            clean = prices[0].replace("$", "").strip()
            clean = re.split(r"\s", clean)[0]
            best_price = clean
    except Exception:
        pass

    return {
        "product_code": product_code,
        "item_name": item_name,
        "best_price": best_price,
        "unit_price": unit_price,
        "promo_text": promo_text,
        "image": image_url,
        "link": link,
    }


def scrape_iga_catalogue():
    sale_id = "60901"
    area_name = "VIC%20Local%20Grocer"
    base_url = "https://www.iga.com.au/catalogue/"

    collection = get_mongo_collection()
    driver = setup_driver()

    product_map: dict[str, dict] = {}

    try:
        initial_url = f"{base_url}#view=list&saleId={sale_id}&areaName={area_name}"
        print(f"Navigating to {initial_url}")
        driver.get(initial_url)

        if not wait_for_any_product(driver, timeout=20):
            print("No products detected on initial load – attempting to set location.")
            driver.get(base_url)

            try:
                store_link = driver.find_element(
                    By.XPATH,
                    "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'select your iga store')]",
                )
                store_link.click()
                time.sleep(1)
            except Exception:
                pass

            try:
                search_input = driver.find_element(
                    By.XPATH,
                    "//input[contains(@placeholder,'postcode') or contains(@placeholder,'suburb')]",
                )
                search_input.clear()
                search_input.send_keys("3000")
                time.sleep(2)
                suggestions = driver.find_elements(By.CSS_SELECTOR, "li")
                if suggestions:
                    suggestions[0].click()
                    time.sleep(2)
            except Exception as e:
                print("Setting location via postcode failed:", e)
            driver.get(initial_url)

            if not wait_for_any_product(driver, timeout=20):
                print(
                    "Still no products found after attempting to set location. Exiting."
                )
                return

        categories = get_categories(driver)
        if not categories:
            print("No categories found – scraping the unfiltered list only.")
            categories = [
                {"name": "All", "id": None, "href": f"#view=list&saleId={sale_id}&areaName={area_name}"}
            ]

        print(f"Found {len(categories)} categories: {[c['name'] for c in categories]}")

        for cat in categories:
            cat_id = cat.get("id")
            cat_name = cat.get("name") or "Uncategorised"
            if cat_id:
                cat_url = f"{base_url}#view=list&saleId={sale_id}&categoryId={cat_id}&areaName={area_name}"
            else:
                cat_url = f"{base_url}{cat.get('href')}"
            print(f"\nScraping category: {cat_name} -> {cat_url}")
            driver.get(cat_url)
            if not wait_for_any_product(driver, timeout=20):
                print(f"No products found for category {cat_name}. Skipping.")
                continue

            anchors = driver.find_elements(By.CSS_SELECTOR, "a[href*='itemId=']")
            seen_codes: set[str] = set()
            for anchor in anchors:
                href = anchor.get_attribute("href") or ""
                m = re.search(r"itemId=(\d+)", href)
                if not m:
                    continue
                code = m.group(1)
                if code in seen_codes:
                    continue
                seen_codes.add(code)

                card = None
                try:
                    card = anchor.find_element(By.XPATH, "./ancestor::div[contains(@class,'column')][1]")
                except Exception:
                    try:
                        card = anchor.find_element(By.XPATH, "./ancestor::div[contains(@class,'col')][1]")
                    except Exception:
                        card = anchor.find_element(By.XPATH, "..")
                product = parse_card(card)
                existing = product_map.get(product["product_code"])
                if existing:
                    cats = existing.get("categories", [])
                    if cat_name not in cats:
                        cats.append(cat_name)
                    existing.update(product)
                    existing["categories"] = cats
                    product_map[product["product_code"]] = existing
                else:
                    product_map[product["product_code"]] = {
                        **product,
                        "categories": [cat_name],
                        "timestamp": datetime.now().isoformat(),
                    }

            print(f"  Parsed {len(seen_codes)} items from {cat_name}.")

        docs = list(product_map.values())
        if docs:
            try:
                collection.insert_many(docs)
                print(f"Inserted {len(docs)} products into MongoDB.")
            except Exception as e:
                print("Failed to write to MongoDB:", e)
        else:
            print("No products collected.")
    finally:
        driver.quit()

    print("Scraping complete.")

if __name__ == "__main__":
    print("Starting IGA catalogue scraper…")
    scrape_iga_catalogue()
    print("Done.")