# ======IMPORTS======
import requests
from bs4 import BeautifulSoup
import pandas as pd
import json
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from datetime import datetime
from urllib.parse import quote_plus
import os
from dotenv import load_dotenv

# =====HEADERS======
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
}

# ====== FUNCTIONS =====
def get_text_or_default(value, default="N/A"):
    if value:
        return value.text.strip()
    return default

def get_total_pages(soup):
    pagination = soup.find('div', class_='mfl-pagination')
    if pagination:
        page_links = pagination.find_all('a')
        page_numbers = [int(link.get_text()) for link in page_links if link.get_text().isdigit()]
        return max(page_numbers, default=1)
    return 1

def get_total_pages_adelaide(soup):
    page_links = soup.find_all(class_='pagination__item__link')
    if page_links:
        page_numbers = [int(link.get_text()) for link in page_links if link.get_text().isdigit()]
        return max(page_numbers, default=1)
    return 1

# Setup MongoDB connection
def setup_mongo():
    # Load environment variables from .env file if it exists
    load_dotenv()
    
    # MongoDB credentials
    username = os.getenv('MONGO_USERNAME', 'example')
    password = os.getenv('MONGO_PASSWORD', 'example1')
    
    # Encode credentials for MongoDB URI
    encoded_username = quote_plus(username)
    encoded_password = quote_plus(password)
    
    # MongoDB URI construction
    uri = f'mongodb+srv://{encoded_username}:{encoded_password}@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster'
    
    # Initialize MongoDB client
    client = MongoClient(uri, server_api=ServerApi('1'))
    
    try:
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(e)
        sys.exit()
    
    # MongoDB database and collection
    db = client['ScrappedData']
    
    # Generate collection name with timestamp
    current_date_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    collection_name = f"{current_date_time}_Foodland"
    
    collection = db[collection_name]
    return collection

def scrape_foodland(collection):
    # ===== MAIN =====
    url = "https://foodlandbalaklava.com.au/search?page=1"
    page = requests.get(url, headers=headers)
    soup = BeautifulSoup(page.text, 'html.parser')
    totalPages = get_total_pages(soup)
    print(f"Total Pages: {totalPages} Balaklava")

    for currentPage in range(1, totalPages):
        print(f"Page: {currentPage}")
        url = f"https://foodlandbalaklava.com.au/search?page={currentPage}"
        page = requests.get(url, headers=headers)
        
        if page.status_code == 200:
            soup = BeautifulSoup(page.text, 'html.parser')
            products = soup.find_all('div', class_="TalkerGrid__Item")
            
            for product in products:
                current_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                product_link = "https://foodlandbalaklava.com.au/" + product.find('a').get('href')
                product_name = product.find('div', class_='talker__name talker__section').find('span').get_text(strip=True)
                product_size = get_text_or_default(product.find('span', class_='weak size talker__name__size'))
                original_price = get_text_or_default(product.find('span', class_='talker__prices__was'))
                discounted_price = get_text_or_default(product.find('strong', class_='price__sell'))
                unit_price = get_text_or_default(product.find('span', class_='talker__prices__comparison--UnitPrice'))

                # Store in MongoDB
                collection.insert_one({
                    "Store": "Foodland Balaklava",
                    "Timestamp": current_timestamp,
                    "product_name": product_name,
                    "discounted_price": discounted_price,
                    "unit_price": unit_price,
                    "original_price": original_price,
                    "product_size": product_size,
                    "product_link": product_link
                })

def scrape_adelaide_finest(collection):
    url = "https://shop.adelaidesfinest.com.au/category/all?page=1"
    page = requests.get(url, headers=headers)
    soup = BeautifulSoup(page.text, 'html.parser')
    total_pages = get_total_pages_adelaide(soup)
    print(f"Total Pages: {total_pages} Adelaide")

    for currentPage in range(1, total_pages):
        print(f"Page: {currentPage}")
        url = f"https://shop.adelaidesfinest.com.au/category/all?page={currentPage}"
        page = requests.get(url, headers=headers)
        
        if page.status_code == 200:
            soup = BeautifulSoup(page.text, 'html.parser')
            products = soup.find_all('div', class_="results-grid__result")
            
            for product in products:
                flag = 0
                current_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                try:
                    link_tag = product.find('a', class_="card__product-link")
                    product_link = "https://shop.adelaidesfinest.com.au/" + link_tag.get('href')
                except:
                    product_link = "No link available"
                    flag += 1

                product_name = get_text_or_default(product.find("h3", class_="title"))
                product_size = product_name.split()[-1]

                integral = get_text_or_default(product.find('span', class_='integral'))
                fractional = get_text_or_default(product.find('span', class_='fractional'))
                try:
                    discounted_price = f"{int(integral)}.{int(fractional)}"        
                except:    
                    discounted_price = "N/A"
                    flag += 1

                price = get_text_or_default(product.find('span', class_='price__discount')).split('$')[-1].strip()
                try: 
                    newDisc = float(discounted_price)
                    price = float(price)
                    original_price = price + newDisc
                except:
                    price = 0
                    original_price = 0
                    flag += 1

                unit_text = product.find('div', class_='card__product-uom')
                unit_price = get_text_or_default(unit_text.find('p')) if unit_text else "N/A"
                
                if flag == 4:
                    continue

                # Store in MongoDB
                collection.insert_one({
                    "Store": "Adelaide's Finest",
                    "Timestamp": current_timestamp,
                    "product_name": product_name,
                    "discounted_price": discounted_price,
                    "unit_price": unit_price,
                    "original_price": original_price,
                    "product_size": product_size,
                    "product_link": product_link
                })

if __name__ == '__main__':
    # Setup MongoDB connection
    collection = setup_mongo()
    
    # Scrape both stores
    print("Starting Foodland Balaklava scrape...")
    scrape_foodland(collection)
    
    print("Starting Adelaide's Finest scrape...")
    scrape_adelaide_finest(collection)
    
    print("Scraping completed successfully!")