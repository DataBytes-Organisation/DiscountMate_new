import os
import re
import time
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
        print("Missing one or more MongoDB env vars (MONGO_USERNAME, MONGO_PASSWORD, MONGO_CLUSTER, MONGO_APPNAME, MONGO_DB).")
        print("Please check your .env file.")
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
        coll_name = f"IGA_Specials_{ts}"
        print(f"Connected to MongoDB. Using collection: {coll_name}")
        return db[coll_name]
    except Exception as e:
        print("Failed to connect to MongoDB:", e)
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
        print("Clicked 'Browse as a guest'")
    except Exception:
        pass


def get_text_or_default(elem, default="N/A"):
    try:
        txt = elem.text.strip()
        if txt:
            return txt
        return default
    except Exception:
        return default


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

    try:
        while True:
            url = f"https://www.igashop.com.au/specials/{page}"
            print(f"\n===== Scraping page {page}: {url} =====")
            driver.get(url)

            click_browse_as_guest_if_shown(driver)

            try:
                WebDriverWait(driver, 20).until(
                    EC.presence_of_all_elements_located((By.CSS_SELECTOR, '[data-product-card="true"]'))
                )
            except Exception:
                print("No products found (timeout) — stopping.")
                break

            cards = driver.find_elements(By.CSS_SELECTOR, '[data-product-card="true"]')
            if not cards:
                print("No products on this page — stopping.")
                break

            page_docs = []

            for idx, card in enumerate(cards, start=1):
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
                    item_size = ""

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

                    if item_price == "N/A":
                        try:
                            was_elem = card.find_element(
                                By.XPATH,
                                ".//span[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'was') and contains(text(),'$')]"
                            )
                            item_price = was_elem.text.lower().replace("was", "").replace("$", "").strip()
                        except Exception:
                            pass
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

                link = "N/A"
                product_code = "N/A"
                try:
                    a = card.find_element(By.TAG_NAME, "a")
                    raw_link = a.get_attribute("href")
                    if raw_link:
                        link = raw_link if raw_link.startswith("http") else f"https://www.igashop.com.au{raw_link}"
                        m = re.search(r"(\d+)$", link)
                        if m:
                            product_code = m.group(1)
                except Exception:
                    pass

                special_text = "N/A"
                try:
                    card_text = card.text
                    lower_text = card_text.lower()
                    if "better than" in lower_text:
                        for line in card_text.split("\n"):
                            if "better than" in line.lower():
                                special_text = line.strip()
                                break
                    elif "%" in lower_text and "off" in lower_text:
                        for line in card_text.split("\n"):
                            if "%" in line and "off" in line.lower():
                                special_text = line.strip()
                                break
                    elif "age restricted" in lower_text:
                        special_text = "Age restricted item"
                    elif "special" in lower_text:
                        special_text = "Special"
                except Exception:
                    pass

                category = "N/A"

                doc = {
                    "product_code": product_code,
                    "category": category,
                    "item_name": f"{item_name} {item_size}".strip(),
                    "item_price": item_price,     
                    "best_price": best_price,     
                    "unit_price": unit_price,
                    "special_text": special_text,
                    "promo_text": "N/A",
                    "image": image,
                    "timestamp": datetime.now().isoformat(),
                    "link": link,
                }

                page_docs.append(doc)

                print(f"  #{idx} -> {doc['item_name']} | now: {best_price} | was: {item_price}")

            if page_docs:
                try:
                    collection.insert_many(page_docs)
                    total_saved += len(page_docs)
                    print(f"Saved {len(page_docs)} products from page {page} to MongoDB.")
                except Exception as e:
                    print(" Failed to save to MongoDB:", e)
            else:
                print("No items parsed on this page. Stopping.")
                break

            page += 1
            time.sleep(1)
    finally:
        driver.quit()

    print(f"\n Done. Scraped total: {total_saved} products.")


if __name__ == "__main__":
    print("Starting IGA specials scraper...")
    scrape_iga_specials()
    print("Done.")
