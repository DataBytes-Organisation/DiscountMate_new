import sys
import csv
import os
import time
import configparser
from selenium import webdriver
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup

#retreive configuration values
config = configparser.ConfigParser()
configFile = 'configuration.ini'
config.read(configFile)

#folderpath = str(config.get('Global','SaveLocation'))
folderpath = "/Users/KarishmaKhanna/Documents/Deakin/TeamProject-SIT764/Week5"
delay = int(config.get('Woolworths','DelaySeconds'))
category_ignore = str(config.get('Woolworths','IgnoredCategories'))

if(config.get('Woolworths','Resume_Active') == "TRUE"):
    resume_active = True
else:
    resume_active = False

resume_category = config.get('Woolworths','Resume_Category')
resume_page = int(config.get('Woolworths','Resume_Page'))

# Create a new csv file for Woolworths
filename = "Woolworths" + ".csv"
filepath = os.path.join(folderpath,filename)

#print resume details, otherwise delete the file to start again
if(resume_active == True):
    print("Resuming at page " + str(resume_page) + " of " + str(resume_category))
else:
    print("Resume data not found, starting anew...")
    if os.path.exists(filepath):
        os.remove(filepath)
    
    #write the header to the new file
    with open(filepath, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Product Code", "Category", "Item Name", "Best Price", "Best Unit Price", "Item Price", "Unit Price", "Price Was", "Special Text", "Complex Promo Text", "Link"])
    f.close()

print("Saving to " + filepath)

# Configure options
options = webdriver.EdgeOptions()
options.add_argument("--app=https://www.woolworths.com.au")
options.add_experimental_option('excludeSwitches', ['enable-logging'])

# Start EdgeDriver
print("Starting Woolworths...")
driver = webdriver.Edge(options=options)

# Navigate to the Woolies Website
url = "https://www.woolworths.com.au"
driver.get(url)
time.sleep(delay)

#open the menu drawer to get the category list
driver.find_element(By.XPATH, "//button[@class='wx-header__drawer-button browseMenuDesktop']").click()
time.sleep(delay)

# Parse the page content
page_contents = BeautifulSoup(driver.page_source, "html.parser")

# Find all product categories on the page
categories = page_contents.find_all("a", class_="item ng-star-inserted")

#remove categories earlier than the resume point
if(resume_active == True):
    found_resume_point = False

    for category in reversed(categories):
        category_name = category.text.strip()

        if(found_resume_point == True):
            categories.remove(category)
        else:
            if(resume_category == category_name):
                found_resume_point = True

#remove categories ignored in the config file
for category in reversed(categories):
    category_endpoint = category.get("href").replace("/shop/browse/", "")
    if (category_ignore.find(category_endpoint) != -1):
        categories.remove(category)

#show the user the categories to scrape
print("Categories to Scrape:")
for category in categories:
    print(category.text)

time.sleep(delay)
#close the browser
driver.close()

for category in categories:

    #start browser
    driver = webdriver.Edge(options=options)

    # Get the link to the categories page
    category_link = url + category.get("href")
    category_name = category.text.strip()
    print("Loading Category: " + category_name)

    #save resume data
    config.set('Woolworths', 'Resume_Category', category_name)
    try:
        with open(configFile, 'w') as cfgFile:
            config.write(cfgFile)
        cfgFile.close
    except:
        print("Failed to write Config this time...")

    # Follow the link to the category page
    driver.get(category_link + "?pageNumber=1&sortBy=TraderRelevance&filter=SoldBy(Woolworths)")
    time.sleep(delay)

    # Parse page content
    page_contents = BeautifulSoup(driver.page_source, "html.parser")

    # Get the number of pages in this category
    try:
        pageselement = driver.find_element(By.XPATH, "//span[@class='page-count']")
        total_pages = int(pageselement.get_attribute('innerText'))
    except:
        total_pages = 1
    
    if(resume_active == True):
        first_page = resume_page
    else:
        first_page = 1

    for page in range(first_page, total_pages + 1):

        #set the resume point
        config.set('Woolworths', 'Resume_Page', str(page))
        try:
            with open(configFile, 'w') as cfgFile:
                config.write(cfgFile)
            cfgFile.close
        except:
            print("Failed to write Config this time...")

        # Parse the page content
        page_contents = BeautifulSoup(driver.page_source, "html.parser")
        
        #get the element containing the products
        productsgrid = page_contents.find("shared-grid", class_="grid-v2")

        if(productsgrid is None):
            print("Waiting Longer....")
            time.sleep(delay)
            page_contents = BeautifulSoup(driver.page_source, "html.parser")
            productsgrid = page_contents.find("shared-grid", class_="grid-v2")


        products2 = driver.find_elements(By.XPATH, "//wc-product-tile[@class='ng-star-inserted']")
        productsCount2 = len(products2)

        print(category_name + ": Page " + str(page) + " of " + str(total_pages) + " | Products on this page: " + str(productsCount2))

        for productCounter in range(productsCount2):
            
            #product name
            scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('title')[0].innerText"
            name = driver.execute_script(scriptContents)

            #price
            try:
                scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('primary')[0].innerText"
                itemprice = driver.execute_script(scriptContents)
            except:
                itemprice = ""

            #unit price
            try:
                scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('price-per-cup')[0].innerText"
                unitprice = driver.execute_script(scriptContents)      
            except:
                unitprice = ""                      

            #specialtext
            try:
                scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('product-tile-label')[0].innerText"
                specialtext = driver.execute_script(scriptContents)   
            except:
                specialtext = ""

            #promotext
            try:
                scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('product-tile-promo-info')[0].innerText"
                promotext = driver.execute_script(scriptContents)   
            except:
                promotext = ""

            #price_was_struckout
            try:
                scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByClassName('was-price ')[0].innerText"
                price_was_struckout = driver.execute_script(scriptContents)   
            except:
                price_was_struckout = ""        

            #productLink
            try:
                scriptContents = "return document.getElementsByClassName('grid-v2')[0].getElementsByTagName('wc-product-tile')[" + str(productCounter) + "].shadowRoot.children[0].getElementsByTagName('a')[0].href"
                productLink = driver.execute_script(scriptContents)   
            except:
                productLink = ""     

            
            productcode = productLink.split("/")[-2]                         

            #print(name + " / " + itemprice + " / " + unitprice + " / " + specialtext + " / " + promotext + " / " + price_was_struckout + " / " + productcode)
              
            #solve problem where some links dont have the item description
            if(productcode == "productdetails"):
                productcode = productLink.split("/")[-1]

            if name and itemprice:
                name = name.strip()
                itemprice = itemprice.strip()
                unitprice = unitprice.strip()
                specialtext = specialtext.strip()
                best_price = itemprice
                best_unitprice = unitprice
                link = productLink

                #Was Price (this is different to promotext)
                if(price_was_struckout):
                    price_was = price_was_struckout.strip()
                else:
                    price_was = None

                if(promotext):
                    promotext = promotext.strip()

                    #"Range Was" or "Was"
                    if(promotext.find("Was ") != -1 or promotext.find("Range was ") != -1):
                        price_was = promotext[promotext.find("$"):promotext.find(" - ")]
                    
                    #Member x for x promos
                    if(promotext.find("Member Price") != -1 or promotext.find(" for ") != -1): 
                        #member price
                        if(promotext.find("Member Price") != -1):
                                promotext = promotext.replace("Member Price", "").strip()
                        
                        try:
                            #generic 2fer pricing
                            promo_itemcount = int(promotext[0:promotext.find(" for")])
                            promo_price = float(promotext[promotext.find("$")+1:promotext.find(" - ")])
                        
                            #set Best price Update Best Unit Price from the memberpromo price
                            best_price = "$" + str(round(promo_price / promo_itemcount, 2)) 
                            #check if a unit price is presented for a 2-for special, they aren't always 
                            if (promotext.find(" - ") != -1):
                                best_unitprice = promotext[promotext.find(" - ")+3:len(promotext)]
                        except:
                            print("Member Price Error for " + str(promotext))
                            best_price = itemprice
                            best_unitprice = unitprice
                    else:
                        memberpromo = None
                    
                else:
                    promotext = None

                #write contents to file                       
                with open(filepath, "a", newline="") as f:
                    writer = csv.writer(f)  
                    writer.writerow([productcode, category_name, name, best_price, best_unitprice, itemprice, unitprice, price_was, specialtext, promotext, link])

            #reset variables
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


        # Get the link to the next page without the market BS
        next_page_link = f"{category_link}?pageNumber={page + 1}" + "&sortBy=TraderRelevance&filter=SoldBy(Woolworths)"
        
        #restart browser every 50 pages
        if(page % 50 == 0):
            print("Restaring Browser...")
            driver.close()
            driver = webdriver.Edge(options=options)
        
        # Navigate to the next page
        #if(total_pages > 1 and page + 1 <= total_pages):
        if(total_pages > 1 and page + 1 <= total_pages):
            if page+1==11:
                break
            driver.get(next_page_link)
        
        #wait the delay time before the next page
        time.sleep(delay)

    #wait the delay time before the next Category
    time.sleep(delay)
    #close the browser
    driver.close()

else:
    print("The category " + category.text + " has been ignored.")

driver.quit()

f.close()

config.set('Woolworths', 'Resume_Active', "FALSE")
config.set('Woolworths', 'Resume_Category', "null")
config.set('Woolworths', 'Resume_Page', "0")

with open(configFile, 'w') as cfgFile:
    config.write(cfgFile)
cfgFile.close

print("Finished")