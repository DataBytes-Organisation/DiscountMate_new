import csv
import os
import time
import configparser
from selenium import webdriver
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup as bs

# Retrieve configuration values
config = configparser.ConfigParser()
config.read('configuration.ini')

# Folder path and other configurations
folderpath = "C:/Users/Abhishek/DiscountMate_new/Scrapping/Australia_GroceriesScraper"
delay = int(config.get('IGA', 'delayseconds'))
category_ignore = str(config.get('IGA', 'ignoredcategories'))

# Create a new CSV file for IGA
filename = "IGA.csv"
filepath = os.path.join(folderpath, filename)
if os.path.exists(filepath):
    os.remove(filepath)

print("Saving to " + filepath)

# Write the header
with open(filepath, "a", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["Product Code", "Category", "Item Name", "Best Price", "Best Unit Price", "Item Price", "Unit Price", "Price Was", "Special Text", "Complex Promo Text", "Link"])

# Configure options for EdgeDriver
options = webdriver.EdgeOptions()
options.add_argument("--app=https://www.igashop.com.au")
options.add_experimental_option('excludeSwitches', ['enable-logging'])

# Start EdgeDriver
print("Starting IGA...")
driver = webdriver.Edge(options=options)

# Navigate to the IGA website
url = "https://www.igashop.com.au"
driver.get(url)
time.sleep(delay)

# Function to close the dialogue box
def close_dialogue_box():
    try:
        # Attempt to find and click the close button of the dialogue box
        close_button = driver.find_element(By.XPATH, "/html/body/div[3]/div/div/button")
        close_button.click()
    except:
        # If the button is not found, just pass
        print("Close button is not found")

# Set Click & Collect location (if necessary)
# Close dialogue box if it appears
close_dialogue_box()

# Parse the page content
page_contents = bs(driver.page_source, "html.parser")

categories = [
    {"name": "Specials", "link": "/categories/specials"},
    {"name": "Fruit and Vegetable", "link": "/categories/fruit-and-vegetable/vegetables/1"},
    {"name": "Pantry", "link": "/categories/pantry"},
    {"name": "Meat, Seafood and Deli", "link": "/categories/meat-seafood-deli"},
    {"name": "Dairy, Eggs and Fridge", "link": "/categories/dairy-eggs-fridge"},
    {"name": "Bakery", "link": "/categories/bakery"},
    {"name": "Drinks", "link": "/categories/drinks"},
    {"name": "Frozen", "link": "/categories/frozen"},
    {"name": "Health and Beauty", "link": "/categories/health-and-beauty"},
    {"name": "Pet", "link": "/categories/pet"},
    {"name": "Baby", "link": "/categories/baby"},
    {"name": "Liquor", "link": "/categories/liquor"},
    {"name": "Household", "link": "/categories/household"},
    {"name": "Other", "link": "/categories/other"},
    {"name": "Front of House", "link": "/categories/front-of-house"}
]

# Remove categories ignored in the config file
categories = [cat for cat in categories if cat["name"] not in category_ignore]

# Show the user the categories to scrape
print("Categories to Scrape:")
for category in categories:
    print(category["name"])

# Iterate through each category and follow the link to get the products
for category in categories:
    driver = webdriver.Edge(options=options)

    # Get the link to the category's page
    category_link = url + category["link"]
    category_name = category["name"]

    print("Loading Category: " + category_name)

    # Follow the link to the category page
    driver.get(category_link)
    time.sleep(delay)

    # Close dialogue box if it appears on the category page
    close_dialogue_box()

    # Parse page content
    soup = bs(driver.page_source, "html.parser")

    # Get the number of pages in this category
    try:
        pagination = page_contents.find("ul", class_="flex flex-row items")
        pages = pagination.find_all("li")
        total_pages = int(pages[-2].text.strip())
    except:
        total_pages = 1

    for page in range(1, total_pages + 1):
        soup = bs(driver.page_source, "html.parser")

        # Find all products on the page
        products = soup.find_all("div", class_="overflow-hidden rounded border")
        print(category_name + ": Page " + str(page) + " of " + str(total_pages) + " | Products on this page: " + str(len(products)))

        # Iterate through each product and extract the product details
        for product in products:
            name = product.find("div", class_="flex max-w-[85%]")
            itemprice = product.find("span", class_="font-bold leading-none")
            unitprice = product.find("span", class_="leading-none")
            specialtext = product.find("div", class_="relative inline-flex w-fit shrink-0 items-center rounded px-3 py-1 font-sans text-sm font-bold bg-primary")
            productLink = product.find("a", class_="relative justify-center")["href"]
            productcode = productLink.split("/")[-1]
            
            # Extract product details
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
                        price_was = unitprice[price_was_pos + 4:].strip()
                        unitprice = unitprice[:price_was_pos].strip()
                        if unitprice[0] == "|":
                            unitprice = None
                        else:
                            unitprice = unitprice[:unitprice.find("| was")].strip()

                    best_unitprice = unitprice
                else:
                    best_unitprice = None
                    price_was = None

                # Special Text
                if specialtext:
                    specialtext = specialtext.text.strip()
                    if specialtext == "1/2":
                        specialtext = "50%"

                # Complex Promo
                if complexpromo:
                    complexpromo = complexpromo.text.strip()
                    if "Pick any " in complexpromo or "Buy " in complexpromo:
                        try:
                            complexpromo = complexpromo.replace("Pick any ", "")
                            complexpromo = complexpromo.replace("Buy ", "")
                            complex_itemcount = int(complexpromo[:complexpromo.find(" for")])
                            complex_cost = float(complexpromo[complexpromo.find("$") + 1:])
                            best_price = "$" + str(round(complex_cost / complex_itemcount, 2))
                        except:
                            best_price = itemprice

                # Write contents to file
                with open(filepath, "a", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerow([productcode, category_name, name, best_price, best_unitprice, itemprice, unitprice, price_was, specialtext, complexpromo, link])

                # Reset variables
                name = None
                itemprice = None
                unitprice = None
                specialtext = None
                complexpromo = None
                productLink = None
                productcode = None
                price_was = None

        # Get the link to the next page
        next_page_link = f"{category_link}?page={page + 1}"

        # Restart browser every 50 pages
        if page % 50 == 0:
            print("Restarting Browser...")
            driver.close()
            driver = webdriver.Edge(options=options)

        # Navigate to the next page
        if total_pages > 1 and page + 1 <= total_pages:
            driver.get(next_page_link)
            close_dialogue_box()  # Close the dialogue box on the next page
        time.sleep(delay)

    time.sleep(delay)
    driver.close()

driver.quit()
print("Finished")
