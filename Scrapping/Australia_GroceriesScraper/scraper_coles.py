# --- Import Required Libraries ---
import json
import os
import time
import random
import configparser
import requests

from datetime import datetime
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from seleniumwire.webdriver import Chrome
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium_stealth import stealth
from fake_useragent import UserAgent
from pymongo import MongoClient
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse


# --- Load Configuration ---
config = configparser.ConfigParser()
config.read('configuration.ini')
url = "https://www.coles.com.au"

# --- Utility: Simulate human behavior with random delay and optional scroll ---
def human_delay(driver, min_sec=1.5, max_sec=3.5, scroll=False):
    # Only pause 80% of the time
    if random.random() < 0.8: 
        time.sleep(random.uniform(min_sec, max_sec))

    #40% chance to scroll
    if scroll and random.random() < 0.4:
        scroll_px = random.choice([random.randint(100, 400), random.randint(-150, -50), 0]) #sometimes don't scroll
        try:
            driver.execute_script(f"window.scrollBy(0, {scroll_px})")
        except Exception as e:
            print(f"[Scroll Error] Failed to scroll: {e}")


# --- Utility: Check for CAPTCHA presence ---
def is_captcha_present(driver):
    return (
        "_incapsula_" in driver.current_url.lower() or
        bool(driver.find_elements(By.XPATH, "//iframe[contains(@src, '_Incapsula_Resource')]")) or
        "captcha" in driver.page_source.lower()
    )


# --- Wait until CAPTCHA iframe disappears ---
def wait_for_captcha(driver, timeout=120):
    try:
        print("CAPTCHA iframe detected. Waiting for it to disappear...")
        WebDriverWait(driver, timeout).until_not(
            EC.presence_of_element_located((By.XPATH, "//iframe[contains(@src, '_Incapsula_Resource')]"))
        )
        print("CAPTCHA solved. Continuing...")
    except TimeoutException:
        print("Timed out waiting for CAPTCHA to be solved.")


# --- Close all tabs except the original one ---
def keep_only_first_tab(driver, first_handle):
    for handle in driver.window_handles:
        if handle != first_handle:
            driver.switch_to.window(handle)
            print("Closing extra tab:", driver.current_url)
            driver.close()
    driver.switch_to.window(first_handle)


# --- Robots.txt Checker ---
# Source: ScrapingAnt Blog - How to bypass Incapsula
# URL: https://scrapingant.com/blog/incapsula-bypass
# Accessed on: April 1, 2025
def can_fetch(url, user_agent='*'):
    rp = RobotFileParser()
    parsed_url = urlparse(url)
    robots_url = f'{parsed_url.scheme}://{parsed_url.netloc}/robots.txt'
    try:
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(user_agent, parsed_url.path)
    except Exception as e:
        print(f"Warning: Failed to parse robots.txt ({robots_url}):", str(e))
        return False


# --- Initialize WebDriver with Smartproxy and Stealth Configurations ---
def get_rotated_driver():
    # ---SMARTPROXY CONFIGURATIONS---
    proxy_user_base = config.get('Smartproxy', 'Username')
    proxy_pass = config.get('Smartproxy', 'Password')
    proxy_host = config.get('Smartproxy', 'Host')
    ports_str = config.get('Smartproxy', 'Port')

    # Generate a session id for each proxy session
    session_id = random.randint(100000, 999999)
    proxy_user = f"{proxy_user_base}-session-{session_id}"
    available_ports = [port.strip() for port in ports_str.split(',')]
    proxy_port = random.choice(available_ports)

    proxy_options = {
        'proxy': {
            'http': f"http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}",
            'https': f"http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}",
            'no_proxy': 'localhost,127.0.0.1'
        },
        'verify_ssl': False
    }

    #--- Generate a random User-Agent with browser/OS filter and fallback
    fallback_ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    try:
        ua = UserAgent(browsers=['chrome', 'safari'], os='win', min_percentage=2.0, fallback=fallback_ua)
        user_agent = ua.random
    except Exception as e:
        print("⚠️ Failed to generate UA, using fallback:", e)
        user_agent = fallback_ua

    # --- Chrome Options with Stealth ---
    options = Options()
    options.add_argument(f"user-agent={user_agent}")
    options.add_argument("accept-language=en-US,en;q=0.9")
    options.add_argument("accept-encoding=gzip, deflate, br")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # Create the Chrome driver with proxy and stealth options
    driver = Chrome(seleniumwire_options=proxy_options, options=options)

    # Randomly create the window size to avoid fixed fingerprint
    driver.set_window_size(random.randint(1000, 1400), random.randint(700, 1000))

    # Selenium stealth integration
    stealth(driver,
        languages=["en-US", "en"],
        vendor="Google Inc.",
        platform="Win32",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
        run_on_insecure_origins=True
    )

    # Remove navigator.webdriver flag to prevent detection
    driver.execute_script("delete navigator.__proto__.webdriver")

    return driver


