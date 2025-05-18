from pymongo import MongoClient

client = MongoClient('mongodb+srv://discountmate_read_and_write:discountmate@discountmatecluster.u80y7ta.mongodb.net/DiscountMate')
db = client['DiscountMate']
collection = db['iga_products']

# Print first 5 documents
for doc in collection.find().limit(5):
    print(doc)