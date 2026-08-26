import json
from catalog_loader_prototype import DummyCatalog
from intent_extractor_prototype import extract_entities_and_intent
from fuzzy_matcher_prototype import fuzzy_match_product

def process_chat_query(user_query, catalog):
    """Executes the end-to-end chatbot NLP and matching pipeline."""
    print(f"\n--- Processing Query: '{user_query}' ---")

    # Step 1: Extract Intent and Entities (DL-06-T7, DL-06-T8)
    extraction = extract_entities_and_intent(user_query)
    print(f"1. Intent Detected: {extraction['intent']} (Confidence: {extraction['confidence']})")
    
    product_entity = extraction["extracted_entities"]["product"]
    retailer_entity = extraction["extracted_entities"]["retailer"]
    
    if not product_entity:
        return {"status": "error", "message": "Could not extract a product name."}
        
    print(f"2. Extracted Product: '{product_entity}' | Target Retailer: '{retailer_entity}'")

    # Step 2: Fuzzy Match against Dummy Catalog (DL-06-T12)
    match_result = fuzzy_match_product(product_entity, catalog)

    # Step 3: Format Standardised JSON Response (DL-06-T17)
    if match_result["match_found"]:
        item = match_result["matched_product"]
        print(f"3. Database Match: {item['product_name']} (Score: {match_result['confidence_score']})")
        
        return {
            "query": user_query,
            "action": extraction["intent"],
            "status": "success",
            "data": {
                "product_id": item["product_id"],
                "product_name": item["product_name"],
                "retailer": item["retailer"],
                "price": item["price"],
                "pack_size": item["pack_size"]
            }
        }
    else:
        print("3. Database Match: Failed.")
        return {
            "query": user_query,
            "action": extraction["intent"],
            "status": "not_found",
            "message": match_result["message"]
        }

if __name__ == "__main__":
    # Initialize the dummy database (DL-06-T4, DL-06-T13)
    db = DummyCatalog()

    # Simulate an end-to-end user request
    test_query = "Find the best deal for devon butter 250 grams at Woolworths"
    final_api_response = process_chat_query(test_query, db.catalog)

    print("\n--- Final API JSON Output ---")
    print(json.dumps(final_api_response, indent=4))