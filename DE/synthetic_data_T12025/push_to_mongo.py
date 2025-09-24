# push_to_mongodb.py
# Script to push CSV data into MongoDB, overwriting existing documents (upsert)

import os
import pandas as pd
from pymongo import MongoClient, errors
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('MONGO_DB', 'SampleData')

# Map CSV filenames to MongoDB collection names
file_collection_map = {
    "users.csv": "users",
    "stores.csv": "stores",
    "products.csv": "products",
    "product_pricing.csv": "product_pricing",
    "baskets.csv": "baskets",
    "shopping_lists.csv": "shopping_lists",
    "shopping_list_items.csv": "shopping_list_items",
}


def main():
    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    for file_name, coll_name in file_collection_map.items():
        try:
            # Read CSV
            df = pd.read_csv(file_name)

            # Convert to list of dicts
            docs = df.to_dict('records')

            collection = db[coll_name]

            # Upsert each document by its _id field (overwrite if exists)
            upserted = 0
            for doc in docs:
                # Ensure _id exists for upsert key; if missing, insert new
                if '_id' in doc:
                    key = {'_id': doc['_id']}
                else:
                    key = {}  # will insert as new

                # Perform replace_one with upsert
                collection.replace_one(key, doc, upsert=True)
                upserted += 1

            print(f"Processed {file_name} → {coll_name}: upserted/inserted {upserted} documents.")

        except errors.PyMongoError as e:
            print(f"MongoDB error on {file_name}: {e}")
        except Exception as e:
            print(f"Error processing {file_name}: {e}")


if __name__ == '__main__':
    main()