# --- Respect robots.txt before starting ---
if not can_fetch("https://www.coles.com.au/browse"):
    print("Access to /browse is disallowed by robots.txt. Aborting scraping.")
    exit()


# --- Start WebDriver and go to Coles ---
print("Starting Coles...")
driver = get_rotated_driver()
driver.get("https://www.coles.com.au")

if is_captcha_present(driver):
    wait_for_captcha(driver)

time.sleep(random.randint(10, 15))

# --- Cookie handling using Selenium & Requests ---
def get_selenium_cookies(url):
    driver.get(url)
    time.sleep(5)
    return driver.get_cookies()

def get_requests_session_with_cookies(url):
    session = requests.Session()
    cookies = get_selenium_cookies(url)
    for cookie in cookies:
        session.cookies.set(cookie['name'], cookie['value'])
    return session

session = get_requests_session_with_cookies("https://www.coles.com.au")

# --- Load Configuration ---
delay = int(config.get('Coles', 'DelaySeconds'))
ccsuburb = str(config.get('Coles', 'ClickAndCollectSuburb'))
category_ignore = str(config.get('Coles', 'IgnoredCategories'))
collected_data = []
script_dir = os.path.dirname(os.path.abspath(__file__))
folderpath = script_dir

# --- Set Click & Collect Location ---
try:
    driver.get("https://www.coles.com.au/browse")
    if is_captcha_present(driver):
        wait_for_captcha(driver)

    time.sleep(random.uniform(5, 10))
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//button[@data-testid='delivery-selector-button']"))).click()
    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, "//section[@data-testid='shopping-method-drawer']")))
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//section[@data-testid='shopping-method-drawer']//button[@data-testid='tab-collection']"))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//div[@data-testid='suburb-postcode-autocomplete']"))).click()
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//div[@data-testid='suburb-postcode-autocomplete']/div/div"))).click()
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, "//input[@type='text' and @id='suburb-postcode-autocomplete']"))).send_keys(ccsuburb)
    first_suggestion = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//li[@id='suburb-postcode-autocomplete-option-0']")))
    driver.execute_script("arguments[0].click();", first_suggestion)
    radio_label = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@data-testid, 'card-radio-button')]/label")))
    driver.execute_script("arguments[0].click();", radio_label)
    set_location_btn = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//button[@data-testid='cta-secondary' and .//span[text()='Set location']]")))
    driver.execute_script("arguments[0].click();", set_location_btn)
    time.sleep(random.uniform(5, 10))
except Exception as e:
    print("Setting C+C Location Failed:", str(e))

# --- Parse Categories ---
page_contents = BeautifulSoup(driver.page_source, "html.parser")
categories = page_contents.find_all("a", class_="coles-targeting-ShopCategoriesShopCategoryStyledCategoryContainer")

# To limit scraping per category for testing or performance -- maximum number of products to collect
max_products = 20

# Prepare ignore list
category_ignore_list = [cat.strip() for cat in category_ignore.split(',')]

# Separate categories into ones to scrape and ignore
final_categories = []
ignored_categories = []

# Filter out ignored categories
for category in categories:
    category_endpoint = category.get("href").replace("/browse/", "").replace("/", "").lower()
    if category_endpoint in category_ignore_list:
        ignored_categories.append(category.text.strip())
    else:
        final_categories.append(category)

# Show ignored categories
if ignored_categories:
    print("Ignored Categories:")
    for ignored_cat in ignored_categories:
        print("-", ignored_cat)

