
# -----------------------------
#   Import Required Libraries
# -----------------------------

import json
import os
import time
import random
import configparser
import requests
import re
import seleniumwire.undetected_chromedriver.v2 as uc
from datetime import datetime
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium_stealth import stealth
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import os


# -------------------------
#     Load Configurations
# -------------------------
load_dotenv()
config = configparser.ConfigParser()
config.read('configurations.ini')
url = "https://www.coles.com.au"
delay = int(config.get('Coles', 'DelaySeconds'))
script_dir = os.path.dirname(os.path.abspath(__file__))
folderpath = script_dir


# ---------------------------------------------------------------------------------------------------
#                                          Utility Functions
# ---------------------------------------------------------------------------------------------------

# This function sets random delay based on the parameters provided
def human_delay(min_sec=1.5, max_sec=3.5):
    if random.random() < 0.8:
        time.sleep(random.uniform(min_sec, max_sec))

# This function checks if the website is giving us a CAPTCHA challenge to solve
def is_captcha_present(driver):
    return (
        "_incapsula_" in driver.current_url.lower() or
        bool(driver.find_elements(By.XPATH, "//iframe[contains(@src, '_Incapsula_Resource')]")) or
        "captcha" in driver.page_source.lower()
    )
    
# This function is used to pause execution of the further code until the CAPTCHA challenge is manually solved
def wait_for_captcha(driver, timeout=120):
    try:
        print("CAPTCHA iframe detected. Waiting for it to disappear...")
        WebDriverWait(driver, timeout).until_not(
            EC.presence_of_element_located((By.XPATH, "//iframe[contains(@src, '_Incapsula_Resource')]"))
        )
        print("CAPTCHA solved. Continuing...")
    except TimeoutException:
        print("Timed out waiting for CAPTCHA to be solved. Try again")

# --------------------------------------------------------------------------------------------------
#  This function is used to configure proxy from SmartProxy.com. Each time it is called,
#  it gives a fresh IP, user-agent, combined with other stealth and anti bot detection techniques

#  ** We are using paid datacenter proxies with location set to Australia so make sure you subscribe 
#  to it and add your credentials in the configuration file**
# --------------------------------------------------------------------------------------------------

def get_rotated_driver():

    proxy_user_base = os.getenv("SMARTPROXY_USERNAME")
    proxy_pass = os.getenv("SMARTPROXY_PASSWORD")
    proxy_host = os.getenv("SMARTPROXY_HOST")
    ports_str = os.getenv("SMARTPROXY_PORTS")
    session_id = random.randint(100000, 999999)
    proxy_user = f"{proxy_user_base}-session-{session_id}"
    proxy_port = random.choice([port.strip() for port in ports_str.split(',')])
    proxy_auth = f"http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}"

    seleniumwire_options = {
        'proxy': {
            'http': proxy_auth,
            'https': proxy_auth,
            'no_proxy': 'localhost,127.0.0.1'
        }
    }

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.157 Safari/537.36"
    
    options = uc.ChromeOptions()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument(f"--user-agent={user_agent}")

    driver = uc.Chrome(
        seleniumwire_options=seleniumwire_options,
        options=options,
        use_subprocess=True
    )

    driver.set_window_size(random.randint(1000, 1400), random.randint(700, 1000))

    stealth(driver,
        languages=["en-US", "en"],
        vendor="Google Inc.",
        platform="Win32",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
        run_on_insecure_origins=True
    )

    driver.execute_script("delete navigator.__proto__.webdriver")

    # Check if proxy is working
    try:
        driver.get("https://api.ipify.org?format=text")
        time.sleep(2)
        ip = driver.find_element(By.TAG_NAME, "body").text.strip()
        print(f"Proxy IP detected: Proxy is Connected and Working: {ip}")

        if ip.startswith("127.") or ip == "localhost":
            print("Proxy not active. Aborting. Check your Proxy Credentials")
            driver.quit()
            exit(1)

    except Exception as e:
        print(f"Proxy check failed: {e}. Aborting.")
        driver.quit()
        exit(1)

    time.sleep(random.randint(10, 15))

    return driver

# This function modifies the session and returns it, this is important because incapsula adds several parameters
# to the cookies after the CAPTCHA is solved which is needed later while sending request to the API otherwise it will
# be blocked. Also, we need to set click and collect location and store id through this as well.

def get_requests_session_with_cookies(driver):

    session = requests.Session()

    for cookie in driver.get_cookies():
        session.cookies.set(cookie['name'], cookie['value'])

    #Setting the click and collect location and fulfillmentstoreId below -- this is similar to selecting C&C location on UI
    # Load fulfillment store ID from config - You can select a particular store on UI and inspect network request to find
    # a store ID for a particular store

    #!! IMPORTANT- Make sure store ID is set successfully and cookie is passed properly otherwise the API will return 500

    fulfillment_store_id = config.get('Coles', 'FulfillmentStoreId', fallback='0357')

    session.cookies.set("fulfillmentStoreId", fulfillment_store_id, domain=".coles.com.au")
    session.cookies.set("shopping-method", "clickAndCollect", domain=".coles.com.au")

    return session

