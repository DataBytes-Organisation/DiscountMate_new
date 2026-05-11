import os
import cv2
import pytesseract
from pytesseract import Output
from ocr.parser import build_receipt_data


def validate_receipt_image(image_path):
    if not os.path.exists(image_path):
        return False, "Image file not found."

    img = cv2.imread(image_path)

    if img is None:
        return False, "Could not read the uploaded image."

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape

    if width < 600 or height < 600:
        return False, "The uploaded receipt image is too small. Please upload a clearer image."

    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    if blur_score < 80:
        return False, "The uploaded receipt image is blurry. Please upload a sharper image."

    brightness = gray.mean()
    if brightness < 60:
        return False, "The uploaded receipt image is too dark. Please take the photo in better lighting."

    contrast = gray.std()
    if contrast < 25:
        return False, "The uploaded receipt image has very low contrast. Please upload a clearer receipt image."

    return True, "Image quality is acceptable."


def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.bilateralFilter(gray, 11, 17, 17)

    processed = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15
    )

    return processed


def extract_ocr_text(processed_image):
    config = r"--oem 3 --psm 6"
    return pytesseract.image_to_string(processed_image, config=config)


def calculate_ocr_quality(processed_image, items):
    data = pytesseract.image_to_data(processed_image, output_type=Output.DICT)

    confidences = []
    valid_words = []

    for i in range(len(data["text"])):
        word = data["text"][i].strip()
        conf = data["conf"][i]

        try:
            conf = float(conf)
        except ValueError:
            continue

        if word and conf > 0:
            confidences.append(conf)
            valid_words.append(word)

    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    likely_items = []
    ignore_items = {
        "subtotal", "total", "tax", "card", "cash",
        "change", "specials", "points", "rewards",
        "payment", "approved", "debit", "eftpos",
        "purchase", "aid", "auth", "ref", "trace"
    }

    for item in items:
        item_name = item.get("item", "").strip().lower()

        if len(item_name) < 3:
            continue

        if item_name in ignore_items:
            continue

        likely_items.append(item)

    quality = {
        "avg_confidence": round(avg_confidence, 2),
        "word_count": len(valid_words),
        "parsed_item_count": len(items),
        "likely_item_count": len(likely_items)
    }

    return quality


def process_receipt_internal(image_path):
    valid, message = validate_receipt_image(image_path)
    if not valid:
        return {
            "success": False,
            "error": message,
            "data": None,
            "ocr_text": "",
            "quality": {}
        }

    img = cv2.imread(image_path)
    processed = preprocess_image(img)

    ocr_text = extract_ocr_text(processed)

    if not ocr_text.strip():
        return {
            "success": False,
            "error": "No readable text was found in the uploaded receipt. Please upload a clearer image.",
            "data": None,
            "ocr_text": "",
            "quality": {}
        }

    receipt_data = build_receipt_data(ocr_text)
    quality = calculate_ocr_quality(processed, receipt_data["items"])

    warning = None

    if quality["word_count"] < 8:
        return {
            "success": False,
            "error": "The receipt image is too unclear or incomplete. Please upload a clearer, well-lit full receipt image.",
            "data": None,
            "ocr_text": ocr_text,
            "quality": quality
        }

    if quality["avg_confidence"] < 50 or quality["likely_item_count"] < 1:
        return {
            "success": False,
            "error": "The receipt image is too unclear or incomplete. Please upload a clearer, well-lit full receipt image.",
            "data": None,
            "ocr_text": ocr_text,
            "quality": quality
        }

    if quality["avg_confidence"] < 65:
        warning = "Some items may not be extracted correctly due to image quality."

    return {
        "success": True,
        "message": "Receipt processed successfully.",
        "warning": warning,
        "data": receipt_data,
        "ocr_text": ocr_text,
        "quality": quality
    }


def build_user_response(result):
    if not result["success"]:
        return {
            "success": False,
            "error": result["error"]
        }

    return {
        "success": True,
        "message": result["message"],
        "warning": result.get("warning"),
        "receipt": {
            "store_name": result["data"].get("store_name"),
            "items": result["data"].get("items", []),
            "subtotal": result["data"].get("subtotal"),
            "total": result["data"].get("total"),
            "savings": result["data"].get("savings")
        }
    }


if __name__ == "__main__":
    image_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "sample_data",
        "receipt1.jpeg"
    )

    internal_result = process_receipt_internal(image_path)
    user_result = build_user_response(internal_result)

    print("\n===== USER RESPONSE =====\n")
    print(user_result)