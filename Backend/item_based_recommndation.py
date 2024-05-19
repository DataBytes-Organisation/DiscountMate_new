import pandas as pd 
import numpy as np 
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

from utils import DiscountMateDB
import os


def load_data_db(config_path):
    db = DiscountMateDB(config_path)
    # Read data from the collection
    fetched_data = db.read_data({}, 5)
    for item in fetched_data:
        print(item)  

def load_data_file(file):
    """
    Load data from a CSV file into a pandas DataFrame.

    Parameters:
    - file (str): The file path of the CSV file.

    Returns:
    - df (DataFrame or None): The DataFrame containing the loaded data, or None if file not found.
    """
    try:
        df = pd.read_csv(file)
        return df
    except FileNotFoundError:
        print("File not found:", file)
        return None 

def data_preprocessing(df):
    """
    Preprocesses the data.

    Parameters:
    - df (DataFrame): The DataFrame containing the data.

    Returns:
    - items (list): A list of item names.
    - transactions (ndarray): A 2D numpy array of transactions.
    """
    items = list(df.keys())[1:]
    transactions = np.array([df[item] for item in items]).T
    return items, transactions

def calculate_item_item_similarity(transactions):
    """
    Calculates the item-item similarity matrix using cosine similarity.

    Parameters:
    - transactions (ndarray): A 2D numpy array of transactions.

    Returns:
    - item_item_sim (ndarray): The item-item similarity matrix.
    """
    item_item_sim = np.corrcoef(transactions, rowvar=False)
    return item_item_sim

def get_recommendations(df, transactions, items, user_id, item_item_sim, num_recommendations=3):
    """
    Generates item recommendations for a given user based on item-item similarity.

    Parameters:
    - df (DataFrame): The DataFrame containing the data.
    - transactions (ndarray): A 2D numpy array of transactions.
    - items (list): A list of item names.
    - user_id (int): The ID of the user for whom recommendations are generated.
    - item_item_sim (ndarray): The item-item similarity matrix.
    - num_recommendations (int): The number of recommendations to generate (default is 3).

    Returns:
    - recommended_items (list): A list of recommended item names.
    """
    user_transactions = transactions[df[df["id"] == user_id].index[0]]
    ranked_items_indices = np.argsort(item_item_sim @ user_transactions)[::-1]

    print("Top recommendations:")
    for i in ranked_items_indices[:num_recommendations]:
        print(f"{items[i]} - Similarity Score: {item_item_sim[i, user_transactions]}")

    recommended_items = [items[i] for i in ranked_items_indices if i < len(items)]
    return recommended_items[:num_recommendations]

db_config_file = "db-config.json"
config_path = os.path.abspath(db_config_file)

load_data_db(config_path)

# # Load data
# data_file = "Grocery_data_v1.csv"
# df_grocery = load_data(file=data_file)

# # Preprocess data
# items, transactions = data_preprocessing(df_grocery)

# # Calculate item-item similarity matrix
# item_item_sim = calculate_item_item_similarity(transactions=transactions)

# # Generate recommendations for a user
# user_id = 9137310586
# recommendations = get_recommendations(df=df_grocery, transactions=transactions, items=items, 
#                                       user_id=user_id, item_item_sim=item_item_sim)

# print("Final recommendations:", recommendations)
