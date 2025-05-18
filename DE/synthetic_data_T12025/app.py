import uuid
import random
import datetime
import pandas as pd
from faker import Faker

fake = Faker()

# Generate data
#  USERS
def generate_users(num_users=10):
    users_data = []
    for _ in range(num_users):
        user_id = str(uuid.uuid4())
        user_doc = {
            "_id": user_id,
            "account_user_name": fake.user_name(),
            "best_price_id": str(uuid.uuid4()), 
            "created_by": fake.name(),
            "date_created": fake.date_time_between(start_date='-2y', end_date='now'),
            "login_email": fake.email(),
            "latitude": float(fake.latitude()),
            "longitude": float(fake.longitude())
        }
        users_data.append(user_doc)
    return users_data

#  STORES
def generate_stores(num_stores=5):
    stores_data = []
    possible_store_chains = ["Coles", "Woolworths", "Costco", "Aldi", "IGA"]
    for _ in range(num_stores):
        store_id = str(uuid.uuid4())
        chain = random.choice(possible_store_chains)
        store_doc = {
            "_id": store_id,
            "store_name": chain + " " + fake.street_name(),
            "store_chain": chain,
            "store_address": fake.street_address(),
            "store_suburb": fake.city(),
            "store_city": fake.city(),
            "post_code": fake.postcode(),
            "phone_number": fake.phone_number(),
            "link_image": fake.image_url()
        }
        stores_data.append(store_doc)
    return stores_data

# PRODUCTS
def generate_products(num_products=10):
    products_data = []
    possible_brands = ["Chobani", "Heinz", "Nestle", "Whirlpool", "Apple", "Samsung"]
    possible_categories = ["Dairy", "Fruit & Veg", "Snacks", "Meat", "Drinks", "Electronics"]
    measurement_units = ["kg", "g", "liter", "pack", "unit"]
    
    for _ in range(num_products):
        product_id = str(uuid.uuid4())
        brand = random.choice(possible_brands)
        sub_cat = random.choice(possible_categories)
        product_doc = {
            "_id": product_id,
            "product_code": f"ITEM{random.randint(100,999)}",
            "product_name": fake.word().capitalize() + " " + brand,
            "brand": brand,
            "sub_category": sub_cat,
            "currency_price": "AUD",
            "current_price": round(random.uniform(1.0, 100.0), 2),
            "measurement_unit": random.choice(measurement_units),
            "link_image": fake.image_url()
        }
        products_data.append(product_doc)
    return products_data

#  PRODUCT_PRICING
def generate_product_pricing(products_data, num_records=30):
    product_pricing_data = []
    for _ in range(num_records):
        product = random.choice(products_data)
        
        date = fake.date_time_between(start_date='-6m', end_date='now')
        pricing_doc = {
            "_id": str(uuid.uuid4()),
            "product_id": product["_id"],  # reference sang products
            "date": date,
            "price": round(random.uniform(1.0, 100.0), 2)
        }
        product_pricing_data.append(pricing_doc)
    return product_pricing_data

#  BASKETS
def generate_baskets(users_data, products_data, stores_data, num_baskets=50):
    baskets_data = []
    for _ in range(num_baskets):
        user = random.choice(users_data)
        product = random.choice(products_data)
        store = random.choice(stores_data)
        
        quantity = random.randint(1, 5)
        date_created = fake.date_time_between(start_date='-3m', end_date='now')
        total_price = round(product["current_price"] * quantity, 2)
        
        basket_doc = {
            "_id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "product_id": product["_id"],
            "store_id": store["_id"],
            "date_created": date_created,
            "quantity": quantity,
            "total_price": total_price
        }
        baskets_data.append(basket_doc)
    return baskets_data

#  SHOPPING_LISTS
def generate_shopping_lists(users_data, num_lists=20):
    shopping_lists_data = []
    for _ in range(num_lists):
        user = random.choice(users_data)
        list_doc = {
            "_id": str(uuid.uuid4()),
            "user_id": user["_id"],
            "date_created": fake.date_time_between(start_date='-2m', end_date='now')
        }
        shopping_lists_data.append(list_doc)
    return shopping_lists_data

#  SHOPPING_LIST_ITEMS
def generate_shopping_list_items(shopping_lists_data, products_data, num_items=50):
    shopping_list_items_data = []
    for _ in range(num_items):
        sl = random.choice(shopping_lists_data)
        pd_item = random.choice(products_data)
        item_doc = {
            "_id": str(uuid.uuid4()),
            "shopping_list_id": sl["_id"],
            "item_name": pd_item["product_name"],
            "quantity": random.randint(1, 10),
            "note": fake.sentence(nb_words=5)
        }
        shopping_list_items_data.append(item_doc)
    return shopping_list_items_data

if __name__ == "__main__":
    # Generate data
    users_data = generate_users(num_users=10)
    stores_data = generate_stores(num_stores=5)
    products_data = generate_products(num_products=12)
    product_pricing_data = generate_product_pricing(products_data, num_records=30)
    baskets_data = generate_baskets(users_data, products_data, stores_data, num_baskets=50)
    shopping_lists_data = generate_shopping_lists(users_data, num_lists=15)
    shopping_list_items_data = generate_shopping_list_items(shopping_lists_data, products_data, num_items=40)
    
    # Convert pd to DataFrame
    users_df = pd.DataFrame(users_data)
    stores_df = pd.DataFrame(stores_data)
    products_df = pd.DataFrame(products_data)
    product_pricing_df = pd.DataFrame(product_pricing_data)
    baskets_df = pd.DataFrame(baskets_data)
    shopping_lists_df = pd.DataFrame(shopping_lists_data)
    shopping_list_items_df = pd.DataFrame(shopping_list_items_data)
    
    # Convert datetime to string 
    users_df['date_created'] = users_df['date_created'].astype(str)
    product_pricing_df['date'] = product_pricing_df['date'].astype(str)
    baskets_df['date_created'] = baskets_df['date_created'].astype(str)
    shopping_lists_df['date_created'] = shopping_lists_df['date_created'].astype(str)
    
    # Save DataFrame as CSV
    users_df.to_csv("users.csv", index=False)
    stores_df.to_csv("stores.csv", index=False)
    products_df.to_csv("products.csv", index=False)
    product_pricing_df.to_csv("product_pricing.csv", index=False)
    baskets_df.to_csv("baskets.csv", index=False)
    shopping_lists_df.to_csv("shopping_lists.csv", index=False)
    shopping_list_items_df.to_csv("shopping_list_items.csv", index=False)
    
    print("Created synthetic data Successful!")