#Show the user the categories to scrape
print("\n Categories to Scrape:")
for category in final_categories:
    print("-", category.text.strip())

# Iterate through each category and follow the link to get the products
for category in final_categories:
    category_link = url + category.get("href")
    category_name = category.text.strip()

    # Check if scraping this category is allowed
    if not can_fetch(category_link):
        print(f"Skipping category {category_name} - disallowed by robots.txt")
        continue

    print("Loading Category:", category_name)
    driver.get(category_link)
    human_delay(driver, 5, 10, scroll=True)
    human_delay(driver, 3, 6)
    keep_only_first_tab(driver, driver.current_window_handle)

    if is_captcha_present(driver):
        wait_for_captcha(driver)

    page_contents = BeautifulSoup(driver.page_source, "html.parser")

    try:
        pagination = page_contents.find("ul", class_="coles-targeting-PaginationPaginationUl")
        pages = pagination.find_all("li")
        total_pages = int(pages[-2].text.strip())
    except Exception as e:
        print(f"[Pagination Error] Could not determine total pages: {e}")
        total_pages = 1

    product_count = 0

    for page in range(1, total_pages + 1):
        if product_count >= max_products:
            break

        soup = BeautifulSoup(driver.page_source, "html.parser")
        products = soup.find_all("header", class_="product__header")
        print(f"{category_name}: Page {page} of {total_pages} | Products: {len(products)}")

        for product in products:
            if product_count >= max_products:
                break

            human_delay(driver, 0.5, 1.2, scroll=True)
            try:
                name = product.find("h2", class_="product__title").text.strip()
                itemprice = product.find("span", class_="price__value").text.strip()
                productLink = product.find("a", class_="product__link")["href"]
                productcode = productLink.split("-")[-1]
                unitprice = product.find("div", class_="price__calculation_method")
                specialtext = product.find("span", class_="roundel-text")
                complexpromo = product.find("span", class_="product_promotion complex")

                unitprice = unitprice.text.strip().lower() if unitprice else None
                specialtext = specialtext.text.strip() if specialtext else None
                complexpromo = complexpromo.text.strip() if complexpromo else None

                best_price = itemprice
                if complexpromo and ("Pick any " in complexpromo or "Buy " in complexpromo):
                    try:
                        promo = complexpromo.replace("Pick any ", "").replace("Buy ", "")
                        count = int(promo.split(" for")[0])
                        cost = float(promo.split("$")[-1])
                        best_price = f"${round(cost / count, 2)}"
                    except Exception as e:
                        print(f"[Promo Price Error] Couldn't calculate promo price: {e}")

                product_details = {
                    "product_code": productcode,
                    "category": category_name,
                    "item_name": name,
                    "best_price": best_price,
                    "item_price": itemprice,
                    "unit_price": unitprice,
                    "special_text": specialtext,
                    "promo_text": complexpromo,
                    "link": url + productLink
                }
                collected_data.append(product_details)
                product_count += 1
            except Exception as e:
                print(f"[Product Parsing Error] Skipping product due to error: {e}")
                continue

        if total_pages > 1 and page + 1 <= total_pages:
            next_page_url = f"{category_link}?page={page + 1}"
            if not can_fetch(next_page_url):
                print(f"Skipping page {page + 1} of {category_name} - disallowed by robots.txt")
                break
            if product_count >= max_products:
                break
            driver.get(next_page_url)
            human_delay(driver, 4, 8, scroll=True)
            keep_only_first_tab(driver, driver.current_window_handle)
            if is_captcha_present(driver):
                wait_for_captcha(driver)

        human_delay(driver, 3, 6)

    human_delay(driver, delay, delay + 5)

# --- Close the Browser ---
driver.quit()

# --- Save Data to JSON ---
current_date = datetime.today().strftime('%Y_%m_%d')
filepath = os.path.join(folderpath, f'{current_date}_Coles_data.json')
with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(collected_data, f, ensure_ascii=False, indent=4)

# --- Save Data to MongoDB ---
client = MongoClient('mongodb+srv://discountmate_read_and_write:discountmate@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster')
db = client['ScrappedData']
collection = db[f'{current_date}_Coles']
collection.insert_many(collected_data)
client.close()

print("Data inserted successfully.")
print("Finished")