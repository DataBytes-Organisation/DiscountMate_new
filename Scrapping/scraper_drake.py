from datetime import datetime
from bs4 import BeautifulSoup
from utils import DiscountMateDB
import requests
import json
import csv
import time
import random

# Base URL for Drakes specials page
BASE_URL = "https://033.drakes.com.au/search"

# HTTP headers including user-agent and PJAX for dynamic content loading
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://033.drakes.com.au/",
    "X-PJAX": "true",
}
# Categories to scrape
categories = ['fruit-vegetables', 'bread-bakery', 'deli-seafood', 'meat', 'ready-to-eat-meals', 
              'dairy', 'freezer', 'pantry', 'drinks', 'confectionery-snacks', 'baby', 
              'health-beauty', 'household-cleaning-needs', 'petcare', 'general-merch']

# Function to fetch products from a given page
def fetch_products(page, category):
    params = {
        'page': page,
        'q[]': 'special:1',
        'q[]': f'category:{category}',
        '_pjax': '#search-results-products',
    }
    max_retries = 5
    retries = 0
    while retries < max_retries:
        try:
            response = requests.get(BASE_URL, headers=HEADERS, params=params, timeout=10)
            response.raise_for_status()
            break
        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
            time.sleep(1 + random.uniform(0.2, 0.8))
            retries += 1
            continue
    if retries == max_retries:
        print(f"Failed to fetch products after {max_retries} retries")
        return None
    return response.text

# Function to parse product details from HTML response
def parse_products(html, category):
    if html is None:
        return []

    soup = BeautifulSoup(html, 'html.parser')
    product_cards = soup.select(".TalkerGrid__Item")
    products = []

    for card in product_cards:
        name_tag = card.select_one(".talker__name span")
        size_tag = card.select_one(".talker__name__size")
        price_tag = card.select_one(".price__sell")
        prev_price_tag = card.select_one(".talker__prices__was")
        unit_price_tag = card.select_one(".talker__prices__comparison")
        image_tag = card.select_one(".talker__section--image img")

        name = name_tag.get_text(strip=True) if name_tag else "N/A"
        size = size_tag.get_text(strip=True) if size_tag else "N/A"
        price = price_tag.get_text(strip=True) if price_tag else "N/A"
        prev_price = prev_price_tag.get_text(strip=True).replace("was", "").strip() if prev_price_tag else "N/A"
        unit_price = unit_price_tag.get_text(strip=True) if unit_price_tag else "N/A"
        image_url = image_tag["src"] if image_tag else "N/A"

        products.append({
            "Name": name,
            "Category": category,
            "Size": size,
            "Price": price,
            "Previous Price": prev_price,
            "Unit Price": unit_price,
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Image URL": image_url,
        })

    return products

# Function to scrape all pages of specials
def scrape_all_pages():
    all_products = []

    for category in categories:
        page = 1
        while True:
            print(f"Fetching page {page}...")
            html = fetch_products(page, category)
            products = parse_products(html, category)
            
            if not products:
                print(f"No more products found on category {category} page {page}. Ending scrape.")
                break
            
            all_products.extend(products)
            print(f"✔️ category {category} Page {page}: {len(products)} products scraped.")
            page += 1
            time.sleep(1)  # Be polite to the server

    return all_products

# Function to save scraped data into a CSV file
def save_to_csv(products):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"Drakes_{timestamp}.csv"

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Name", "Category", "Size", "Price", "Previous Price", "Unit Price", "Image URL"])
        writer.writeheader()
        writer.writerows(products)

    print(f"✅ All data saved to {filename}")

# Function to save scraped data into a JSON file
def save_to_json(products):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"Drakes_{timestamp}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=4, ensure_ascii=False)
    print(f"✅ All data saved to {filename}")

def save_to_mongodb(products):
    db = DiscountMateDB()
    db.write_data(products)
    print(f"✅ All data saved to MongoDB")

# Main execution
if __name__ == "__main__":
    all_products = scrape_all_pages()
    save_to_csv(all_products)
    save_to_json(all_products)
    save_to_mongodb(all_products)
