import os
import cv2
import pytesseract
from parser import parse_receipt


def extract_text(image_path):
    if not os.path.exists(image_path):
        print("Image not found:", image_path)
        return ""

    img = cv2.imread(image_path)

    if img is None:
        print("Could not read image:", image_path)
        return ""

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply thresholding
    _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

    # OCR extraction
    text = pytesseract.image_to_string(thresh)

    return text


if __name__ == "__main__":
    image_path = "sample_data/receipt1.jpeg"

    text = extract_text(image_path)

    print("\n===== OCR OUTPUT =====\n")
    print(text)

    print("\n===== PARSED DATA =====\n")

    parsed = parse_receipt(text)

    for item in parsed:
        print(item)