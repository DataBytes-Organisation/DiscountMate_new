from ocr.matcher import load_products_from_csv, match_receipt_items

csv_file = "../../Data/Synthetic/synthetic_woolworths_10k.csv"

products = load_products_from_csv(csv_file)

print("===== DATASET CHECK =====")
print("Total products loaded:", len(products))
print("First 3 products:")
for product in products[:3]:
    print(product)

print("\n===== MATCHING TEST =====")

parsed_items = [
    {"item": "Helga's Bread Traditional White 750g", "price": 4.15},
    {"item": "Twisties Zig Zag Wicked Cheddar Snack Bag Share Pack 65g", "price": 6.50},
    {"item": "Toscano French Brioche Rolls Chocolate 280g", "price": 7.00},
    {"item": "CSR Sugar Caster 1kg", "price": 2.89},
    {"item": "Essentials Flour Plain 1kg", "price": 1.49},
]

results = match_receipt_items(parsed_items, products)

for result in results:
    print(result)