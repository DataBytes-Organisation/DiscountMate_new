# Import necessary libraries
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, TimeoutException, JavascriptException
from urllib.parse import quote_plus
import time
import os
import sys
from bs4 import BeautifulSoup  # Ensure BeautifulSoup is imported
from dotenv import load_dotenv

# Initialize the WebDriver
def initialize_driver():
    options = webdriver.ChromeOptions()
    # Run Chrome in headless mode for GitHub Actions
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    try:
        driver = webdriver.Chrome(options=options)
    except WebDriverException:
        sys.exit("Error initializing web driver")
    return driver

# Navigate to URL safely
def safe_get_url(driver, url):
    try:
        driver.get(url)
    except WebDriverException as e:
        print(f"Error accessing {url}: {str(e)} - Attempting to reinitialize driver.")
        driver.quit()
        driver = initialize_driver()
        driver.get(url)

# Execute JavaScript safely
def execute_script_safe(driver, script, element_id):
    try:
        element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, element_id))
        )
        return driver.execute_script(script, element)
    except JavascriptException as e:
        print(f"JavaScript error: {str(e)}")
    except TimeoutException:
        print("Element not found within the timeout period.")

# Retry mechanism
def with_retries(operation, retries=3):
    for attempt in range(retries):
        try:
            return operation()
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            time.sleep(2)  # wait 2 seconds before retrying
    print("All attempts failed.")
    return None

# Setup MongoDB connection
def setup_mongo():
    # Load environment variables from .env file if it exists
    load_dotenv()
    
    # MongoDB credentials
    username = os.getenv('MONGO_USERNAME', 'discountmate')
    password = os.getenv('MONGO_PASSWORD', 'discountmate1')
    
    # Encode credentials for MongoDB URI
    encoded_username = quote_plus(username)
    encoded_password = quote_plus(password)
    
    # MongoDB URI construction
    uri = f'mongodb+srv://{encoded_username}:{encoded_password}@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster'
    
    # Initialize MongoDB client
    client = MongoClient(uri, server_api=ServerApi('1'))
    
    try:
        client.admin.command('ping')
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(e)
        sys.exit()
    
    # MongoDB database and collection
    db = client['ScrappedData']
    
    # Generate the custom string with the current date and time
    current_date_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    custom_string = f"{current_date_time}_Woolies"
    
    # Define collection based on the custom string
    collection = db[custom_string]
    return collection

# Main scraping logic
def scrape_woolworths(collection):
    # Configuration values (previously from configuration.ini)
    delay = 2  # Delay in seconds between actions
    category_ignore = "someCategoryToIgnore"  # Example category to ignore (can be an empty string)
    resume_active = False  # Set to True if resuming scraping
    resume_category = ""  # Category to resume from
    resume_page = 1  # Page to resume from

    # Start WebDriver
    print("Starting Woolworths...")
    driver = initialize_driver()
    
    # Navigate to the Woolworths website
    url = "https://www.woolworths.com.au"
    safe_get_url(driver, url)
    time.sleep(delay)
    
    # Open the menu drawer to get the category list
    driver.find_element(By.XPATH, "//button[@class='wx-header__drawer-button browseMenuDesktop']").click()
    time.sleep(delay)
    
    # Parse the page content
    page_contents = BeautifulSoup(driver.page_source, "html.parser")
    
    # Find all product categories on the page
    categories = page_contents.find_all("a", class_="item ng-star-inserted")
    
    # Remove categories earlier than the resume point if resume is active
    if resume_active:
        found_resume_point = False
        for category in reversed(categories):
            category_name = category.text.strip()
            if found_resume_point:
                categories.remove(category)
            else:
                if resume_category == category_name:
                    found_resume_point = True
    
    # Remove ignored categories
    for category in reversed(categories):
        category_endpoint = category.get("href").replace("/shop/browse/", "")
        if category_ignore.find(category_endpoint) != -1:
            categories.remove(category)
    
    # Show the user the categories to scrape
    print("Categories to Scrape:")
    for category in categories:
        print(category.text)
    
    time.sleep(delay)
    driver.quit()

    # Scrape each category
    for category in categories:
        driver = initialize_driver()
        category_link = url + category.get("href")
        category_name = category.text.strip()
        print("Loading Category: " + category_name)

        # Follow the link to the category page
        safe_get_url(driver, category_link + "?pageNumber=1&sortBy=TraderRelevance&filter=SoldBy(Woolworths)")
        time.sleep(delay)

        # Parse page content
        page_contents = BeautifulSoup(driver.page_source, "html.parser")

        # Get the number of pages in this category
        try:
            pageselement = driver.find_element(By.XPATH, "//span[@class='page-count']")
            total_pages = int(pageselement.get_attribute('innerText'))
        except:
            total_pages = 1
        
        first_page = resume_page if resume_active else 1

        for page in range(first_page, total_pages + 1):

            # Scrape products on the page
            page_contents = BeautifulSoup(driver.page_source, "html.parser")
            productsgrid = page_contents.find("shared-grid", class_="grid-v2")

            if productsgrid is None:
                print("Waiting Longer....")
                time.sleep(delay)
                page_contents = BeautifulSoup(driver.page_source, "html.parser")
                productsgrid = page_contents.find("shared-grid", class_="grid-v2")

            products = driver.find_elements(By.XPATH, "//wc-product-tile[@class='ng-star-inserted']")
            products_count = len(products)
            print(f"{category_name}: Page {page} of {total_pages} | Products on this page: {products_count}")

            for product_counter in range(products_count):
                current_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Current date and time

                # Scrape product data
                name = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('title')[0].innerText") or ""
                itemprice = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('primary')[0].innerText") or ""
                unitprice = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('price-per-cup')[0].innerText") or ""
                specialtext = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('product-tile-label')[0].innerText") or ""
                promotext = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('product-tile-promo-info')[0].innerText") or ""
                price_was_struckout = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('price-was-struckout')[0].innerText") or ""
                imageurl = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('product-tile-image__container')[0].children[0].src") or ""
                alertmsg = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('product-badges')[0].children[0].children[0].innerText") or ""
                stockstatus = driver.execute_script(f"return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[{product_counter}].shadowRoot.children[0].getElementsByClassName('stock-messaging')[0].innerText") or ""

                # Save data to MongoDB
                collection.insert_one({
                    "Category": category_name,
                    "Timestamp": current_timestamp,
                    "Name": name,
                    "ItemPrice": itemprice,
                    "UnitPrice": unitprice,
                    "SpecialText": specialtext,
                    "PromoText": promotext,
                    "StruckoutWasPrice": price_was_struckout,
                    "ImageURL": imageurl,
                    "AlertMessage": alertmsg,
                    "StockStatus": stockstatus,
                })

            time.sleep(delay)
            print(f"Finished scraping page {page} of {total_pages} in category: {category_name}")
            safe_get_url(driver, category_link + f"?pageNumber={page + 1}&sortBy=TraderRelevance&filter=SoldBy(Woolworths)")

        driver.quit()

# Setup MongoDB and start scraping
if __name__ == '__main__':
    collection = setup_mongo()
    scrape_woolworths(collection)

print("Script completed successfully!")
