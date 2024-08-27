import json
import sys
import os
import time
import configparser
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException, TimeoutException, JavascriptException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import csv
from datetime import datetime
from webdriver_manager.chrome import ChromeDriverManager

def initialize_driver():
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    service = Service(ChromeDriverManager().install())
    try:
        driver = webdriver.Chrome(service=service, options=options)
    except WebDriverException:
        sys.exit("Error initializing web driver")
    return driver

def safe_get_url(driver, url):
    try:
        driver.get(url)
    except WebDriverException as e:
        print(f"Error accessing {url}: {str(e)} - Attempting to reinitialize driver.")
        driver.quit()
        driver = initialize_driver()
        driver.get(url)

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

def with_retries(operation, retries=3):
    for attempt in range(retries):
        try:
            return operation()
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            time.sleep(2)  # wait 2 seconds before retrying
    print("All attempts failed.")
    return None

# Initialize the array to store data
collected_data = []

# Retrieve configuration values
#config = configparser.ConfigParser()
#configFile = 'Scrapping/Australia_GroceriesScraper/configuration.ini'
#config.read(configFile)

# Main scraping logic including interaction with the webpage, parsing elements and appending data to array
#folderpath = os.path.join(os.getcwd(), "Scrapping/Australia_GroceriesScraper")
#delay = int(config.get('Woolworths','DelaySeconds'))
#category_ignore = str(config.get('Woolworths','IgnoredCategories'))

#if config.get('Woolworths','Resume_Active') == "TRUE":
#    resume_active = True
#else:
#    resume_active = False

#resume_category = config.get('Woolworths','Resume_Category')
#resume_page = int(config.get('Woolworths','Resume_Page'))

# Create a new csv file for Woolworths
#filename = "Woolworths.csv"
#filepath = os.path.join(folderpath, filename)

#if resume_active:
 #   print("Resuming at page " + str(resume_page) + " of " + str(resume_category))
#else:
#    print("Resume data not found, starting anew...")
#    if os.path.exists(filepath):
#        os.remove(filepath)

 #   with open(filepath, "a", newline="") as f:
 #       writer = csv.writer(f)
 #       writer.writerow(["Product Code", "Category", "Item Name", "Best Price", "Best Unit Price", "Item Price", "Unit Price", "Price Was", "Special Text", "Complex Promo Text", "Link", "Date Time Stamp"])
 #   f.close()

print("Saving to " + filepath)

driver = initialize_driver()
url = "https://www.woolworths.com.au"
safe_get_url(driver, url)
time.sleep(delay)

driver.find_element(By.XPATH, "//button[@class='wx-header__drawer-button browseMenuDesktop']").click()
time.sleep(delay)

page_contents = BeautifulSoup(driver.page_source, "html.parser")
categories = page_contents.find_all("a", class_="item ng-star-inserted")

if resume_active:
    found_resume_point = False
    for category in reversed(categories):
        category_name = category.text.strip()
        if found_resume_point:
            categories.remove(category)
        elif resume_category == category_name:
            found_resume_point = True

for category in reversed(categories):
    category_endpoint = category.get("href").replace("/shop/browse/", "")
    if category_ignore.find(category_endpoint) != -1:
        categories.remove(category)

print("Categories to Scrape:")
for category in categories:
    print(category.text)

time.sleep(delay)
driver.close()

