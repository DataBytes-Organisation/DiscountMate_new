import os
import re
import time
import logging
import shutil
from datetime import datetime
from urllib.parse import quote_plus
from dotenv import load_dotenv
from pymongo.mongo_client import MongoClient
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("iga_scraper.log", mode="a", encoding="utf-8")]
)
logger = logging.getLogger(__name__)

# Clear previous Chrome session to prevent lock errors
# Configuration for EC2 automation, you can remove this or set as per your computer while testing locally on your computer
USER_DATA_DIR = "/home/ubuntu/DiscountMate_new/Scrapping/chrome-user-data-IGA"
if os.path.exists(USER_DATA_DIR):
    shutil.rmtree(USER_DATA_DIR)

def get_mongo_collection():
    load_dotenv()
    username = os.getenv("MONGO_USERNAME")
    password = os.getenv("MONGO_PASSWORD")
    cluster = os.getenv("MONGO_CLUSTER")
    appname = os.getenv("MONGO_APPNAME")
    db_name = os.getenv("MONGO_DB")
    if not username or not password or not cluster or not appname or not db_name:
        logger.error("Missing MongoDB env vars. Please check your .env file.")
        raise SystemExit(1)
    uri = f"mongodb+srv://{quote_plus(username)}:{quote_plus(password)}@{cluster}/?retryWrites=true&w=majority&appName={appname}"
    try:
        client = MongoClient(uri)
        db = client[db_name]
        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        coll_name = f"IGA_Specials_{ts}"
        logger.info(f"Connected to MongoDB. Using collection: {coll_name}")
        return db[coll_name]
    except Exception as e:
        logger.exception("Failed to connect to MongoDB")
        raise SystemExit(1)

def click_browse_as_guest_if_shown(driver):
    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located(
                (By.XPATH, "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'browse as a guest')]")
            )
        )
        btn = driver.find_element(
            By.XPATH,
            "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'browse as a guest')]"
        )
        btn.click()
        time.sleep(1)
        logger.info("Clicked 'Browse as a guest'")
    except Exception:
        pass

def scrape_iga_specials():

    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    
    # The following is added for EC2 Automation. You can remove or adjust accordingly while testing locally
    chrome_options.add_argument(f"--user-data-dir={USER_DATA_DIR}")

    driver = webdriver.Chrome(options=chrome_options)
    collection = get_mongo_collection()
    page = 1
    total_saved = 0
    seen_products = set()
    try:
        while True:
            url = f"https://www.igashop.com.au/specials/{page}"
            logger.info(f"Scraping page {page}: {url}")
            driver.get(url)
            click_browse_as_guest_if_shown(driver)
            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_all_elements_located((By.CSS_SELECTOR, '[data-product-card="true"]'))
                )
            except Exception:
                logger.info("No products found (timeout) — stopping.")
                break
            cards = driver.find_elements(By.CSS_SELECTOR, '[data-product-card="true"]')
            if not cards:
                logger.info("No products on this page — stopping.")
                break
            page_docs = []
            for idx, card in enumerate(cards, start=1):
                product_code = "N/A"
                raw_link = None
                try:
                    a = card.find_element(By.TAG_NAME, "a")
                    raw_link = a.get_attribute("href")
                    if raw_link:
                        m = re.search(r"(\d+)$", raw_link)
                        if m:
                            product_code = m.group(1)
                except Exception:
                    pass
                if product_code != "N/A" and product_code in seen_products:
                    logger.debug(f"Skipping duplicate product {product_code}")
                    continue
                seen_products.add(product_code)
                try:
                    name_elem = card.find_element(By.CSS_SELECTOR, "a span.line-clamp-3")
                    item_name = name_elem.text.strip()
                except Exception:
                    item_name = "N/A"
                item_size = ""
                try:
                    size_elem = card.find_element(
                        By.XPATH,
                        ".//a/span[contains(@class,'line-clamp-3')]/following-sibling::span[1]"
                    )
                    item_size = size_elem.text.strip()
                except Exception:
                    pass
                best_price = "N/A"
                item_price = "N/A"
                try:
                    price_spans = card.find_elements(By.XPATH, ".//span[contains(text(), '$')]")
                    for span in price_spans:
                        txt = span.text.strip()
                        if "per" in txt.lower() or "each" in txt.lower() or "/" in txt:
                            continue
                        cleaned = txt.replace("$", "").replace("Was", "").replace("was", "").strip()
                        if not cleaned:
                            continue
                        if best_price == "N/A":
                            best_price = cleaned
                        elif item_price == "N/A":
                            item_price = cleaned
                            break
                except Exception:
                    pass
                unit_price = "N/A"
                try:
                    unit_elem = card.find_element(By.XPATH, ".//*[contains(text(),'each') or contains(text(),'per')]")
                    unit_price = unit_elem.text.strip()
                except Exception:
                    pass
                image = "N/A"
                try:
                    img = card.find_element(By.CSS_SELECTOR, "img")
                    image = img.get_attribute("src") or "N/A"
                except Exception:
                    pass
                link = raw_link if raw_link and raw_link.startswith("http") else f"https://www.igashop.com.au{raw_link}" if raw_link else "N/A"
                special_text = "N/A"
                try:
                    card_text = card.text.lower()
                    if "better than" in card_text:
                        special_text = "Better than half price"
                    elif "%" in card_text and "off" in card_text:
                        special_text = "Discount"
                    elif "age restricted" in card_text:
                        special_text = "Age restricted item"
                    elif "special" in card_text:
                        special_text = "Special"
                except Exception:
                    pass
                promo_text = "N/A"
                try:
                    expiry_elem = card.find_element(
                        By.XPATH,
                        ".//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'end') or "
                        "contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'until') or "
                        "contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'expiry')]"
                    )
                    promo_text = expiry_elem.text.strip()
                except Exception:
                    try:
                        for line in card.text.split("\n"):
                            if any(k in line.lower() for k in ["ends", "until", "expiry"]):
                                promo_text = line.strip()
                                break
                    except Exception:
                        pass
                doc = {
                    "product_code": product_code,
                    "category": "N/A",
                    "item_name": f"{item_name} {item_size}".strip(),
                    "item_price": item_price,
                    "best_price": best_price,
                    "unit_price": unit_price,
                    "special_text": special_text,
                    "promo_text": promo_text,
                    "image": image,
                    "timestamp": datetime.now().isoformat(),
                    "link": link,
                }
                page_docs.append(doc)
                logger.info(f"  #{idx} -> [{doc['category']}] {doc['item_name']} | now: {best_price} | was: {item_price}")
            if page_docs:
                try:
                    collection.insert_many(page_docs, ordered=False)
                    total_saved += len(page_docs)
                except Exception as e:
                    logger.error(f"Failed to insert documents: {e}")
            else:
                logger.info("No items parsed on this page. Stopping.")
                break
            page += 1
            time.sleep(1)
    finally:
        driver.quit()
    logger.info(f"Done. Scraped total: {total_saved} products.")

if __name__ == "__main__":
    logger.info("Starting IGA specials scraper...")
    scrape_iga_specials()
    logger.info("Done.")
