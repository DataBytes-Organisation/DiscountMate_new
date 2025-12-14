import csv
import time
from datetime import datetime
import requests
from bs4 import BeautifulSoup

# Base URL for Drakes specials page
BASE_URL = "https://033.drakes.com.au/specials"

# HTTP headers including user-agent and PJAX for dynamic content loading
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "X-PJAX": "true",
}

# Function to fetch products from a given page
def fetch_products(page):
    params = {
        'page': page,
        'q[]': 'special:1',
        '_pjax': '#search-results-products'
    }
    response = requests.get(BASE_URL, headers=HEADERS, params=params)
    response.raise_for_status()
    return response.text

# Function to parse product details from HTML response
def parse_products(html):
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
            "Size": size,
            "Price": price,
            "Previous Price": prev_price,
            "Unit Price": unit_price,
            "Image URL": image_url
        })

    return products

# Function to scrape all pages of specials
def scrape_all_pages():
    all_products = []
    page = 1

    while True:
        print(f"Fetching page {page}...")
        html = fetch_products(page)
        products = parse_products(html)
        
        if not products:
            print(f"No more products found on page {page}. Ending scrape.")
            break
        
        all_products.extend(products)
        print(f"✔️ Page {page}: {len(products)} products scraped.")
        page += 1
        time.sleep(1)  # Be polite to the server

    return all_products

# Function to save scraped data into a CSV file
def save_to_csv(products):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"{timestamp}_DrakesSpecials_AllPages.csv"

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Name", "Size", "Price", "Previous Price", "Unit Price", "Image URL"])
        writer.writeheader()
        writer.writerows(products)

    print(f"✅ All data saved to {filename}")

# Main execution
if __name__ == "__main__":
    all_products = scrape_all_pages()
    save_to_csv(all_products)