for category in categories:
    driver = initialize_driver()
    category_link = url + category.get("href")
    category_name = category.text.strip()
    print("Loading Category: " + category_name)

    config.set('Woolworths', 'Resume_Category', category_name)
    with open(configFile, 'w') as cfgFile:
        config.write(cfgFile)
    cfgFile.close()

    safe_get_url(driver, category_link + "?pageNumber=1&sortBy=TraderRelevance&filter=SoldBy(Woolworths)")
    time.sleep(delay)

    page_contents = BeautifulSoup(driver.page_source, "html.parser")
    try:
        pageselement = driver.find_element(By.XPATH, "//span[@class='page-count']")
        total_pages = int(pageselement.get_attribute('innerText'))
    except:
        total_pages = 1

    first_page = resume_page if resume_active else 1
    for page in range(first_page, total_pages + 1):
        config.set('Woolworths', 'Resume_Page', str(page))
        with open(configFile, 'w') as cfgFile:
            config.write(cfgFile)
        cfgFile.close()

        page_contents = BeautifulSoup(driver.page_source, "html.parser")
        productsgrid = page_contents.find("shared-grid", class_="grid-v2")

        if not productsgrid:
            print("Waiting Longer....")
            time.sleep(delay)
            page_contents = BeautifulSoup(driver.page_source, "html.parser")
            productsgrid = page_contents.find("shared-grid", class_="grid-v2")

        products2 = driver.find_elements(By.XPATH, "//wc-product-tile[@class='ng-star-inserted']")
        productsCount2 = len(products2)
        print(category_name + ": Page " + str(page) + " of " + str(total_pages) + " | Products on this page: " + str(productsCount2))

        for productCounter in range(productsCount2):
            current_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            name = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('title')[0].innerText")

            try:
                itemprice = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('primary')[0].innerText")
            except:
                itemprice = ""

            try:
                unitprice = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('price-per-cup')[0].innerText")
            except:
                unitprice = ""

            try:
                specialtext = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('product-tile-label')[0].innerText")
            except:
                specialtext = ""

            try:
                promotext = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('product-tile-promo-info')[0].innerText")
            except:
                promotext = ""

            try:
                price_was_struckout = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('was-price ')[0].innerText")
            except:
                price_was_struckout = ""

            try:
                productLink = driver.execute_script("return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByTagName('a')[0].href")
            except:
                productLink = ""

            productcode = productLink.split("/")[-2]

            if productcode == "productdetails":
                productcode = productLink.split("/")[-1]

            if name and itemprice:
                name = name.strip()
                itemprice = itemprice.strip()
                unitprice = unitprice.strip()
                specialtext = specialtext.strip()
                best_price = itemprice
                best_unitprice = unitprice
                link = productLink

                if price_was_struckout:
                    price_was = price_was_struckout.strip()
                else:
                    price_was = None

                if promotext:
                    promotext = promotext.strip()
                    if promotext.find("Was ") != -1 or promotext.find("Range was ") != -1:
                        price_was = promotext[promotext.find("$"):promotext.find(" - ")]

                    if promotext.find("Member Price") != -1 or promotext.find(" for ") != -1:
                        if promotext.find("Member Price") != -1:
                            promotext = promotext.replace("Member Price", "").strip()

                        try:
                            promo_itemcount = int(promotext[0:promotext.find(" for")])
                            promo_price = float(promotext[promotext.find("$")+1:promotext.find(" - ")])
                            best_price = "$" + str(round(promo_price / promo_itemcount, 2))
                            if promotext.find(" - ") != -1:
                                best_unitprice = promotext[promotext.find(" - ")+3:len(promotext)]
                        except:
                            print("Member Price Error for " + str(promotext))
                            best_price = itemprice
                            best_unitprice = unitprice
                else:
                    promotext = None

                with open(filepath, "a", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerow([productcode, category_name, name, best_price, best_unitprice, itemprice, unitprice, price_was, specialtext, promotext, link, current_timestamp])

            next_page_link = f"{category_link}?pageNumber={page + 1}" + "&sortBy=TraderRelevance&filter=SoldBy(Woolworths)"

            if (page % 50 == 0):
                print("Restaring Browser...")
                driver.close()
                driver = initialize_driver()

            if total_pages > 1 and page + 1 <= total_pages:
                safe_get_url(driver, next_page_link)
            time.sleep(delay)

        time.sleep(delay)
        driver.close()

    driver.quit()

    f.close()

    config.set('Woolworths', 'Resume_Active', "FALSE")
    config.set('Woolworths', 'Resume_Category', "null")
    config.set('Woolworths', 'Resume_Page', "0")

    with open(configFile, 'w') as cfgFile:
        config.write(cfgFile)
    cfgFile.close()

print("Finished")
