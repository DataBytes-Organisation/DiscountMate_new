import csv
from pymongo import MongoClient
from datetime import datetime

# --- MongoDB Setup ---
client = MongoClient(
    'mongodb+srv://discountmate_read_and_write:discountmate@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster'
)
db = client['ScrappedData']

# --- Load CSV File ---
csv_file_path = r"C:\Users\djeth\Desktop\Jet - Deakin\DiscountMate_new-Scraping-\Scrapping\Foodland Scraper\adelaides_finest_2025-05-06_19-58-41.csv"
all_data = []

try:
    with open(csv_file_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            all_data.append(row)
except FileNotFoundError:
    print(f"❌ File not found: {csv_file_path}")
    exit()
except Exception as e:
    print(f"❌ Failed to read the file: {e}")
    exit()

# --- Create Timestamped Collection ---
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
collection = db[f'{timestamp}_Adelaides_Finest']

# --- Insert Data ---
if all_data:
    collection.insert_many(all_data)
    print(f"✅ Loaded and saved {len(all_data)} products from CSV into MongoDB.")
else:
    print("⚠️ No data found in the CSV file.")

client.close()
