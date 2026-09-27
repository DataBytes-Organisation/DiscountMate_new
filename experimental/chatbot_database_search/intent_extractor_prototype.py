import json
import re
import os

def extract_entities_and_intent(query):
    """Parses a natural language query for chatbot shopping intents and entities."""
    query_lower = query.lower()
    
    # Standardised JSON output format for backend API integration
    result = {
        "query": query,
        "intent": "unknown",
        "confidence": 0.0,
        "extracted_entities": {
            "retailer": None,
            "product": None,
            "pack_size": None
        }
    }

    intent_keywords = ["cheapest", "price", "how much", "compare", "best deal"]
    if any(word in query_lower for word in intent_keywords):
        result["intent"] = "price_comparison"
        result["confidence"] = 0.85 # Prototype confidence score

    # Entity Extraction: Retailer
    retailers = ["woolworths", "coles", "aldi", "iga"]
    for r in retailers:
        if r in query_lower:
            result["extracted_entities"]["retailer"] = r.capitalize()

    # Entity Extraction: Pack Size (e.g., 2L, 500g, 1kg) using Regex
    size_match = re.search(r'(\d+(?:\.\d+)?\s*(kg|g|l|ml))', query_lower)
    if size_match:
        result["extracted_entities"]["pack_size"] = size_match.group(1).replace(" ", "")

    # Entity Extraction: Product Name (Removing stopwords/retailers to isolate the item)
    stopwords = ["what", "is", "the", "cheapest", "price", "for", "at", "how", "much", "compare", "find", "best", "deal", "?", "a"] + retailers + intent_keywords
    words = query_lower.replace("?", "").split()
    
    # Filter out stopwords and the pack sizes
    product_words = [w for w in words if w not in stopwords and not re.match(r'\d+(kg|g|l|ml)', w)]
    
    if product_words:
        result["extracted_entities"]["product"] = " ".join(product_words).title()

    return result

if __name__ == "__main__":
    # DL-06-T5: Synthetic natural-language test queries
    test_queries = [
        "What is the cheapest 2L milk at Woolworths?",
        "Compare price for 500g devondale butter at Coles",
        "How much is pasta at IGA?",
        "Find the best deal for 1kg chicken breast"
    ]

    print("Running NLP Intent Extraction Tests...\n")
    results = []
    
    for q in test_queries:
        parsed_result = extract_entities_and_intent(q)
        results.append(parsed_result)
        print(f"Query: '{q}'")
        print(f"Intent: {parsed_result['intent']} | Product: {parsed_result['extracted_entities']['product']} | Retailer: {parsed_result['extracted_entities']['retailer']}\n")

    # Save results to sample_outputs folder as proof of testing
    output_dir = "sample_outputs"
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "extraction_results.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=4)

    print(f"Successfully processed {len(test_queries)} queries. Results saved to {output_path}.")