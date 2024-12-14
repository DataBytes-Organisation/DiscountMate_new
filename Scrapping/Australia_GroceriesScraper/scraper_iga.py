import csv
import os
import re
import time
import configparser
from selenium import webdriver
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup as bs

# Initialize page counter
all_pages = 0

# Retrieve configuration values
config = configparser.ConfigParser()
config.read('configuration.ini')

# Folder path and configurations
folderpath = r"C:\Users\Administrator\Desktop"  # Folder for saving file
delay = int(config.get('IGA', 'delayseconds'))
category_ignore = str(config.get('IGA', 'ignoredcategories'))

# Set up the file for saving data
filename = "IGA.csv"
filepath = os.path.join(folderpath, filename)

# Remove existing file if it exists
if os.path.exists(filepath):
    os.remove(filepath)

print("Saving to " + filepath)

# Write the header to the CSV file
with open(filepath, "a", newline="", encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(
        ["Product Code", "Category", "Item Name", "Best Price", "Best Unit Price", "Item Price", "Unit Price",
         "Price Was", "Special Text", "Link"])

# Configure options for the EdgeDriver
options = webdriver.EdgeOptions()
options.add_argument("--app=https://www.igashop.com.au")
options.add_experimental_option('excludeSwitches', ['enable-logging'])

# Start the EdgeDriver
print("Starting IGA...")
driver = webdriver.Edge(options=options)

# Navigate to IGA website
url = "https://www.igashop.com.au"
driver.get(url)
time.sleep(delay)


# Function to close the dialog box if it appears
def close_dialogue_box():
    try:
        close_button = driver.find_element(By.XPATH, "/html/body/div[3]/div/div/button")
        close_button.click()
    except:
        print("Close button is not found")


# Function to get product data
def get_products_data(link, category):
    global all_pages
    driver = webdriver.Edge(options=options)
    products_of_this_category = 0
    products_page_link = link
    page = 1

    while True:
        print(products_page_link)
        driver.get(products_page_link)
        time.sleep(delay)
        close_dialogue_box()
        time.sleep(delay)
        soup = bs(driver.page_source, "html.parser")

        # Collect product information
        products = soup.find_all("div",
                                 class_="overflow-hidden rounded border border-border/50 bg-white text-foreground relative h-auto w-full p-2 md:h-[412px] md:w-[245px] md:p-3 md:pt-8")
        for product in products:
            save = 1
            name = product.find("span", class_="line-clamp-3")
            itemprice = product.find("span", class_="font-bold leading-none")
            price_was_pos = product.find("div",
                                         class_="relative inline-flex w-fit shrink-0 items-center rounded px-3 py-1 font-sans text-sm font-bold bg-secondary text-secondary-foreground")
            unitprice1 = product.find("div", class_="relative flex text-sm lg:top-0")
            unitprice2 = product.find("div", class_="flex gap-0 md:flex-col md:text-right")
            specialtext = product.find("div",
                                       class_="relative inline-flex w-fit shrink-0 items-center rounded px-3 py-1 font-sans text-sm font-bold bg-primary text-primary-foreground justify-center md:absolute md:inset-x-0 md:top-0 md:h-3 md:w-full md:rounded-b-none md:rounded-t-sm md:p-3 md:text-base")
            productLink_location = product.find("div", class_="flex max-w-[85%] md:max-w-full")
            productLink = product.find("a")['href']
            productcode = (productLink.split("/")[-1]).split("-")[-1]
            unitprice = " "

            # If product name and price exist, save the data
            if name and itemprice:
                name = name.get_text(strip=True)
                itemprice = itemprice.get_text(strip=True)
                best_price = itemprice
                link = url + productLink
                if unitprice1:
                    unitprice1 = unitprice1.get_text(strip=True)
                    unitprice = unitprice1
                    best_unitprice = unitprice
                elif unitprice2:
                    unitprice2 = unitprice2.get_text(strip=True)
                    unitprice = unitprice2
                    best_unitprice = unitprice
                else:
                    best_unitprice = None

                if price_was_pos:
                    if(category!="Specials"):save=0
                    price_was_pos = (price_was_pos.get_text()).replace('was', '').strip()

                if specialtext:
                    specialtext = specialtext.text.strip()
                    if specialtext == "1/2":
                        specialtext = "50%"

                if save == 1:
                    with open(filepath, "a", newline="", encoding='utf-8') as f:
                        writer = csv.writer(f)
                        writer.writerow(
                            [productcode, category_name, name, best_price, best_unitprice, itemprice, unitprice,
                             price_was_pos, specialtext, link])

                # Reset variables
                name = None
                itemprice = None
                unitprice = None
                specialtext = None
                productLink = None
                productcode = None

        products_of_this_category += len(products)
        print(category_name + ": Page " + str(page) + " | Products on this page: " + str(len(products)))
        print("Products in this category up to now: " + str(products_of_this_category))

        if all_pages % 50 == 0:
            print("Restarting Browser...")
            driver.close()
            driver = webdriver.Edge(options=options)
        page += 1
        all_pages += 1  # Increment the page counter

        # Check if there is a next page
        product_next_page = soup.select_one('a[aria-label="Go to next page"]')
        if product_next_page["aria-disabled"] == "false":
            products_page_link = "https://www.igashop.com.au" + product_next_page["href"]
        else:
            break

    time.sleep(delay)
    driver.close()


# Close any initial popups
close_dialogue_box()

page_contents = bs(driver.page_source, "html.parser")
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
    {"name": "Other", "link": "/categories/other"},
]

# Filter out ignored categories
categories = [cat for cat in categories if cat["name"] not in category_ignore]

# Iterate through categories and fetch products
for category in categories:
    driver = webdriver.Edge(options=options)
    category_link = url + category["link"]
    category_name = category["name"]

    print("Loading Category: " + category_name)

    driver.get(category_link)
    time.sleep(delay)
    close_dialogue_box()
    time.sleep(delay)
    soup = bs(driver.page_source, "html.parser")
    small_categories = soup.find_all('a', class_='flex rounded font-bold md:bg-primary md:px-4 md:py-2 md:text-white')

    if small_categories:
        for small_categories_link in small_categories:
            if small_categories_link:
                category_link = "https://www.igashop.com.au" + small_categories_link['href']
                get_products_data(link=category_link, category=category_name)
    else:
        get_products_data(link=category_link, category=category_name)

    print("Page number now: " + str(all_pages))

driver.quit()
print("Finished")