# This function is used to fetch data from each paginated pages of the categories

def fetch_category_page(session, build_id, category, page):
    url = f"https://www.coles.com.au/_next/data/{build_id}/en/browse/{category}.json?page={page}&slug={category}"

    try:
        res = session.get(url)
        
        # Check for block (HTML content or redirect)
        if res.status_code != 200:
            print(f"Failed: {url} returned status {res.status_code}")
            return "serverError"
        
        if "text/html" in res.headers.get("Content-Type", ""):
            print(f"HTML instead of JSON — possible block or error page for {category}")
            return "blocked"

        # Try parsing JSON
        json_data = res.json()

        # If Coles explicitly says category not found
        if json_data.get("notFound") is True:
            print(f"Category not available: {category} (notFound = true)")
            return "notFound"

        #Validate Coles API Schema
        page_props = json_data.get("pageProps")
        if not isinstance(page_props, dict):
            print(f"ERROR: API structure changed — 'pageProps' missing for {category}")
            return "schemaError"

        search_results = page_props.get("searchResults")
        if not isinstance(search_results, dict):
            print(f"ERROR: API structure changed — 'searchResults' missing for {category}")
            return "schemaError"

        results = search_results.get("results")
        if not isinstance(results, list):
            print(f"ERROR: API structure changed — 'results' is not a list for {category}")
            return "schemaError"

        if not results:
            return "notFound"

        #Return data is everything is good
        return json_data

    except json.JSONDecodeError:
        print(f"!!Failed to decode JSON for {category}")
        return None

    except Exception as e:
        print(f"Error fetching page {page} for {category}: {e}")
        return None

# This function is used to parse the product data JSON which is returned by the product fetch API

def parse_product_data(json_data, category_slug):

    results = json_data.get("pageProps", {}).get("searchResults", {}).get("results", [])
    extracted = []

    for item in results:
        if item.get("_type") != "PRODUCT":
            continue

        pricing = item.get("pricing")

        if not pricing:
            continue

        merchandise = item.get("merchandiseHeir", {})

        extracted.append({
            "product_code": item.get("id", "N/A"),
            "category": merchandise.get("category", "Unknown"),
            "item_name": item.get("name", "Unnamed"),
            "best_price": pricing.get("now"),
            "item_price": pricing.get("was"),
            "unit_price": pricing.get("comparable"),
            "special_text": pricing.get("offerDescription", ""),
            "promo_text": pricing.get("specialType", ""),
            "link": f"https://www.coles.com.au/product/{item.get('id', '')}",
            "timestamp": datetime.now().isoformat(),
            "category_slug": category_slug
        })

    return extracted

# !IMPORTANT - This function is used to extract the build id dynamically from the elements of the web page.
# We need build id to send with the API requests otherwise it will fail

def extract_build_id(driver):

    try:

        json_data = driver.execute_script("return document.getElementById('__NEXT_DATA__').textContent;")
        data = json.loads(json_data)
        build_id = data.get("buildId")

        if not build_id:
            raise ValueError("Build ID not found in __NEXT_DATA__.")

        print(f"Detected build ID: {build_id}")
        return build_id
    
    except Exception as e:
        print(f"Failed to extract build ID: Check build ID extraction process and debug {e}")
        print("Cannot proceed without a valid build ID.")
        driver.quit()
        exit(1)

# --- Extract Level 1 Categories from Browse API Response - Level 1 are the main product categories displayed in Menu ---

def fetch_main_categories_from_browse_api(session, build_id):
    
    url = f"https://www.coles.com.au/_next/data/{build_id}/en/browse.json"

    try:
        res = session.get(url, timeout=15)
        res.raise_for_status()
        data = res.json()

        categories = {}
        level1_list = data.get("pageProps", {}).get("allProductCategories", {}).get("catalogGroupView", [])

        for cat in level1_list:
            if cat.get("level") != 1:
                continue
            if cat.get("type") != "CATALOG" or cat.get("productCount", 0) == 0:
                continue #skip and keep going
            name = cat.get("name")
            token = cat.get("seoToken")
            if name and token:
                categories[name] = token

        return categories

    except Exception as e:
        print("Failed to fetch from browse.json API. Using static categories for now, check the API", e)
        print("Falling back to static category list.")
        #If the dynamic categories extraction fails, manually add the slug for each of the categories for the particular store below
        return {
            "Bonus Credit Products": "bonus-credit-products",
            "Meat and Seafood": "meat-seafood",
            "Fruit and Vegetables": "fruit-vegetables",
            "Dairy Eggs and Fridge": "dairy-eggs-fridge",
            "Bakery": "bakery",
            "Deli": "deli",
            "Pantry": "pantry",
            "Dietary & World Foods": "dietary-world-foods",
            "Chips, Chocolates & Snacks": "chips-chocolates-snacks",
            "Drinks": "drinks",
            "Frozen": "frozen",
            "Household": "household",
            "Health & Beauty": "health-beauty",
            "Baby": "baby"
        }   

