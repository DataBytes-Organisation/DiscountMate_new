import os
import pandas as pd
from pymongo import MongoClient, errors
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = 'ScrappedData'
COLLECTION_NAME = '20250430_105301_Coles_All'
# CSV output file, by default named after the collection
OUTPUT_CSV = "products.csv"


def main():
    if not MONGO_URI:
        raise EnvironmentError('Please set the MONGO_URI environment variable')

    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # Fetch all documents excluding the default _id field
    docs = list(collection.find({}, {'_id': False}))
    print(f"Fetched {len(docs)} documents from {DB_NAME}.{COLLECTION_NAME}")

    if not docs:
        print("No documents found. Exiting.")
        return

    # Convert documents to DataFrame
    df = pd.DataFrame(docs)[:20]

    # Export to CSV

    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Exported data to CSV file: {OUTPUT_CSV}")


if __name__ == '__main__':
    main()
