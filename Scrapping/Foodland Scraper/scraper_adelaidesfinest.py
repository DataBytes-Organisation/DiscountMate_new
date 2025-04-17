from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
import time

# Setup headless browser
options = Options()
options.add_argument('--headless')
options.add_argument('--disable-gpu')
driver = webdriver.Chrome(options=options)

def get_text_or_default(value, default="N/A"):
    return value.text.strip() if value else default

def scrape_adelaides_finest_all_pages():
    url = "https://shop.adelaidesfinest.com.au/category/all"
    driver.get(url)
    time.sleep(5)

    results = []
    page_number = 1

    while True:
        print(f"Scraping page {page_number}...")
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        products = soup.find_all('div', class_="results-grid__result")

        if not products:
            print("No products found. Breaking.")
            break

        for product in products:
            product_name = get_text_or_default(product.find("h3", class_="title"))
            product_size = product_name.split()[-1] if product_name else "N/A"
            integral = get_text_or_default(product.find('span', class_='integral'))
            fractional = get_text_or_default(product.find('span', class_='fractional'))
            discounted_price = f"{integral}.{fractional}" if integral.isdigit() and fractional.isdigit() else "N/A"
            price = get_text_or_default(product.find('span', class_='price__discount')).split('$')[-1].strip()

            try:
                original_price = float(price) + float(discounted_price) if discounted_price != "N/A" else "N/A"
            except:
                original_price = "N/A"

            uom_div = product.find('div', class_='card__product-uom')
            unit_price = get_text_or_default(uom_div.find('p') if uom_div else None)
            product_link = "https://shop.adelaidesfinest.com.au/" + product.find('a', class_="card__product-link").get('href') if product.find('a', class_="card__product-link") else "No link available"

            results.append({
                "Store": "Adelaide's Finest",
                "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "Product Name": product_name,
                "Size": product_size,
                "Original Price": original_price,
                "Discounted Price": discounted_price,
                "Unit Price": unit_price,
                "Product Link": product_link
            })

        try:
            next_button = driver.find_element(By.CSS_SELECTOR, 'a[aria-label="Next page"]')
            is_disabled = next_button.get_attribute("aria-disabled")
            if is_disabled == "true":
                print("Last page reached.")
                break
            else:
                next_button.click()
                time.sleep(5)
                page_number += 1
        except NoSuchElementException:
            print("Next page button not found. Ending.")
            break

    # Save to CSV
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"adelaides_finest_{timestamp}.csv"
    pd.DataFrame(results).to_csv(filename, index=False, encoding='utf-8')
    print(f"\n✅ Done! Saved {len(results)} products to {filename}")

if __name__ == "__main__":
    print("Starting full scrape...")
    scrape_adelaides_finest_all_pages()
    driver.quit()
