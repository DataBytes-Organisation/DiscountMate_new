from sqlalchemy import create_engine
from urllib.parse import quote
import pandas as pd
from pymongo import MongoClient
from pymongo.server_api import ServerApi

# Declare mongo_db_name and mongo_collection_name
mongo_db_name = 'SampleData'
mongo_collection_name = 'Sample_Product_Master'

# PostgreSQL connection parameters

db_host = 'postgres'
db_user = 'postgres'
db_password = 'password'  # Adjust if needed
db_name = 'discountmate'

# Connect to MongoDB
# Uri declaration
uri = "mongodb+srv://discountmate:discountmate1@discountmatecluster.u80y7ta.mongodb.net/?retryWrites=true&w=majority&appName=DiscountMateCluster"

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

db = client[mongo_db_name]
collection = db[mongo_collection_name]

# Read data from MongoDB
mongo_data = list(collection.find())
df = pd.DataFrame(mongo_data)

# Drop the MongoDB _id field if it exists
if '_id' in df.columns:
    df = df.drop(columns=['_id'])

# Encode the password for the connection string
encoded_password = quote(db_password)

# Connect to the PostgreSQL database
engine = create_engine(f'postgresql+psycopg2://{db_user}:{encoded_password}@{db_host}/{db_name}')

# Insert data into the product table
with engine.connect() as conn:
    df.to_sql('product', conn, if_exists='append', index=False)
    print("Data inserted into 'product' table successfully.")