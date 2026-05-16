import re
import csv
import json
import os
from difflib import SequenceMatcher


MIN_MATCH_SCORE = 0.50
MIN_TEXT_SCORE = 0.45


def normalize_text(text: str) -> str:
    if not text:
        return ""

    text = str(text).lower().strip()
    text = re.sub(r"^[#\^\*\-]+", "", text)
    text = text.replace("/", " ")

    replacements = {
        "hilk": "milk",
        "hikl": "milk",
        "hkitkat": "kitkat",
        "hquilton": "quilton",
        "hbig": "big",
        "hnutix": "multix",
        "hove": "dove",
        "t tissue": "toilet tissue",
        "ttissue": "toilet tissue",
        "3ply": "3 ply",
        "2ply": "2 ply",
        "24pk": "24 pack",
        "20pk": "20 pack",
        "18pk": "18 pack",
        "10pk": "10 pack",
        "xlrg": "extra large",
        "lge": "large",
        "fms": "free range",
        "c scent": "scent",
        "intensiverepair": "intensive repair",
        "lkq": "1kg",
        "tkg": "1kg",
        "kq": "kg",
        "lq": "kg",
        "0rganic": "organic",
        "essentia ls": "essentials",
    }

    for wrong, correct in replacements.items():
        text = text.replace(wrong, correct)

    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_price(value):
    if value in [None, ""]:
        return None

    try:
        value = str(value).replace("$", "").replace(",", "").strip()
        if value.lower() in ["nan", "none", "null"]:
            return None
        return float(value)
    except Exception:
        return None


def token_score(a: str, b: str) -> float:
    a_tokens = set(normalize_text(a).split())
    b_tokens = set(normalize_text(b).split())

    if not a_tokens or not b_tokens:
        return 0.0

    overlap = len(a_tokens.intersection(b_tokens))
    return overlap / max(len(a_tokens), len(b_tokens))


def partial_token_score(a: str, b: str) -> float:
    a_tokens = normalize_text(a).split()
    b_tokens = normalize_text(b).split()

    if not a_tokens or not b_tokens:
        return 0.0

    matches = 0
    for at in a_tokens:
        for bt in b_tokens:
            if at == bt or at in bt or bt in at:
                matches += 1
                break

    return matches / max(len(a_tokens), len(b_tokens))


def sequence_score(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_text(a), normalize_text(b)).ratio()


def similarity_score(a: str, b: str) -> float:
    seq = sequence_score(a, b)
    token = token_score(a, b)
    partial = partial_token_score(a, b)

    return (seq * 0.45) + (token * 0.35) + (partial * 0.20)


def get_confidence(score: float) -> str:
    if score >= 0.75:
        return "high"
    elif score >= 0.60:
        return "medium"
    elif score >= 0.50:
        return "low"
    return "unmatched"


def load_products(products_file: str):
    if not os.path.exists(products_file):
        print(f"[MATCHER] Product JSON file not found: {products_file}")
        return []

    with open(products_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"[MATCHER] Loaded {len(products)} products from JSON: {products_file}")
    return products


def load_products_from_csv(csv_file: str):
    products = []

    if not os.path.exists(csv_file):
        print(f"[MATCHER] Product CSV file not found: {csv_file}")
        return products

    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            product = {
                "id": (
                    row.get("Product Code")
                    or row.get("product code")
                    or row.get("product_id")
                    or row.get("id")
                ),
                "name": (
                    row.get("Item Name")
                    or row.get("item name")
                    or row.get("Product Name")
                    or row.get("product_name")
                    or row.get("name")
                    or row.get("title")
                ),
                "brand": (
                    row.get("Brand")
                    or row.get("brand")
                    or row.get("Category")
                    or row.get("category")
                    or ""
                ),
                "price": clean_price(
                    row.get("Best Price")
                    or row.get("Item Price")
                    or row.get("Discount Price")
                    or row.get("Original Price")
                    or row.get("Price")
                    or row.get("price")
                    or row.get("Unit Price")
                    or row.get("unit price")
                ),
            }

            if product["name"]:
                products.append(product)

    print(f"[MATCHER] Loaded {len(products)} products from CSV: {csv_file}")

    if products:
        print("[MATCHER] Sample product:", products[0])

    return products


def price_score(ocr_price, product_price):
    ocr_price = clean_price(ocr_price)
    product_price = clean_price(product_price)

    if ocr_price is None or product_price is None:
        return 0.0

    diff = abs(ocr_price - product_price)

    if diff == 0:
        return 1.0
    elif diff <= 0.50:
        return 0.7
    elif diff <= 1.00:
        return 0.4

    return 0.0


def match_single_item(ocr_item: str, products: list, ocr_price=None, threshold: float = MIN_MATCH_SCORE):
    normalized_ocr = normalize_text(ocr_item)

    best_match = None
    best_score = 0
    best_text_score = 0
    best_price_score = 0

    for product in products:
        product_name = product.get("name", "") or ""
        brand = product.get("brand", "") or ""
        product_price = product.get("price")

        combined_text = f"{brand} {product_name}".strip()

        score_name = similarity_score(normalized_ocr, product_name)
        score_combined = similarity_score(normalized_ocr, combined_text)

        text_score = max(score_name, score_combined)
        p_score = price_score(ocr_price, product_price)

        final_score = (text_score * 0.85) + (p_score * 0.15)

        if final_score > best_score:
            best_score = final_score
            best_text_score = text_score
            best_price_score = p_score
            best_match = product

    if best_match and best_score >= threshold and best_text_score >= MIN_TEXT_SCORE:
        return {
            "ocr_item": ocr_item,
            "matched": True,
            "matched_product": best_match.get("name"),
            "product_id": best_match.get("id"),
            "brand": best_match.get("brand"),
            "ocr_price": ocr_price,
            "dataset_price": best_match.get("price"),
            "match_score": round(best_score, 2),
            "text_score": round(best_text_score, 2),
            "price_score": round(best_price_score, 2),
            "confidence": get_confidence(best_score)
        }

    return {
        "ocr_item": ocr_item,
        "matched": False,
        "matched_product": None,
        "product_id": None,
        "brand": None,
        "ocr_price": ocr_price,
        "dataset_price": best_match.get("price") if best_match else None,
        "best_candidate": best_match.get("name") if best_match else None,
        "match_score": round(best_score, 2),
        "text_score": round(best_text_score, 2),
        "price_score": round(best_price_score, 2),
        "confidence": "unmatched"
    }


def match_receipt_items(parsed_items: list, products: list, threshold: float = MIN_MATCH_SCORE):
    results = []

    print(f"[MATCHER] Matching {len(parsed_items)} receipt items against {len(products)} products")

    for item in parsed_items:
        item_name = item.get("item", "")
        item_price = item.get("price")

        match_result = match_single_item(
            ocr_item=item_name,
            products=products,
            ocr_price=item_price,
            threshold=threshold
        )

        results.append({
            "item": item_name,
            "price": item_price,
            "match": match_result
        })

    return results