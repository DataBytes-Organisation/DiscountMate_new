import json

class DummyCatalog:
    def __init__(self, filepath="dummy_catalog.json"):
        """Loads the dummy product catalogue for initial demo testing."""
        try:
            with open(filepath, 'r') as file:
                self.catalog = json.load(file)
            print(f"Successfully loaded {len(self.catalog)} products from the dummy catalog.")
        except FileNotFoundError:
            print(f"Error: {filepath} not found.")
            self.catalog = []

    def search_by_name(self, query):
        """Basic search function to simulate a database query."""
        results = [item for item in self.catalog if query.lower() in item['product_name'].lower()]
        return results

# Test the loader
if __name__ == "__main__":
    db = DummyCatalog()
    print(db.search_by_name("butter"))