# ---------------------------------- END OF UTILITY FUNCTIONS ----------------------------------------------------------- #


# ----------------------------------- START SCRAPING SESSION  ----------------------------------------------------------- #

# Get a new driver and go to the home page of Coles
driver = get_rotated_driver()
driver.get("https://www.coles.com.au")

# Check if Coles gives us a CAPTCHA challenge. If yes, wait until it is manually solved
if is_captcha_present(driver):
    wait_for_captcha(driver)

# If there is no CAPTCHA challenge or the CAPTCHA is solved, set the session
session = get_requests_session_with_cookies(driver)


# Extract build id from the Coles website. If Coles changes their approach in webpage just obtain their build id from website
# manually and hardcode below for debugging and modify the respective function

build_id = extract_build_id(driver)

# Following are the full categories list that will be returned for a particular store
# We need to filter the categories we do not need for a particular scraping run after this

categories_to_scrape_raw = fetch_main_categories_from_browse_api(session, build_id)

# Filter Categories --- Specify the categories to exclude below
excluded_slugs = {"specials", "liquorland", "tobacco", "pet-essentials"}

# --- Print all the categories extracted dynamically from the API for the particular store ---
print(f"\n Categories extracted from for store is ({len(categories_to_scrape_raw)} total):")
for name, token in categories_to_scrape_raw.items():
    print(f" - {name}: {token}")

# Build the finalized list of categories to scrape after excluding the irrelevant categories
categories_to_scrape = {
    name: token
    for name, token in categories_to_scrape_raw.items()
    if token not in excluded_slugs
}

# Print excluded categories
print(f"\nCategories excluded ({len(excluded_slugs)}):")
for name in excluded_slugs:
    print(f" {name}")

# Print the categories that are being scraped  
print(f"\nReady to scrape {len(categories_to_scrape)} categories:")
for name, token in categories_to_scrape.items():
    print(f" - {name}: {token}")

# --- Start Scraping and Loop Through All the Selected Categories ---
all_data = []

for label, slug in categories_to_scrape.items():
    print(f"\n Scraping category: {label} ({slug})")
    page = 1
    retry_count = 0
    max_retries = 3

    while True:
        time.sleep(random.uniform(2, 3))
        print(f" Fetching page {page}...")
        data = fetch_category_page(session, build_id, slug, page)
        
        if data == "notFound":
            print(f"Skipping '{label}' — category not available.")
            break

        elif data == "blocked" or data == "serverError":
            # When a new browser is started, we need to go to Coles again, solve CAPTCHA challenge if given,
            # and set the sesssion again before moving on with the further scraping
            retry_count += 1

            if retry_count > max_retries:
                print(f"Max retries exceeded for {label} page {page}. Skipping to next category.")
                break
            
            print(f"Blocked while accessing '{label}'. Reinitializing browser and session...")
            driver.quit()
            driver = get_rotated_driver()
            driver.get("https://www.coles.com.au")

            if is_captcha_present(driver):
                wait_for_captcha(driver)

            session = get_requests_session_with_cookies(driver)
            continue  # Retry same page with new browser/session

        elif data == "schemaError":
            print(f" COLES API structure possibly changed for category '{label}'. Manual inspection required.")
            break

        elif data is None:
            print(f" Unexpected error while fetching '{label}' page {page}. Skipping category.")
            break

        # Proceed to parse the data if it’s valid
        products = parse_product_data(data, slug)

        if not products:
            print(" No more products on this page.")
            break

        # Continue saving the products data
        all_data.extend(products)
        page += 1

        time.sleep(random.uniform(2, 3)) # !IMPORTANT: Slow down between requests not to throttle the API gateway

# Get a timestamp that we use to save each scraping runs
now = datetime.now()
date_str = now.strftime("%Y-%m-%d")
time_str = now.strftime("%H%M")

supermarket_name = config.get('Coles', 'SupermarketName', fallback='coles')
location = config.get('Coles', 'Location', fallback='unknownloc')

filename = f"{supermarket_name}_{location}_{date_str}_{time_str}.json"

# Save the scraped data to a file in local computer
filepath = os.path.join(folderpath, filename)

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=4)

# --- MongoDB Config ---
username = os.getenv("MONGO_USERNAME")
password = os.getenv("MONGO_PASSWORD")
cluster = os.getenv("MONGO_CLUSTER")
appname = os.getenv("MONGO_APPNAME")
db_name = os.getenv("MONGO_DB")

# Save the scraped data to the MongoDB database
# --- Build Mongo URI ---
mongo_uri = f"mongodb+srv://{username}:{password}@{cluster}/?retryWrites=true&w=majority&appName={appname}"

# --- Connect and Insert ---
client = MongoClient(mongo_uri)
db = client[db_name]

collection_name = filename.replace(".json", "").replace("-", "_")
collection = db[collection_name]

collection.insert_many(all_data)
client.close()

# Scraping Completed
driver.quit()
print(f"SUCCESS: Scraped and saved {len(all_data)} products from all selected categories.")