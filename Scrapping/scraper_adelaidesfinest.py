from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException
from bs4 import BeautifulSoup
from pymongo.mongo_client import MongoClient
from datetime import datetime
import time
import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

# Setup headless browser
options = Options()
options.add_argument('--headless')
options.add_argument('--disable-gpu')
driver = webdriver.Chrome(options=options)

def get_text_or_default(value, default="N/A"):
    return value.text.strip() if value else default

def setup_mongo():
    load_dotenv()
    username = os.getenv("MONGO_USERNAME")
    password = os.getenv("MONGO_PASSWORD")
    cluster = os.getenv("MONGO_CLUSTER")
    appname = os.getenv("MONGO_APPNAME")
    db_name = os.getenv("MONGO_DB")

    if not all([username, password, cluster, appname, db_name]):
        raise ValueError("Missing MongoDB environment variables in .env")

    encoded_username = quote_plus(username)
    encoded_password = quote_plus(password)
    uri = f"mongodb+srv://{encoded_username}:{encoded_password}@{cluster}/?retryWrites=true&w=majority&appName={appname}"

    client = MongoClient(uri)
    db = client[db_name]

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    collection_name = f"Adelaides_Finest_{timestamp}"
    return db[collection_name]

def scrape_adelaides_finest_all_pages():
    url = "https://shop.adelaidesfinest.com.au/category/all"
    driver.get(url)
    time.sleep(5)

    results = []
    page_number = 1

    while True:
        print(f"Scraping page {page_number}...")
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        products = soup.find_all('div', class_="results-grid__result")

        if not products:
            print("No products found. Breaking.")
            break

        for product in products:
            product_name = get_text_or_default(product.find("h3", class_="title"))
            integral = get_text_or_default(product.find('span', class_='integral'))
            fractional = get_text_or_default(product.find('span', class_='fractional'))
            best_price = f"{integral}.{fractional}" if integral.isdigit() and fractional.isdigit() else "N/A"

            price_raw = get_text_or_default(product.find('span', class_='price__discount')).split('$')[-1].strip()
            try:
                item_price = float(price_raw) + float(best_price) if best_price != "N/A" else "N/A"
            except:
                item_price = "N/A"

            unit_price = get_text_or_default(product.find('div', class_='card__product-uom'))
            product_link = "https://shop.adelaidesfinest.com.au/" + product.find('a', class_="card__product-link").get('href') if product.find('a', class_="card__product-link") else "No link available"

            data = {
                "product_code": "N/A",
                "category": "N/A",
                "item_name": product_name,
                "item_price": item_price,
                "best_price": best_price,
                "unit_price": unit_price,
                "special_text": "N/A",
                "promo_text": "N/A",
                "link": product_link
            }

            results.append(data)

        try:
            next_button = driver.find_element(By.CSS_SELECTOR, 'a[aria-label="Next page"]')
            if next_button.get_attribute("aria-disabled") == "true":
                print("Last page reached.")
                break
            else:
                next_button.click()
                time.sleep(5)
                page_number += 1
        except NoSuchElementException:
            print("Next page button not found. Ending.")
            break

    if results:
        collection = setup_mongo()
        collection.insert_many(results)
        print("Scraping completed and saved to MongoDB!")
    else:
        print("No products scraped.")

if __name__ == "__main__":
    print("Starting Adelaide's Finest scrape...")
    scrape_adelaides_finest_all_pages()
    driver.quit()
