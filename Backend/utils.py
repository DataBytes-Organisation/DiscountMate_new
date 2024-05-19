import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from pymongo.collection import Collection
from typing import List, Dict, Any
from datetime import datetime
from faker import Faker
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import random


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
        
        self.client = MongoClient(connection_string)
        self.db = self.client[database_name]
        self.collection: Collection = self.db.transactions

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

    def read_data(self, query: Dict[str, Any] = {}, limit: int = 1000) -> List[Dict[str, Any]]:
        return list(self.collection.find(query).limit(limit))

    def close_connection(self) -> None:
        self.client.close()

def load_data_db(config_path: str) -> pd.DataFrame:
    db = DiscountMateDB(config_path)
    
    # Read data from the collection
    fetched_data = db.read_data({}, 1000)  # Adjust the limit as needed
    
    # Convert the fetched data to a Pandas DataFrame
    df = pd.DataFrame(fetched_data)
    
    # Close the connection
    db.close_connection()
    
    # Select the desired columns
    selected_cols = ['product_code', 'category', 'item_name', 'best_price']
    df = df[selected_cols]
    
    return df

def create_fake_customer():
    fake = Faker()
    customer = {
        'customer_id': fake.uuid4(),
        'customer_name': fake.name()
    }
    return customer

def generate_transactions(customer, products_df, num_transactions=60):
    transactions = []
    product_codes = products_df['product_code'].unique()
    
    for _ in range(num_transactions):
        product_code = np.random.choice(product_codes)
        transactions.append({
            'customer_id': customer['customer_id'],
            'product_code': product_code,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    return transactions

def split_data(transactions, train_ratio=0.7):
    np.random.shuffle(transactions)
    train_size = int(len(transactions) * train_ratio)
    train_transactions = transactions[:train_size]
    test_transactions = transactions[train_size:]
    
    return train_transactions, test_transactions

import pandas as pd
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import random

def load_json(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)
    return data

def create_item_similarity_matrix(products_df):
    # Use TF-IDF Vectorizer to convert item names to TF-IDF features
    tfidf = TfidfVectorizer(stop_words='english')
    tfidf_matrix = tfidf.fit_transform(products_df['item_name'])
    
    # Compute the cosine similarity matrix
    cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
    
    return cosine_sim

def get_recommendations(product_code, products_df, cosine_sim):
    # Get the index of the product that matches the product_code
    idx = products_df.index[products_df['product_code'] == product_code].tolist()[0]
    
    # Get the pairwise similarity scores of all products with that product
    sim_scores = list(enumerate(cosine_sim[idx]))
    sim_scores = [(i, score) for i, score in sim_scores if score > 0.5]

    # Sort the products based on the similarity scores
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    
    # Get the scores of the 10 most similar products
    sim_scores = sim_scores[1:11]
    
    # Get the product indices
    product_indices = [i[0] for i in sim_scores]

    # Get the top 10 most similar products
    similar_products = products_df.iloc[product_indices].copy()
        # Get the similarity scores
    similarity_scores = [i[1] for i in sim_scores]

    
    # Add the similarity scores to the DataFrame
    similar_products['similarity_score'] = similarity_scores
    
    # Return the top 10 most similar products
    return similar_products

def print_recommendations(recommendations):
    for idx, recommendation in enumerate(recommendations, start=1):
        print(f"{idx}. Product Code: {recommendation}")
        print(f"   Item Name: {recommendation[1]}")
        #print(f"   Similarity Score: {recommendation['similarity_score']}")
        print()

def evaluate_recommendations(train_transactions, test_transactions, products_df, cosine_sim): 
    # Create a dictionary to store recommended products for each product code
    recommended_products_dict = {}

    for transaction in train_transactions:
        product_code = transaction['product_code']
        recommended_products = get_recommendations(product_code, products_df, cosine_sim)
        if len(recommended_products) > 0:
            if product_code in recommended_products_dict:
                # Check if the current recommended products have higher scores
                current_scores = recommended_products_dict[product_code]['similarity_score']
                new_scores = recommended_products['similarity_score']
                if max(new_scores) > max(current_scores):
                    recommended_products_dict[product_code] = recommended_products
            else:
                recommended_products_dict[product_code] = recommended_products  
        
    #print(recommended_products_dict)
    # Evaluate recommendations
    accuracy, precision, recall, f1_score = evaluate_overall_recommendations(recommended_products_dict, test_transactions)

    print("Evaluation Metrics:")
    print(f"Accuracy: {accuracy * 100:.2f}")
    print(f"Precision: {precision * 100:.2f}")
    print(f"Recall: {recall * 100:.2f}")
    print(f"F1-Score: {f1_score * 100:.2f}") 

from collections import defaultdict

def evaluate_overall_recommendations(recommended_products_dict, test_transactions):
    # Get unique product codes from recommended_products_dict
    recommended_product_codes = set(recommended_products_dict.keys())
    # print("Unique product codes in recommended_products_dict:")
    # for product_code in recommended_product_codes:
    #     print(product_code)

    # Get unique product codes from test_transactions
    test_product_codes = set()
    for transaction in test_transactions:
        test_product_codes.add(transaction['product_code'])
    # print("\nUnique product codes in test_transactions:")
    # for product_code in test_product_codes:
    #     print(product_code)

    # Find the intersection of product codes
    common_product_codes = recommended_product_codes.intersection(test_product_codes)

    # print("\nCommon Products and Their Similarity Scores:")
    # for product_code in common_product_codes:
    #     print(f"Product Code: {product_code}")
    #     print("Recommended Products:")
    #     for rec_product_code, similarity_score in recommended_products_dict[product_code].items():
    #         print(f"- Product: {rec_product_code}, Similarity Score: {similarity_score}\n")
    #     print()


    true_positives = len(common_product_codes)
    false_positives = len(recommended_product_codes - test_product_codes)
    false_negatives = len(test_product_codes - recommended_product_codes)

    # Calculate accuracy
    accuracy = true_positives / (true_positives + false_positives + false_negatives)

    # Calculate precision
    precision = true_positives / (true_positives + false_positives)

    # Calculate recall
    recall = true_positives / (true_positives + false_negatives)

    # Calculate F1-score
    f1_score = 2 * (precision * recall) / (precision + recall)

    return accuracy, precision, recall, f1_score




