from utils import DiscountMateDB
import os

db_config_file = "db-config.json"
config_path = os.path.abspath(db_config_file)
db = DiscountMateDB(config_path)

# Read data from the collection
fetched_data = db.read_data({}, 5)
for item in fetched_data:
    print(item)  