import re
import csv
import json
import os
from difflib import SequenceMatcher


def normalize_text(text: str) -> str:
    if not text:
        return ""

    text = str(text).lower().strip()

    replacements = {
        "lkq": "1kg",
        "tkg": "1kg",
        "kq": "kg",
        "lq": "kg",
        "0rganic": "organic",
        "organicvan": "organic",
        "baketret": "bakeret",
        "essentia ls": "essentials",
        "fre a": "free",
        "wtwax": "wax",
        "sharenack": "sharepack",
        "funtse": "fun",
    }

    for wrong, correct in replacements.items():
        text = text.replace(wrong, correct)

    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


def token_score(a: str, b: str) -> float:
    a_tokens = set(normalize_text(a).split())
    b_tokens = set(normalize_text(b).split())

    if not a_tokens or not b_tokens:
        return 0.0

    overlap = len(a_tokens.intersection(b_tokens))
    return overlap / max(len(a_tokens), len(b_tokens))


def similarity_score(a: str, b: str) -> float:
    a_norm = normalize_text(a)
    b_norm = normalize_text(b)

    sequence = SequenceMatcher(None, a_norm, b_norm).ratio()
    token = token_score(a_norm, b_norm)

    # slightly favor token overlap for OCR noise
    return (sequence * 0.55) + (token * 0.45)


def get_confidence(score: float) -> str:
    if score >= 0.75:
        return "high"
    elif score >= 0.50:
        return "medium"
    elif score >= 0.28:
        return "low"
    return "unmatched"


def load_products(products_file: str):
    if not os.path.exists(products_file):
        return []

    with open(products_file, "r", encoding="utf-8") as f:
        return json.load(f)


def load_products_from_csv(csv_file: str):
    products = []

    if not os.path.exists(csv_file):
        return products

    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            product = {
                "id": row.get("Product Code") or row.get("product code"),
                "name": row.get("Item Name") or row.get("item name"),
                "brand": row.get("Brand") or row.get("brand") or row.get("category"),
                "price": row.get("Price") or row.get("price") or row.get("Unit Price") or row.get("unit price"),
            }

            if product["name"]:
                products.append(product)

    return products


def price_score(ocr_price, product_price):
    try:
        if ocr_price is None or product_price in [None, ""]:
            return 0.0

        ocr_price = float(ocr_price)
        product_price = float(product_price)

        diff = abs(ocr_price - product_price)

        if diff == 0:
            return 1.0
        elif diff <= 0.50:
            return 0.8
        elif diff <= 1.00:
            return 0.5

        return 0.0

    except:
        return 0.0


def match_single_item(
    ocr_item: str,
    products: list,
    ocr_price=None,
    threshold: float = 0.28
):
    normalized_ocr = normalize_text(ocr_item)

    best_match = None
    best_score = 0
    best_text_score = 0
    best_price_score = 0

    for product in products:
        product_name = product.get("name", "")
        brand = product.get("brand", "")
        product_price = product.get("price")

        combined_text = f"{brand} {product_name}"

        score_name = similarity_score(normalized_ocr, product_name)
        score_combined = similarity_score(normalized_ocr, combined_text)

        text_score = max(score_name, score_combined)

        p_score = price_score(ocr_price, product_price)

        if p_score > 0:
            final_score = (text_score * 0.8) + (p_score * 0.2)
        else:
            final_score = text_score

        if final_score > best_score:
            best_score = final_score
            best_text_score = text_score
            best_price_score = p_score
            best_match = product

    confidence = get_confidence(best_score)

    if best_match and best_score >= threshold:
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
            "confidence": confidence
        }

    return {
        "ocr_item": ocr_item,
        "matched": False,
        "matched_product": None,
        "product_id": None,
        "brand": None,
        "ocr_price": ocr_price,
        "dataset_price": None,
        "match_score": round(best_score, 2),
        "text_score": round(best_text_score, 2),
        "price_score": round(best_price_score, 2),
        "confidence": "unmatched"
    }


def match_receipt_items(
    parsed_items: list,
    products: list,
    threshold: float = 0.28
):
    results = []

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