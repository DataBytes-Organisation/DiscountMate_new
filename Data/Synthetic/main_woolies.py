# Synthetic Customer Transaction Data Generator
# This script generates 40,000 synthetic customer transactions in a single CSV file

import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import re
import uuid


# Function to read the CSV file
def read_product_catalog(filename):
    try:
        # Read the CSV file
        df = pd.read_csv(filename)

        # Clean price data
        df['Item Price'] = df['Item Price'].apply(lambda x: float(re.sub(r'[^\d.]', '', str(x))) if pd.notna(x) else 0)

        return df
    except Exception as e:
        print(f"Error reading file: {e}")
        return pd.DataFrame()


# Define customer personas
def define_customer_personas(total_customers):
    personas = []

    # Create customer personas with different shopping behaviors
    for i in range(1, total_customers + 1):
        personas.append({
            'customerId': f'C{1000 + i}',
            'preferredCategories': get_random_preferred_categories(),
            'loyaltyScore': random.random(),  # 0-1 score representing loyalty
            'budget': get_budget_level(),  # low, medium, high
            'shoppingFrequency': get_shopping_frequency(),  # days between shops
            'timePreference': get_time_preference()  # morning, afternoon, evening
        })

    return personas


# Helper functions for customer personas
def get_random_preferred_categories():
    all_categories = [
        "Pantry", "Dairy, Eggs & Fridge", "Fruit & Veg", "Bakery",
        "Poultry, Meat & Seafood", "Deli & Chilled Meals", "Cleaning & Maintenance",
        "Beauty & Personal Care", "Home & Lifestyle", "Snacks & Confectionery",
        "Drinks", "Beer, Wine & Spirits", "International Foods", "Freezer"
    ]

    num_preferred = random.randint(3, 7)  # 3-7 preferred categories
    preferred = random.sample(all_categories, num_preferred)

    return preferred


def get_budget_level():
    rand = random.random()
    if rand < 0.25:
        return "low"
    if rand < 0.7:
        return "medium"
    return "high"


def get_shopping_frequency():
    rand = random.random()
    if rand < 0.15:
        return 2  # Every 2 days
    if rand < 0.4:
        return 3  # Every 3 days
    if rand < 0.7:
        return 7  # Weekly
    if rand < 0.9:
        return 14  # Bi-weekly
    return 30  # Monthly


def get_time_preference():
    rand = random.random()
    if rand < 0.25:
        return "morning"
    if rand < 0.6:
        return "afternoon"
    return "evening"


# Define shopping patterns
def define_shopping_patterns():
    return [
        {
            "name": "Weekly Grocery Shopping",
            "frequency": 0.35,  # 35% of transactions
            "categories": ["Pantry", "Dairy, Eggs & Fridge", "Fruit & Veg", "Bakery", "Poultry, Meat & Seafood"],
            "itemCount": {"min": 15, "max": 30},
            "regularItems": 0.7,  # 70% chance of buying regular items
        },
        {
            "name": "Quick Meal Shopping",
            "frequency": 0.2,
            "categories": ["Deli & Chilled Meals", "Bakery", "Dairy, Eggs & Fridge", "Drinks"],
            "itemCount": {"min": 3, "max": 8},
            "regularItems": 0.3,
        },
        {
            "name": "Health-Focused Shopping",
            "frequency": 0.15,
            "categories": ["Fruit & Veg", "Dairy, Eggs & Fridge", "Poultry, Meat & Seafood"],
            "itemCount": {"min": 8, "max": 15},
            "regularItems": 0.6,
        },
        {
            "name": "Party Supplies",
            "frequency": 0.05,
            "categories": ["Snacks & Confectionery", "Drinks", "Beer, Wine & Spirits"],
            "itemCount": {"min": 5, "max": 12},
            "regularItems": 0.2,
        },
        {
            "name": "Home Essentials",
            "frequency": 0.15,
            "categories": ["Cleaning & Maintenance", "Beauty & Personal Care", "Home & Lifestyle"],
            "itemCount": {"min": 2, "max": 7},
            "regularItems": 0.5,
        },
        {
            "name": "International Cuisine",
            "frequency": 0.1,
            "categories": ["International Foods", "Pantry", "Poultry, Meat & Seafood"],
            "itemCount": {"min": 5, "max": 12},
            "regularItems": 0.4,
        }
    ]


