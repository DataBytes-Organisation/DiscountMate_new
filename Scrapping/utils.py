import json
from pymongo import MongoClient
from pymongo.collection import Collection
from typing import List, Dict, Any
from datetime import datetime
import os


class DiscountMateDB:
    def __init__(self, config_path: str = "db-config.json"):
    # Check if the config file exists
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        # Read the configuration file
        with open(config_path, 'r') as config_file:
            config = json.load(config_file)
        
        connection_string = config['connection_string']
        database_name = config['database_name']
        collection_name = config.get('collection_name', f'Drake_Products_{datetime.now().strftime("%Y-%m-%d")}')
        
        self.client = MongoClient(connection_string)
        self.db = self.client[database_name]
        self.collection: Collection = self.db[collection_name]

    def write_data(self, data: List[Dict[str, Any]]) -> None:
        if not isinstance(data, list):
            raise TypeError("Data should be a list of dictionaries.")
        if not all(isinstance(item, dict) for item in data):
            raise TypeError("Each item in the data list should be a dictionary.")
        
        # Add timestamp to each document
        current_time = datetime.utcnow()
        for item in data:
            item['timestamp'] = current_time
        
        self.collection.insert_many(data)

    def read_data(self, query: Dict[str, Any] = {}, limit: int = 10) -> List[Dict[str, Any]]:
        return list(self.collection.find(query).limit(limit))

    def close_connection(self) -> None:
        self.client.close()
    
