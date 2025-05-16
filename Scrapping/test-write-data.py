rom utils import DiscountMateDB
import json
import os

db_config_file = "db-config.json"
config_path = os.path.abspath(db_config_file)
db = DiscountMateDB(config_path)
    
# Load data from test2.json
data_path = "Australia_GroceriesScraper/test2.json"
json_file_path = os.path.abspath(data_path)
with open(json_file_path, 'r', encoding='utf-8') as file:
    data = json.load(file)

# Write data to the collection
db.write_data(data)

# Close the connection
db.close_connection()