# Generate a single transaction
def generate_transaction(customer_id, transaction_date, products, products_by_category, patterns, customer_personas):
    # Get customer persona
    persona = next((p for p in customer_personas if p['customerId'] == customer_id), None)

    # Select a shopping pattern based on frequency and persona
    selected_pattern = None

    if random.random() < 0.7:
        # 70% chance to pick based on standard frequencies
        r = random.random()
        cumulative_probability = 0

        for pattern in patterns:
            cumulative_probability += pattern['frequency']
            if r <= cumulative_probability:
                selected_pattern = pattern
                break
    else:
        # 30% chance to pick based on customer's preferred categories
        compatible_patterns = [
            pattern for pattern in patterns
            if any(category in persona['preferredCategories'] for category in pattern['categories'])
        ]

        if compatible_patterns:
            selected_pattern = random.choice(compatible_patterns)
        else:
            selected_pattern = random.choice(patterns)

    # Budget multiplier affects item count
    budget_multiplier = 1
    if persona['budget'] == "low":
        budget_multiplier = 0.7
    if persona['budget'] == "high":
        budget_multiplier = 1.3

    # Determine number of items to purchase
    min_items = int(selected_pattern['itemCount']['min'] * budget_multiplier)
    max_items = int(selected_pattern['itemCount']['max'] * budget_multiplier)
    item_count = random.randint(min_items, max_items)

    # Select items to purchase
    purchased_items = []

    # Combine pattern categories with customer preferred categories
    priority_categories = selected_pattern['categories'].copy()
    for category in persona['preferredCategories']:
        if category not in priority_categories:
            priority_categories.append(category)

    # Filter to available categories
    available_categories = [
        category for category in priority_categories
        if category in products_by_category and len(products_by_category[category]) > 0
    ]

    # Ensure at least one item from each pattern category if possible
    for category in selected_pattern['categories']:
        if len(purchased_items) >= item_count:
            break

        if category in products_by_category and len(products_by_category[category]) > 0:
            category_products = products_by_category[category]
            selected_product = random.choice(category_products)

            purchased_items.append({
                'productCode': selected_product['Product Code'],
                'category': selected_product['Category'],
                'itemName': selected_product['Item Name'],
                'price': selected_product['Item Price'] or 0,
                'quantity': random.randint(1, 3)  # Purchase 1-3 of each item
            })

    # Fill remaining items with a preference toward the customer's preferred categories
    while len(purchased_items) < item_count:
        # Determine if we pick from preferred categories (higher chance) or any available category
        use_preferred_category = random.random() < 0.7

        if use_preferred_category:
            category_pool = [
                category for category in available_categories
                if category in persona['preferredCategories']
            ]
            # If no preferred categories are available, fall back to all available
            if not category_pool:
                category_pool = available_categories
        else:
            category_pool = available_categories

        if not category_pool:
            break

        category = random.choice(category_pool)
        category_products = products_by_category[category]

        if category_products:
            selected_product = random.choice(category_products)

            # Check if product is already in basket
            existing_product = next(
                (item for item in purchased_items if item['productCode'] == selected_product['Product Code']),
                None
            )

            if existing_product:
                # Increase quantity of existing product (max 5)
                if existing_product['quantity'] < 5:
                    existing_product['quantity'] += 1
            else:
                # Add new product
                quantity = random.randint(1, 3)  # Purchase 1-3 of each item

                # Higher budget customers buy more quantity
                if persona['budget'] == "high" and random.random() < 0.3:
                    quantity += random.randint(1, 2)

                purchased_items.append({
                    'productCode': selected_product['Product Code'],
                    'category': selected_product['Category'],
                    'itemName': selected_product['Item Name'],
                    'price': selected_product['Item Price'] or 0,
                    'quantity': quantity
                })

    # Calculate total
    total = sum(item['price'] * item['quantity'] for item in purchased_items)

    # Generate hour based on time preference
    if persona['timePreference'] == 'morning':
        hour = random.randint(8, 12)  # 8 AM - 12 PM
    elif persona['timePreference'] == 'afternoon':
        hour = random.randint(12, 18)  # 12 PM - 6 PM
    else:  # evening
        hour = random.randint(18, 22)  # 6 PM - 10 PM

    # Create proper datetime
    date_obj = datetime.strptime(transaction_date, '%Y-%m-%d')
    date_obj = date_obj.replace(hour=hour, minute=random.randint(0, 59))

    transaction_id = f"T{int(datetime.now().timestamp())}-{random.randint(0, 10000)}"

    return {
        'transactionId': transaction_id,
        'customerId': customer_id,
        'date': date_obj.isoformat(),
        'pattern': selected_pattern['name'],
        'items': purchased_items,
        'itemCount': len(purchased_items),
        'totalQuantity': sum(item['quantity'] for item in purchased_items),
        'totalAmount': round(total, 2)
    }


