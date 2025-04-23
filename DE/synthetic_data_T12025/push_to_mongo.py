# Import library
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import pandas as pd
from datetime import datetime
import os 
from dotenv import load_dotenv
load_dotenv()  

uri = os.getenv("MONGO_URI")

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

# Send a notification to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

# DB 
db_name = os.getenv("MONGO_DB")
db = client[db_name]

# Define mapping 
file_collection_map = {
    "users.csv": "users",
    "stores.csv": "stores",
    "products.csv": "products",
    "product_pricing.csv": "product_pricing",
    "baskets.csv": "baskets",
    "shopping_lists.csv": "shopping_lists",
    "shopping_list_items.csv": "shopping_list_items",
}

for file_name, collection_name in file_collection_map.items():
    try:
        df = pd.read_csv(file_name)
        data_to_insert = df.to_dict('records')
        collection = db[collection_name]
        result = collection.insert_many(data_to_insert)
        print(f"Data from {file_name} inserted into collection '{collection_name}' with IDs: {result.inserted_ids}")
    except Exception as e:
        print(f"An error occurred while processing {file_name}: {e}")
