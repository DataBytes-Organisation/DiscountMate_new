# Basic Coles price scraper
import requests
from bs4 import BeautifulSoup

url = "https://www.coles.com.au/product/"
headers = {"User-Agent": "Mozilla/5.0"}

try:
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    price = soup.find("span", class_="price__value").text
    print(f"Found price: {price}")
except Exception as e:
    print(f"Error: {e}")

