from elasticsearch import Elasticsearch, helpers
from flask import Flask, request, jsonify
from flask_cors import CORS
import csv
from pymongo import MongoClient
from bs4 import BeautifulSoup
import requests
import pandas as pd
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pkg_resources



app = Flask(__name__)
CORS(app)

mongo_uri = ""
###UPDATE THE MONGO URL####


client = MongoClient(mongo_uri)

db = client['TodaysOffer']  # Replace with your database name
collection = db['DataBytes']  # Replace with your collection name


client = Elasticsearch("https://19d45fcda6fb4286a111127d2983a004.us-central1.gcp.cloud.es.io:443",api_key="dnNuQi1wRUJtOWxnRFdlSElvcDA6djVvV2xaMGlSWDZ0dmlwd0s3NlMzZw==")

###UPDATE THE ELASRIC SEARCH API####


# client = Elasticsearch("https://014bf8e328b3499ea2476c1a9b45dd14.us-central1.gcp.cloud.es.io:443",api_key="aG8tWHVJOEJuUGFVQS12YTd5bXo6UXEwaVZaVEpUM0dVS3V5b3ZBZXV4dw==")
# client = Elasticsearch(
#     cloud_id="be806a3984e2401d88172cc6b3398094:dXMtY2VudHJhbDEuZ2NwLmNsb3VkLmVzLmlvJDAxNGJmOGUzMjhiMzQ5OWVhMjQ3NmMxYTliNDVkZDE0JGZjNzU0NWRmNmZmNjRkODE5Njg5MDgyYjZiMWE3MDUw", basic_auth=('elastic', 'MQzSL7GvQgCvtLor1dKaOw'),
#     )


index_name = "product_prices"

@app.route('/uploadData', methods=['POST'])
def todaysData():
    url = 'https://www.aldi.com.au/groceries/price-reductions/'

    # Send a GET request to the URL
    response = requests.get(url)

    # Parse the HTML content of the page using BeautifulSoup
    soup = BeautifulSoup(response.text, 'html.parser')

    box_wrappers = soup.find_all('a', class_='box--wrapper ym-gl ym-g25')

    product_names = []
    original_prices = []
    new_prices = []

    # Iterate over each <a> tag
    for box_wrapper in box_wrappers:
        # Extract product name
    #     print(box_wrapper)
        product_name = box_wrapper.find('div', class_='box--description--header').get_text(strip=True)
        product_names.append(product_name)
        
        # Extract original price
        original_price = box_wrapper.find('span', class_='box--former-price').get_text(strip=True)
        original_prices.append(original_price)
        
        # Extract new price
        new_price = box_wrapper.find('span', class_='box--value').get_text(strip=True)
        new_prices.append(new_price)

    # Create a DataFrame
    df = pd.DataFrame({'Name of Product': product_names,
                    'Original Price': original_prices,
                    'New Price': new_prices})
    
    df['Original Price'] = df['Original Price'].str.replace('$', '').str.replace('c', '').astype(float)
    df['New Price'] = df['New Price'].str.replace('$', '').str.replace('c', '').astype(float)

    df['Discount'] = round(df['Original Price'] - df['New Price'], 3)


    # Remove previous data in MongoDB
    collection.delete_many({})  # This will remove all previous data from the collection

    # Insert new data (today's data) into MongoDB
    data_to_insert = df.to_dict('records')  # Convert the DataFrame to a list of dictionaries
    collection.insert_many(data_to_insert)  # Insert the data into MongoDB

    client.delete_by_query(index=index_name, body={"query": {"match_all": {}}})

    bulk_operations = []
    for _, row in df.iterrows():
        action = {
            "_index": index_name,
            "_source": {
                "Name of Product": row["Name of Product"],
                "Original Price": float(row["Original Price"]),
                "New Price": float(row["New Price"]),
                "Discount": float(row["Discount"])
            }
        }
        bulk_operations.append(action)

    # Perform the bulk indexing in Elasticsearch
    helpers.bulk(client, bulk_operations)
    return {}


