from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
from datetime import datetime
import os, requests, sys, random, json
import pandas as pd
from urllib.parse import quote_plus


consonants = "bcdfghjklmnpqrstvwxyz"
vowels = "aeiou"

def generate_fake_word():
    """
    generate a random fake word for the user agent
    """
    word = ""
    length = random.choice([3, 4, 5, 6])
    for i in range(length):
        word += random.choice(consonants)
        word += random.choice(vowels)
    return word

def generate_random_version():
    """
    generate a random version for the user agent
    """
    first_digit = random.choice(['0', '1', '2', '3'])
    second_digit = random.choice(['0', '1', '2', '3','4','5','6','7','8','9'])
    return first_digit + "." + second_digit

def random_tld():
    tlds = ['com', 'net', 'co', 'mil', 'biz', 'info', 'name', 'mobi', 'pro',
            'travel', 'museum', 'coop', 'aero', 'xxx', 'idv', 'int', 'jobs', 'post', 'rec']
    return random.choice(tlds)

def get_fake_user_agent():
    fake_site = generate_fake_word()
    version = generate_random_version()
    domain = random_tld()
    return f'{fake_site}/{version} (http://{fake_site}.{domain})'


def safe_get(dictionary, keys, default=''):
    """
    Safely get the value from a nested dictionary using a list of keys.
    """
    current = dictionary
    for key in keys:
        try:
            current = current[key]
        except (KeyError, TypeError):
            return default
    return current


scraped_data = []
base_url = 'https://www.costco.com.au/rest/v2/australia/products/search'

headers = {
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
    "connection": "keep-alive",
    "content-type": "application/json",
    "host": "www.costco.com.au",
    "referer": "https://www.costco.com.au/c/hot-buys",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": get_fake_user_agent()
}


page = 1
while True:
    print(page)
    query_params = {
        "fields": "FULL",
        "query": "",
        "pageSize": 48,
        "category": "hot-buys",
        "lang": "en_AU",
        "curr": "AUD"
    }
    
    if page > 1:
        query_params.update({'currentPage': page-1})

    print(query_params)
    response = requests.get(base_url, headers=headers, params=query_params)
    data = response.json()


    for product in data['products']:
        product_info = {
            'name': product.get('englishName', 'N/A'),
            'value': safe_get(product, ['price', 'value'], 0),
            'product_link': 'https://www.costco.com.au' + product.get('url', 'N/A'),
            'code': product.get('code', 'N/A'),
            'averageRating': product.get('averageRating', 0),
            'discount_value': safe_get(product, ['couponDiscount', 'discountValue'], 0),
            'discount_end_date': product.get('discountEndDate', 'N/A'),
            'discount_start_date': product.get('discountStartDate', 'N/A'),
            'in_stock': product.get('stock', {}).get('stockLevelStatus', 'N/A'),
            'images_link': ['https://www.costco.com.au' + img['url'] for img in product.get('images', [])]
        }
        scraped_data.append(product_info)

    totalPages = data['pagination']['totalPages']
    if page >= totalPages:
        break
    page += 1


df = pd.DataFrame(scraped_data)
df.to_csv('costco_products.csv', index=False)