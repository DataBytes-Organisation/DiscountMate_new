from pymongo import MongoClient
from google.cloud import bigquery
import pandas as pd

# MongoDB Connection
print("Connecting to MongoDB Atlas...")
try:
    mongo_client = MongoClient(
        "mongodb+srv://discountmate_read_and_write:discountmate@discountmatecluster.u80y7ta.mongodb.net/",
        tlsAllowInvalidCertificates=True
    )
    db = mongo_client['CleanedData']  # MongoDB Database
    collection = db['Coles']          # MongoDB Collection
    print("Successfully connected to MongoDB!")
except Exception as e:
    print("Error connecting to MongoDB:", e)
    exit(1)

# Fetch data from MongoDB
print("Fetching data from MongoDB collection...")
try:
    data = pd.DataFrame(list(collection.find()))
    print(f"Fetched {len(data)} records from MongoDB.")
    # Convert ObjectId to string (BigQuery doesn't support ObjectId)
    if '_id' in data.columns:
        data['_id'] = data['_id'].astype(str)
except Exception as e:
    print("Error fetching data from MongoDB:", e)
    exit(1)

# BigQuery Connection
print("Connecting to BigQuery...")
try:
    bq_client = bigquery.Client.from_service_account_json("thinking-armor-443911-j4-71eddf71fcfa.json")
    print("Successfully connected to BigQuery!")
except Exception as e:
    print("Error connecting to BigQuery:", e)
    exit(1)

# Dataset and Table IDs
dataset_id = "thinking-armor-443911-j4.Cleaned_Data"  # Replace with your correct dataset
table_id = "thinking-armor-443911-j4.Cleaned_Data.Coles"  # Replace with your correct table name

# Check if Dataset Exists or Create It
from google.cloud.exceptions import NotFound

try:
    # Attempt to fetch the dataset
    bq_client.get_dataset(dataset_id)
    print(f"Dataset '{dataset_id}' already exists. Skipping creation.")
except NotFound:
    # If dataset does not exist, create it
    print(f"Dataset '{dataset_id}' not found. Creating it...")
    dataset = bigquery.Dataset(dataset_id)
    dataset.location = "US"  # Adjust region if needed
    bq_client.create_dataset(dataset)
    print(f"Dataset '{dataset_id}' created successfully.")

# Upload DataFrame to BigQuery Table
print("Uploading data to BigQuery table...")
try:
    job = bq_client.load_table_from_dataframe(data, table_id)
    job.result()  # Wait for the job to complete
    print(f"Successfully uploaded {len(data)} rows to '{table_id}'.")
except Exception as e:
    print(f"Error uploading data to BigQuery: {e}")