def schedule_task():
    scheduler = BackgroundScheduler()
    
    # Set the trigger for 00:01 daily
    cron_trigger = CronTrigger(hour=0, minute=1)

    # Add the job to the scheduler
    scheduler.add_job(todaysData, cron_trigger)

    # Start the scheduler in the background
    scheduler.start()


@app.route('/search', methods=['POST'])
def search():
    # Get the JSON data from the request
    data = request.json
    product_name = data.get('product_name')

    # Check if the product_name is provided
    if not product_name:
        return jsonify({'error': 'Product name is required'}), 400

    # Query the MongoDB collection for the given product name
    result = collection.find_one({'Name of Product': product_name})

    # Check if the result is found
    if result:
        # Prepare the response with all details
        response = {
            'Name of Product': result.get('Name of Product'),
            'Original Price': result.get('Original Price'),
            'New Price': result.get('New Price'),
            'Discount': result.get('Discount')
        }
        return jsonify(response), 200
    else:
        return jsonify({'message': 'Product not found'}), 404
    

@app.route('/searchBelow', methods=['POST'])
def search_below():
    # Get the JSON data from the request
    data = request.json
    max_price = data.get('max_price')

    # Check if max_price is provided and is a number
    if not max_price or not isinstance(max_price, (int, float)):
        return jsonify({'error': 'Valid max_price is required'}), 400

    # Query the MongoDB collection for products with New Price below max_price
    results = collection.find({'New Price': {'$lt': max_price}})

    # Prepare the response with all matching products
    response = []
    for result in results:
        response.append({
            'Name of Product': result.get('Name of Product'),
            'Original Price': result.get('Original Price'),
            'New Price': result.get('New Price'),
            'Discount': result.get('Discount')
        })

    # Return the list of products
    return jsonify(response), 200

@app.route('/uploadFile', methods=['POST'])
def upload_file():
    csv_file_path = "product_prices.csv"
    bulk_operations = []

    with open(csv_file_path, mode='r') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            # Create an index action for each row
            action = {
                "_index": index_name,
                "_source": {
                    "Name of Product": row["Name of Product"],
                    "Original Price": float(row["Original Price"]),
                    "New Price": float(row["New Price"]),
                    "Discount": float(row["Discount"])
                }
            }
            bulk_operations.append(action)

    # Perform the bulk indexing
    helpers.bulk(client, bulk_operations)
    print(client.info())
    return {}


# @app.route("/search", methods=['POST'])
# def search():
#     product_name = "Jindurrhaaa Station Gravy Beef per kf"

#     search_query_by_name = {
#         "query": {
#             "match": {
#                 "Name of Product": product_name
#             }
#         }
#     }

#     # Execute the search query
#     response = client.search(index=index_name, body=search_query_by_name)

#     # Collect the search results
#     results = [hit['_source'] for hit in response['hits']['hits']]

#     # Return the search results as JSON
#     return jsonify(results)
# @app.route("/search_exact", methods=['POST'])
# def search_exact():
#     product_name = "Jindurra Station Gravy Beef per kff"

#     search_query_by_name = {
#         "query": {
#             "term": {
#                 "Name of Product.keyword": product_name
#             }
#         }
#     }

#     # Execute the search query
#     response = client.search(index=index_name, body=search_query_by_name)

#     # Collect the search results
#     results = [hit['_source'] for hit in response['hits']['hits']]

#     # Return the search results as JSON
#     return jsonify(results)

@app.route("/search_fuzzy", methods=['POST'])
def search_fuzzy():
    data = request.json
    product_name = data.get('product_name')
    # product_name = "Willowton Free Range Chicken Drumsticks"

    search_query_by_name = {
        "query": {
            "match": {
                "Name of Product": {
                    "query": product_name,
                    "fuzziness": "AUTO"  # Enables fuzzy matching
                }
            }
        }
    }

    # Execute the search query
    response = client.search(index=index_name, body=search_query_by_name)

    # Collect the search results
    results = [hit['_source'] for hit in response['hits']['hits']]

    # Return the search results as JSON
    return jsonify(results)



@app.before_first_request
def initialize_scheduler():
    schedule_task()



if __name__ == "__main__":
    app.run(debug=True)