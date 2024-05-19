import json
import os
import time
import configparser
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from bs4 import BeautifulSoup

# Retrieve configuration values
config = configparser.ConfigParser()
config.read('configuration.ini')

# Initialize the array to store data
collected_data = []

# folderpath = str(config.get('Global','SaveLocation'))
# folderpath = "/Users/KarishmaKhanna/Documents/Deakin/TeamProject-SIT764/Week5"

script_dir = os.path.dirname(os.path.abspath(__file__))
folderpath = script_dir

delay = int(config.get('Coles', 'DelaySeconds'))
ccsuburb = str(config.get('Coles', 'ClickAndCollectSuburb'))
category_ignore = str(config.get('Coles', 'IgnoredCategories'))

# Configure options
options = webdriver.EdgeOptions()
options.add_argument("--app=https://www.coles.com.au")
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36")
options.add_experimental_option('excludeSwitches', ['enable-logging'])

# Start EdgeDriver
print("Starting Coles...")
driver = webdriver.Edge(options=options)

# Navigate to the Coles website
url = "https://www.coles.com.au"
driver.get(url + "/browse")

time.sleep(30)

try:
    # Set Location via Menu Items
    driver.find_element(By.XPATH, "//button[@data-testid='delivery-selector-button']").click()
    time.sleep(delay)
    print('1')
    driver.find_element(By.XPATH, "//a[@id='shopping-method-label-0']").click()
    time.sleep(delay)
    print('1')
    driver.find_element(By.XPATH, "//input[@aria-label='Search address']").send_keys(ccsuburb)
    time.sleep(delay)
    print('1')
    driver.find_element(By.XPATH, "//div[@id='react-select-search-location-box-option-0']").click()
    time.sleep(delay)
    print('1')
    driver.find_element(By.XPATH, "//input[@name='radio-group-name'][@value='0']").click()
    time.sleep(delay)
    print('1')
    driver.find_element(By.XPATH, "//button[@data-testid='set-location-button']").click()
    time.sleep(delay)
except Exception as e:
    print("Setting C+C Location Failed:", str(e))

# Parse the page content
page_contents = BeautifulSoup(driver.page_source, "html.parser")

# Find all product categories on the page
categories = page_contents.find_all("a", class_="coles-targeting-ShopCategoriesShopCategoryStyledCategoryContainer")

# Remove categories ignored in the config file
for category in reversed(categories):
    category_endpoint = category.get("href").replace("/browse/", "")
    category_endpoint = category_endpoint.replace("/", "")
    if category_ignore.find(category_endpoint) != -1:
        categories.remove(category)

# Show the user the categories to scrape
print("Categories to Scrape:")
for category in categories:
    print(category.text)

# Maximum number of products to collect
max_products = 10
product_count = 0

# Iterate through each category and follow the link to get the products
for category in categories:
    # Start browser
    driver = webdriver.Edge(options=options)

    # Get the link to the category's page
    category_link = url + category.get("href")
    category_name = category.text.strip()

    print("Loading Category: " + category_name)

    # Follow the link to the category page
    driver.get(category_link)
    time.sleep(30)

    # Parse page content
    page_contents = BeautifulSoup(driver.page_source, "html.parser")

    # Get the number of pages in this category
    try:
        pagination = page_contents.find("ul", class_="coles-targeting-PaginationPaginationUl")
        pages = pagination.find_all("li")
        total_pages = int(pages[-2].text.strip())
    except Exception as e:
        total_pages = 1
    product_count = 0
    for page in range(1, total_pages + 1): 
        if product_count >= max_products:
                break

        # Parse the page content
        soup = BeautifulSoup(driver.page_source, "html.parser")

        # Find all products on the page
        products = soup.find_all("header", class_="product__header")
        print(category_name + ": Page " + str(page) + " of " + str(total_pages) + " | Products on this page: " + str(len(products)))

        # Iterate through each product and extract the product name, price, and link        
        for product in products:
            if product_count >= max_products:
                break

            name = product.find("h2", class_="product__title")
            itemprice = product.find("span", class_="price__value")
            unitprice = product.find("div", class_="price__calculation_method")
            specialtext = product.find("span", class_="roundel-text")
            complexpromo = product.find("span", class_="product_promotion complex")
            productLink = product.find("a", class_="product__link")["href"]
            productcode = productLink.split("-")[-1]
            price_was = None

            if name and itemprice:
                name = name.text.strip()
                itemprice = itemprice.text.strip()
                best_price = itemprice
                link = url + productLink

                # Unit Price and Was Price
                if unitprice:
                    unitprice = unitprice.text.strip().lower()
                    price_was_pos = unitprice.find("was $")

                    if price_was_pos != -1:
                        price_was = unitprice[price_was_pos - 1 + 6:len(unitprice)]
                        unitprice = unitprice[0:price_was_pos].strip()
                        if unitprice[0:1] == "|":
                            unitprice = None
                        else:
                            unitprice = unitprice[0:unitprice.find("| was") - 1].strip()

                    best_unitprice = unitprice
                # Special Text
                if specialtext:
                    specialtext = specialtext.text.strip()
                    if specialtext == "1/2":
                        specialtext = "50%"

                # Complex Promo
                if complexpromo:
                    complexpromo = complexpromo.text.strip()
                    # Get ComplexPromo price
                    if complexpromo.find("Pick any ") != -1 or complexpromo.find("Buy ") != -1:
                        try:
                            complexpromo = complexpromo.replace("Pick any ", "")
                            complexpromo = complexpromo.replace("Buy ", "")
                            complex_itemcount = int(complexpromo[0:complexpromo.find(" for")])
                            complex_cost = float(complexpromo[complexpromo.find("$") + 1:len(complexpromo)])
                            best_price = "$" + str(round(complex_cost / complex_itemcount, 2))
                        except:
                            best_price = itemprice

                # Collect product details
                product_details = {
                    "product_code": productcode,
                    "category": category_name,
                    "item_name": name,
                    "best_price": best_price,
                    "best_unit_price": best_unitprice,
                    "item_price": itemprice,
                    "unit_price": unitprice,
                    "price_was": price_was,
                    "special_text": specialtext,
                    "promo_text": complexpromo,
                    "link": link
                }
                collected_data.append(product_details)
                product_count += 1

            # Reset variables
            name = None
            itemprice = None
            unitprice = None
            specialtext = None
            promotext = None
            memberpromo = None
            productLink = None
            productcode = None
            specialtext = None
            complexpromo = None
            complex_itemcount = None
            complex_cost = None
            best_price = None
            best_unitprice = None
            price_was = None

        # Get the link to the next page
        next_page_link = f"{category_link}?page={page + 1}"

        # Restart browser every 50 pages
        # if page % 50 == 0:
        #     print("Restarting Browser...")
        #     driver.close()
        #     driver = webdriver.Edge(options=options)

        # Navigate to the next page
        if total_pages > 1 and page + 1 <= total_pages:
            driver.get(next_page_link)
        # Wait the delay time before the next page
        time.sleep(delay)

    # Wait the delay time before the next Category
    time.sleep(delay)
    # Close the browser
    driver.close()

driver.quit()
json_data = json.dumps(collected_data, indent=4)
filepath = os.path.join(folderpath, 'test2.json')
with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(collected_data, f, ensure_ascii=False, indent=4)
print("Finished")
