import json
import re
import difflib

def clean_product_name(name):
    """DL-06-T10: Advanced product name cleaning and normalisation."""
    if not name:
        return ""
    
    name = name.lower()
    
    # 1. Standardise weight metrics (Now handles connected numbers like '250grams' -> '250g')
    name = re.sub(r'(\d*)\s*(kilos?|kilograms?)\b', r'\1kg', name)
    name = re.sub(r'(\d*)\s*(grams?)\b', r'\1g', name)
    name = re.sub(r'(\d*)\s*(litres?|liters?)\b', r'\1l', name)
    name = re.sub(r'(\d*)\s*(millilitres?|milliliters?|mls?)\b', r'\1ml', name)
    
    # 2. Standardise spacing around weights (e.g., "250 kg" becomes "250kg")
    name = re.sub(r'(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b', r'\1\2', name)
    
    # 3. Strip common retail filler words that skew fuzzy matching
    # 3. Strip common retail filler words AND conversational noise that skew fuzzy matching
    filler_words = r'\b(brand|fresh|organic|premium|everyday|quality|cheapest|cheap|price|at|woolies|woolworths|coles|aldi|the|is|for|where|how|much)\b'
    name = re.sub(filler_words, '', name)
    
    # 4. Remove special characters, keeping only alphanumeric and spaces
    name = re.sub(r'[^a-z0-9\s]', '', name)
    
    # 5. Condense multiple spaces into a single space
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name

def fuzzy_match_product(extracted_product, catalog, high_threshold=0.70, low_threshold=0.40):
    """DL-06-T15: Uses token intersection, difflib, and ambiguity handling for robust semantic matching."""
    cleaned_query = clean_product_name(extracted_product)
    query_tokens = set(cleaned_query.split())
    
    scored_products = []

    for item in catalog:
        cleaned_item_name = clean_product_name(item['product_name'])
        item_tokens = set(cleaned_item_name.split())
        
        # Scoring Metric 1: Sequence Ratio (Standard difflib)
        sequence_score = difflib.SequenceMatcher(None, cleaned_query, cleaned_item_name).ratio()
        
        # Scoring Metric 2: Substring Token Overlap (Handles partial words like 'devon' in 'devondale')
        if query_tokens:
            overlap = 0
            for q in query_tokens:
                # Counts as a match if the query word is part of the catalog word, or vice versa
                if any(q in i or i in q for i in item_tokens):
                    overlap += 1
            token_score = overlap / len(query_tokens)
        else:
            token_score = 0.0
            
        # Blended Score: Weighs token overlap slightly higher for grocery items
        blended_score = (sequence_score * 0.4) + (token_score * 0.6)
        
        # Keep track of anything that passes the minimum fallback threshold
        if blended_score >= low_threshold:
            scored_products.append({
                "product": item,
                "score": blended_score
            })

    # Sort matches by highest score
    scored_products = sorted(scored_products, key=lambda x: x['score'], reverse=True)

    # 1. Handle Not Found
    if not scored_products:
        return {
            "match_found": False,
            "status": "not_found",
            "confidence_score": 0.0,
            "message": "Low confidence: No products met the matching threshold."
        }
        
    top_match = scored_products[0]
    is_ambiguous = False
    
    # 2. Condition A: The top score is okay, but not high enough to be absolutely certain
    if top_match['score'] < high_threshold:
        is_ambiguous = True
        
    # 3. Condition B: There are multiple products with practically identical scores (a tie)
    elif len(scored_products) > 1:
        score_difference = top_match['score'] - scored_products[1]['score']
        if score_difference < 0.05: # Within a 5% margin
            is_ambiguous = True

    # 4. Handle Ambiguity (Fallback & Clarification)
    if is_ambiguous:
        # Grab the names of the top 3 closest matches for the LLM to suggest to the user
        suggestions = [item['product']['product_name'] for item in scored_products[:3]]
        return {
            "match_found": False,
            "status": "ambiguous",
            "confidence_score": round(top_match['score'], 2),
            "message": "Multiple or partial matches found. Please ask the user to clarify.",
            "suggestions": suggestions
        }
        
    # 5. Complete Success
    return {
        "match_found": True,
        "status": "success",
        "confidence_score": round(top_match['score'], 2),
        "matched_product": top_match['product']
    }

if __name__ == "__main__":
    # Load the dummy catalog to run local tests
    try:
        with open("dummy_catalog.json", "r") as f:
            catalog = json.load(f)
    except FileNotFoundError:
        print("Error: dummy_catalog.json not found.")
        catalog = []

    if catalog:
        # T10 Rigorous Edge-Case Tests
        test_entities = [
            "fresh full cream milk 2 l",       # Spacing issue & filler word ("fresh", "2 l")
            "devon butter 250grams",           # Typos and un-normalized weights ("250grams")
            "coles brand dairy milk",          # Brand filler word ("brand")
            "premium organic apples 1kg",      # Item not in catalog (should safely fail)
            "milk"
        ]
        
        print("Running T10 Advanced Normalisation Tests...\n")
        for entity in test_entities:
            print(f"Raw Input: '{entity}'")
            print(f"Cleaned Query: '{clean_product_name(entity)}'")
            result = fuzzy_match_product(entity, catalog)
            
            if result["match_found"]:
                print(f"Matched with: {result['matched_product']['product_name']} (ID: {result['matched_product']['product_id']})")
                print(f"   Confidence: {result['confidence_score']}\n")
            else:
                print(f"Match failed. Best score: {result['confidence_score']} - {result['message']}\n")