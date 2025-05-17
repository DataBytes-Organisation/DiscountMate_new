import os
import csv
import configparser
import re
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup as bs
from pymongo import MongoClient

# CONFIG
config = configparser.ConfigParser()
config.read('configuration.ini')

BASE_FOLDER = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FOLDER = os.path.join(BASE_FOLDER, "output")
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

WAIT_TIME = int(config.get('IGA', 'delayseconds', fallback='3'))
IGNORED_CATEGORIES = config.get('IGA', 'ignoredcategories', fallback='').split(',')

timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
CSV_FILENAME = f"IGA_{timestamp}.csv"
FILE_PATH = os.path.join(OUTPUT_FOLDER, CSV_FILENAME)

url = "https://www.igashop.com.au"

# MongoDB setup
client = MongoClient('mongodb+srv://discountmate_read_and_write:discountmate@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster')
db = client['DiscountMate']
collection = db['ScrappedData']

# CSV Header
with open(FILE_PATH, "w", newline="", encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow([
        "product_code", "category", "item_name", "best_price",
        "best_unit_price", "item_price", "unit_price",
        "price_was", "special_text", "link"
    ])

ALCOHOL_KEYWORDS = [
    'wine', 'beer', 'spirits', 'vodka', 'whiskey', 'double lemon',
    'champagne', 'cider', 'brandy', 'tequila', 'rum', 'gin',
    '19 crimes', 'cabernet', 'chardonnay', 'red blend', 'shiraz'
]

def is_alcohol_product(name):
    name_lower = name.lower()
    for keyword in ALCOHOL_KEYWORDS:
        if re.search(rf"\b{re.escape(keyword)}\b", name_lower):
            return True
    return False

def get_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

def close_dialogue_box(driver):
    try:
        driver.find_element(By.XPATH, "/html/body/div[3]/div/div/button").click()
    except Exception:
        pass

def scrape_products(driver, link, category):
    products_page_link = link
    page = 1
    while True:
        print(f"Scraping {category} - Page {page}")
        driver.get(products_page_link)
        time.sleep(WAIT_TIME)
        close_dialogue_box(driver)

        if category == "Specials":
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(WAIT_TIME * 2)

        soup = bs(driver.page_source, "html.parser")
        products = soup.find_all("div", class_="overflow-hidden rounded border border-border/50 bg-white text-foreground relative h-auto w-full p-2 md:h-[412px] md:w-[245px] md:p-3 md:pt-8")

        if not products:
            print(f"No products found on {category} page {page}")
            break

        for product in products:
            try:
                name_tag = product.find("span", class_="line-clamp-3")
                itemprice_tag = product.find("span", class_="font-bold leading-none")
                if not name_tag or not itemprice_tag:
                    continue

                product_name = name_tag.get_text(strip=True)
                if category == "Specials" and is_alcohol_product(product_name):
                    print(f"Skipping alcohol product in Specials: {product_name}")
                    continue

                itemprice = itemprice_tag.get_text(strip=True)
                product_link = product.find("a")['href']
                product_code = (product_link.split("/")[-1]).split("-")[-1]

                unitprice = ""
                unit_tag1 = product.find("div", class_="relative flex text-sm lg:top-0")
                unit_tag2 = product.find("div", class_="flex gap-0 md:flex-col md:text-right")
                if unit_tag1:
                    unitprice = unit_tag1.get_text(strip=True)
                elif unit_tag2:
                    unitprice = unit_tag2.get_text(strip=True)

                price_was_tag = product.find("div", class_="relative inline-flex w-fit shrink-0 items-center rounded px-3 py-1 font-sans text-sm font-bold bg-secondary text-secondary-foreground")
                specialtext_tag = product.find("div", class_="relative inline-flex w-fit shrink-0 items-center rounded px-3 py-1 font-sans text-sm font-bold bg-primary text-primary-foreground justify-center md:absolute md:inset-x-0 md:top-0 md:h-3 md:w-full md:rounded-b-none md:rounded-t-sm md:p-3 md:text-base")

                price_was = price_was_tag.get_text(strip=True).replace('was', '').strip() if price_was_tag else ""
                specialtext = specialtext_tag.get_text(strip=True) if specialtext_tag else ""

                if price_was and category != "Specials":
                    continue

                product_data = {
                    "product_code": product_code,
                    "category": category,
                    "item_name": product_name,
                    "best_price": itemprice,
                    "best_unit_price": unitprice,
                    "item_price": itemprice,
                    "unit_price": unitprice,
                    "price_was": price_was,
                    "special_text": specialtext,
                    "link": url + product_link
                }

                # Save to CSV
                with open(FILE_PATH, "a", newline="", encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(product_data.values())

                # Insert into MongoDB
                collection.update_one(
                    {"product_code": product_code, "category": category},
                    {"$set": product_data},
                    upsert=True
                )

            except Exception as e:
                print(f"Error processing product: {e}")

        # Check for next page
        next_button = soup.select_one('a[aria-label="Go to next page"]')
        if next_button and next_button.get("aria-disabled") == "false":
            products_page_link = url + next_button["href"]
            page += 1
        else:
            break

# Categories list
categories = [
    {"name": "Specials", "link": "/specials/1"},
    {"name": "Fruit and Vegetable", "link": "/categories/fruit-and-vegetable"},
    {"name": "Pantry", "link": "/categories/pantry"},
    {"name": "Meat, Seafood and Deli", "link": "/categories/meat-seafood-and-deli"},
    {"name": "Dairy, Eggs and Fridge", "link": "/categories/dairy-eggs-and-fridge"},
    {"name": "Bakery", "link": "/categories/bakery"},
    {"name": "Drinks", "link": "/categories/drinks"},
    {"name": "Frozen", "link": "/categories/frozen"},
    {"name": "Health and Beauty", "link": "/categories/health-and-beauty"},
    {"name": "Pet", "link": "/categories/pet"},
    {"name": "Baby", "link": "/categories/baby"},
    {"name": "Liquor", "link": "/categories/liquor-food"},
    {"name": "Household", "link": "/categories/household"},
    {"name": "Other", "link": "/categories/other"}
]

categories = [cat for cat in categories if cat["name"] not in IGNORED_CATEGORIES]

# Start driver session
driver = get_driver()

# Process categories
for cat in categories:
    cat_link = url + cat["link"]
    cat_name = cat["name"]
    print(f"Processing category: {cat_name}")
    driver.get(cat_link)
    time.sleep(WAIT_TIME)
    close_dialogue_box(driver)

    soup = bs(driver.page_source, "html.parser")
    sub_links = soup.find_all('a', class_='flex rounded font-bold md:bg-primary md:px-4 md:py-2 md:text-white')

    if sub_links:
        for sub in sub_links:
            sub_link = url + sub['href']
            print(f"  Subcategory: {sub.get_text(strip=True)}")
            scrape_products(driver, sub_link, cat_name)
    else:
        scrape_products(driver, cat_link, cat_name)

driver.quit()
print("Scraping completed successfully.")