#!/usr/bin/env python3
import requests
import time
import random
import csv
import json
import logging
from datetime import datetime
from lxml import html, etree
from typing import List, Dict, Optional
from utils import DiscountMateDB


class HarrisFarmScraper:
    """Harris Farm product information scraper class"""
    
    def __init__(self):
        self.base_url = "https://www.harrisfarm.com.au/collections/online-specials"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        }
        self.db = DiscountMateDB(collection_name="HarrisFarm_Products")
        # Setup logging
        self.setup_logging()
    
    def setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('harris_farm_scraper.log', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def get_page_content(self, page: int = 1) -> Optional[str]:
        """
        Get HTML content of the specified page
        
        Args:
            page: Page number, default is 1
            
        Returns:
            HTML content string, None if failed
        """
        try:
            params = {'page': page}
            self.logger.info(f"Requesting data from page {page}...")
            
            response = requests.get(
                self.base_url, 
                headers=self.headers, 
                params=params,
                timeout=30
            )
            response.raise_for_status()
            
            self.logger.info(f"Successfully retrieved data from page {page}")
            return response.text
            
        except requests.RequestException as e:
            self.logger.error(f"Error requesting page {page}: {e}")
            return None
    
    def parse_products(self, html_content: str) -> List[Dict[str, any]]:
        """
        Parse HTML content, extract product information
        
        Args:
            html_content: HTML content string
            
        Returns:
            Product information list
        """
        try:
            tree = html.fromstring(html_content)
            
            # Extract product titles
            titles = tree.xpath("//li//h3[@class='card__heading h3']/a")
            
            # Extract price data
            datas = tree.xpath("//li/@data-all-variants")
            
            now_prices = []
            origin_prices = []
            
            # Parse price data
            for data in datas:
                data = data.split(";")
                
                for d in data:
                    if len(d) > 3 and d.startswith("s:73"):
                        price_parts = d.split(",")
                        if len(price_parts) > 6:
                            # Current price (special price)
                            current_price = int(price_parts[5]) / 100.0
                            now_prices.append(current_price)
                            
                            # Original price
                            original_price = None
                            if price_parts[6] and price_parts[6] != "":
                                original_price = int(price_parts[6]) / 100.0
                            origin_prices.append(original_price)
                            break
            
            # Verify data completeness
            if len(titles) != len(now_prices):
                self.logger.warning(f"Title count ({len(titles)}) does not match price count ({len(now_prices)})")
                min_len = min(len(titles), len(now_prices))
                titles = titles[:min_len]
                now_prices = now_prices[:min_len]
                origin_prices = origin_prices[:min_len]
            
            # Build product information list
            products = []
            for i in range(len(titles)):
                product = {
                    'title': titles[i].text.strip() if titles[i].text else '',
                    'current_price': now_prices[i],
                    'original_price': origin_prices[i],
                    'discount_amount': None,
                    'discount_percentage': None,
                    'scraped_at': datetime.now().isoformat()
                }
                
                # Calculate discount information
                if origin_prices[i] and origin_prices[i] > now_prices[i]:
                    product['discount_amount'] = round(origin_prices[i] - now_prices[i], 2)
                    product['discount_percentage'] = round(
                        (origin_prices[i] - now_prices[i]) / origin_prices[i] * 100, 2
                    )
                
                products.append(product)
            
            self.logger.info(f"Successfully parsed {len(products)} products")
            return products
            
        except Exception as e:
            self.logger.error(f"Error parsing HTML: {e}")
            return []
    
    def save_to_csv(self, products: List[Dict[str, any]], filename: str = None):
        """
        Save product data to CSV file
        
        Args:
            products: Product information list
            filename: File name, if not specified, use default name
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"harris_farm_products_{timestamp}.csv"
        
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
                if products:
                    fieldnames = products[0].keys()
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    
                    writer.writeheader()
                    writer.writerows(products)
                    
                    self.logger.info(f"Successfully saved {len(products)} products to {filename}")
                else:
                    self.logger.warning("No product data to save to CSV")
                    
        except Exception as e:
            self.logger.error(f"Error saving CSV file: {e}")
    
    def save_to_json(self, products: List[Dict[str, any]], filename: str = None):
        """
        Save product data to JSON file
        
        Args:
            products: Product information list
            filename: File name, if not specified, use default name
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"harris_farm_products_{timestamp}.json"
        
        try:
            data = {
                'scraped_at': datetime.now().isoformat(),
                'total_products': len(products),
                'products': products
            }
            
            with open(filename, 'w', encoding='utf-8') as jsonfile:
                json.dump(data, jsonfile, ensure_ascii=False, indent=2)
                
                self.logger.info(f"Successfully saved {len(products)} products to {filename}")
                
        except Exception as e:
            self.logger.error(f"Error saving JSON file: {e}")
    
    def scrape_products(self, max_pages: int = 1, save_csv: bool = True, save_json: bool = True, save_mongodb: bool = True) -> List[Dict[str, any]]:
        """
        Scrape product information
        
        Args:
            max_pages: Maximum number of pages to scrape
            save_csv: Whether to save to CSV file
            save_json: Whether to save to JSON file
            
        Returns:
            All product information list
        """
        all_products = []
        
        for page in range(1, max_pages + 1):
            # Add random delay to avoid too frequent requests
            if page > 1:
                delay = random.uniform(1, 3)
                self.logger.info(f"Waiting {delay:.2f} seconds...")
                time.sleep(delay)
            
            # Get page content
            html_content = self.get_page_content(page)
            if not html_content:
                self.logger.error(f"Unable to get content from page {page}, skipping")
                continue
            
            # Parse product information
            products = self.parse_products(html_content)
            if not products:
                self.logger.warning(f"No products found on page {page}")
                break
            
            all_products.extend(products)
            self.logger.info(f"Scraped {len(products)} products from page {page}")
        
        self.logger.info(f"Total products scraped: {len(all_products)}")
        
        # Save data
        if all_products:
            if save_csv:
                self.save_to_csv(all_products)
            if save_json:
                self.save_to_json(all_products)
            if save_mongodb:
                self.db.write_data(all_products)
        return all_products


def main():
    """Main function - demonstrate how to use the scraper"""
    scraper = HarrisFarmScraper()
    
    # Scrape first page of product data
    products = scraper.scrape_products(max_pages=100, save_csv=True, save_json=True)
    
    print(f"Total products scraped: {len(products)}")


if __name__ == "__main__":
    main()