# Generate synthetic transaction data as a single flattened CSV file
def generate_transaction_data(filename, num_transactions=40000):
    # Read product catalog
    products_df = read_product_catalog(filename)
    if products_df.empty:
        return {
            'success': False,
            'message': "Failed to read product catalog"
        }

    # Convert DataFrame to list of dictionaries for easier processing
    products = products_df.to_dict('records')

    # Group products by category for faster access
    products_by_category = {}
    for product in products:
        category = product['Category']
        if category not in products_by_category:
            products_by_category[category] = []
        products_by_category[category].append(product)

    # Define number of customers
    num_customers = 1000

    # Create customer personas
    customer_personas = define_customer_personas(num_customers)

    # Define shopping patterns
    shopping_patterns = define_shopping_patterns()

    # Generate transactions
    transactions = []

    # Set date range (6 months of data)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=180)

    # Create a shopping schedule for each customer
    for customer in customer_personas:
        current_date = start_date

        # Generate transactions for this customer over the date range
        while current_date <= end_date:
            # Add transaction if we haven't hit our limit
            if len(transactions) < num_transactions:
                transactions.append(generate_transaction(
                    customer['customerId'],
                    current_date.strftime('%Y-%m-%d'),
                    products,
                    products_by_category,
                    shopping_patterns,
                    customer_personas
                ))
            else:
                break

            # Move to next shopping date based on frequency
            current_date += timedelta(days=customer['shoppingFrequency'])

        # If we've hit our transaction limit, stop
        if len(transactions) >= num_transactions:
            break

    # If we still need more transactions, add random ones
    while len(transactions) < num_transactions:
        random_customer = random.choice(customer_personas)
        random_days = random.randint(0, 180)  # Random day in the past 6 months

        transaction_date = end_date - timedelta(days=random_days)

        transactions.append(generate_transaction(
            random_customer['customerId'],
            transaction_date.strftime('%Y-%m-%d'),
            products,
            products_by_category,
            shopping_patterns,
            customer_personas
        ))

    # Keep only the first num_transactions transactions
    final_transactions = transactions[:num_transactions]

    # Create a flattened structure for a single CSV file
    flattened_rows = []

    for transaction in final_transactions:
        transaction_id = transaction['transactionId']
        customer_id = transaction['customerId']
        date_time = transaction['date']
        pattern_type = transaction['pattern']
        basket_size = transaction['itemCount']
        total_quantity = transaction['totalQuantity']
        total_amount = transaction['totalAmount']

        # Add each purchased item as a separate row with transaction details
        for item in transaction['items']:
            flattened_rows.append({
                'TransactionID': transaction_id,
                'CustomerID': customer_id,
                'DateTime': date_time,
                'PatternType': pattern_type,
                'TotalQuantity': total_quantity,  # Total number of items across all products in transaction
                'TotalAmount': total_amount,
                'ProductCode': item['productCode'],
                'Category': item['category'],
                'ItemName': item['itemName'],
                'UnitPrice': round(item['price'], 2),
                'Quantity': item['quantity']  # Quantity of this specific product
            })

    # Create DataFrame
    flattened_df = pd.DataFrame(flattened_rows)

    # Save to a single CSV
    output_file = 'customer_transactions_woolies.csv'
    flattened_df.to_csv(output_file, index=False)

    # Calculate summary statistics
    unique_transactions = len(set(row['TransactionID'] for row in flattened_rows))
    total_revenue = sum(transaction['totalAmount'] for transaction in final_transactions)
    avg_basket_size = sum(transaction['itemCount'] for transaction in final_transactions) / len(final_transactions)
    avg_basket_value = total_revenue / len(final_transactions)

    return {
        'success': True,
        'summary': {
            'totalTransactions': unique_transactions,
            'uniqueCustomers': len(set(row['CustomerID'] for row in flattened_rows)),
            'totalItems': len(flattened_rows),
            'totalRevenue': round(total_revenue, 2),
            'averageBasketSize': round(avg_basket_size, 1),
            'averageBasketValue': round(avg_basket_value, 2)
        },
        'output_file': output_file
    }


# Example usage
def main():
    print("Generating synthetic transaction data...")

    result = generate_transaction_data('Wed04SepWoolworths 1.csv', 40000)

    if result['success']:
        print("Generation successful!")
        print(f"Summary: {result['summary']}")
        print(f"File created: {result['output_file']}")

        # Print sample of data structure
        try:
            sample_df = pd.read_csv(result['output_file'], nrows=5)
            print("\nSample data (first 5 rows):")
            print(sample_df)
        except Exception as e:
            print(f"Error reading sample: {e}")
    else:
        print(f"Error: {result['message']}")


if __name__ == "__main__":
    main()