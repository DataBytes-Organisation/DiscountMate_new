# ======IMPORTS======
import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from urllib.parse import quote_plus
from dotenv import load_dotenv

# =====HEADERS======
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
}

# ====== FUNCTIONS =====
def get_text_or_default(value, default="N/A"):
    return value.text.strip() if value else default

def get_total_pages_balaklava(soup):
    pagination = soup.find('div', class_='mfl-pagination')
    if pagination:
        page_links = pagination.find_all('a')
        page_numbers = [int(link.get_text()) for link in page_links if link.get_text().isdigit()]
        return max(page_numbers, default=1)
    return 1

def save_to_csv(data, filename):
    df = pd.DataFrame(data)
    df.to_csv(filename, index=False, encoding='utf-8')
    print(f"Data saved to {filename}")

# def get_total_pages_adelaide(soup):
#     page_links = soup.find_all(class_='pagination__item__link')
#     if page_links:
#         page_numbers = [int(link.get_text()) for link in page_links if link.get_text().isdigit()]
#         return max(page_numbers, default=1)
#     return 1

# # Setup MongoDB connection
# def setup_mongo():
#     # Load environment variables from .env file if it exists
#     load_dotenv()
    
#     # MongoDB credentials
#     username = os.getenv('MONGO_USERNAME', 'example')
#     password = os.getenv('MONGO_PASSWORD', 'example1')
    
#     # Encode credentials for MongoDB URI
#     encoded_username = quote_plus(username)
#     encoded_password = quote_plus(password)
    
#     # MongoDB URI construction
#     uri = f'mongodb+srv://{encoded_username}:{encoded_password}@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster'
    
#     # Initialize MongoDB client
#     client = MongoClient(uri, server_api=ServerApi('1'))
    
#     try:
#         client.admin.command('ping')
#         print("Successfully connected to MongoDB!")
#     except Exception as e:
#         print(f"MongoDB connection failed: {e}")
#         exit()
    
#     # MongoDB database and collection
#     db = client['ScrappedData']
    
#     # Generate collection name with timestamp
#     collection_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + "_Foodland"
#     return db[collection_name]

def scrape_foodland():
    url = "https://foodlandbalaklava.com.au/search?page=1"
    page = requests.get(url, headers=headers)
    soup = BeautifulSoup(page.text, 'html.parser')
    total_pages = get_total_pages_balaklava(soup)
    print(f"Total Pages: {total_pages} Balaklava")

    results = []
    for current_page in range(1, total_pages + 1):
        print(f"Scraping Page: {current_page}")
        url = f"https://foodlandbalaklava.com.au/search?page={current_page}"
        page = requests.get(url, headers=headers)

        if page.status_code == 200:
            soup = BeautifulSoup(page.text, 'html.parser')
            products = soup.find_all('div', class_="TalkerGrid__Item")

            for product in products:
                results.append({
                    "Store": "Foodland Balaklava",
                    "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "Product Name": get_text_or_default(product.find('div', class_='talker__name talker__section').find('span')),
                    "Size": get_text_or_default(product.find('span', class_='weak size talker__name__size')),
                    "Original Price": get_text_or_default(product.find('span', class_='talker__prices__was')),
                    "Discounted Price": get_text_or_default(product.find('strong', class_='price__sell')),
                    "Unit Price": get_text_or_default(product.find('span', class_='talker__prices__comparison--UnitPrice')),
                    "Product Link": "https://foodlandbalaklava.com.au/" + product.find('a').get('href')
                })

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"foodland_balaklava_{timestamp}.csv"
    save_to_csv(results, filename)

if __name__ == '__main__':
    
    print("Starting Foodland Balaklava scrape...")
    scrape_foodland()
    
    print("Scraping completed successfully!")