"""
Catalogue OCR Pipeline
Reads exported OCR zone crops and extracts structured product fields.

Pipeline position:
- Stage 1: catalogue_scraper_main.py
- Stage 2: catalogue_tile_detection.py
- Stage 3: catalogue_zone_detection.py
- Stage 4: catalogue_ocr.py

This script:
- scans catalogue folders with `exported_zones/`
- reads `zone_detections.csv`
- groups zone crops by tile
- runs PaddleOCR plus zoned/Tesseract price parsing
- writes per-catalogue OCR result CSVs and attempt logs
- appends master CSV outputs under `catalogue_data/`
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import traceback
from inspect import signature
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np
import pandas as pd
import pytesseract

os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from paddleocr import PaddleOCR
from pandas.errors import EmptyDataError

from catalogue_pipeline_common import (
    CatalogueStageOutcome,
    FailureDetail,
    StageResult,
    finish_stage_result,
    make_stage_result,
)


CATALOGUES_DIR = Path("catalogues")
LOG_SUBDIR = Path("catalogue_data/logs")
MASTER_RESULTS_CSV = Path("catalogue_data/historical_ocr_results.csv")
MASTER_ATTEMPTS_CSV = Path("catalogue_data/historical_ocr_attempts.csv")

ZONE_SUBFOLDER = "exported_zones"
ZONE_DETECTIONS_CSV = "zone_detections.csv"
OCR_RESULTS_CSV = "ocr_results.csv"
OCR_ATTEMPTS_CSV = "ocr_attempts.csv"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
OCR_RESULT_COLUMNS = [
    "Retailer",
    "Store",
    "Catalogue",
    "Catalogue_Title",
    "Catalogue_On_Sale_Date",
    "State",
    "Year",
    "Tile",
    "Source_Image",
    "Page_Name",
    "Tile_Image_Path",
    "Tile_Confidence",
    "Name",
    "Price_Now",
    "Save_amount",
    "PriceWas",
    "UnitPrice",
    "OCR_Method_Name",
    "OCR_Method_Price",
    "OCR_Method_Save",
    "OCR_Method_UnitPrice",
    "Num_Zone_Boxes",
    "Quality_Flag",
    "Processed_Timestamp",
]
OCR_ATTEMPT_COLUMNS = [
    "Retailer",
    "Catalogue",
    "Tile",
    "Page_Name",
    "Field",
    "Class",
    "Method",
    "Result",
    "Score",
]

CLASS_TO_FIELD = {
    "description_block": "Name",
    "price_main": "Price_Now",
    "promo_text_block": "Save_amount",
    "unit_price_block": "UnitPrice",
}

PROMO_CONFIGS = [("psm6_text", "--psm 6"), ("psm7_text", "--psm 7")]
UNIT_CONFIGS = [("psm6_text", "--psm 6")]
DESC_CONFIGS = [("psm6_text", "--psm 6"), ("psm4_col", "--psm 4"), ("psm3_auto", "--psm 3")]

KNOWN_RETAILERS = [
    "iga",
    "woolworths",
    "coles",
    "aldi",
    "metcash",
    "foodland",
    "drakes",
    "costco",
    "spar",
    "bi-lo",
    "bilo",
    "friendly grocer",
    "foodworks",
    "ritchies",
    "supabarn",
    "harris farm",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Stage 4 OCR over exported OCR zones."
    )
    parser.add_argument(
        "--catalogues-dir",
        type=str,
        default=str(CATALOGUES_DIR),
        help="Catalogue root directory. Default: catalogues",
    )
    parser.add_argument(
        "--limit-catalogues",
        type=int,
        default=None,
        help="Optional cap on number of catalogue folders to process.",
    )
    parser.add_argument(
        "--limit-tiles",
        type=int,
        default=None,
        help="Optional cap on number of tiles per catalogue.",
    )
    parser.add_argument(
        "--tesseract-cmd",
        type=str,
        default=None,
        help="Optional explicit path to the tesseract executable.",
    )
    parser.add_argument(
        "--rebuild-master",
        action="store_true",
        help="Delete and rebuild master OCR output CSVs before processing.",
    )
    return parser.parse_args()


def setup_logging(script_dir: Path) -> tuple[logging.Logger, Path]:
    log_dir = script_dir / LOG_SUBDIR
    log_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"catalogue_ocr_log_{timestamp}.txt"

    logger = logging.getLogger("catalogue_ocr")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False
    handler = logging.FileHandler(log_file, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)
    return logger, log_file


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def safe_relative(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)


def extract_retailer(catalogue_name: str) -> str:
    name_lower = catalogue_name.lower().replace("_", " ").replace("-", " ")
    for retailer in KNOWN_RETAILERS:
        if retailer in name_lower:
            return retailer.title()
    return "Unknown"


def find_catalogue_folders(base_dir: Path, limit: Optional[int] = None) -> List[Path]:
    catalogue_folders: List[Path] = []
    if not base_dir.exists():
        return catalogue_folders

    for store_dir in sorted(base_dir.iterdir()):
        if not store_dir.is_dir():
            continue
        for year_dir in sorted(store_dir.iterdir()):
            if not year_dir.is_dir():
                continue
            for catalogue_dir in sorted(year_dir.iterdir()):
                if not catalogue_dir.is_dir():
                    continue
                if (catalogue_dir / ZONE_SUBFOLDER).exists() and (catalogue_dir / ZONE_DETECTIONS_CSV).exists():
                    catalogue_folders.append(catalogue_dir)
                    if limit is not None and len(catalogue_folders) >= limit:
                        return catalogue_folders
    return catalogue_folders


def load_catalogue_metadata(catalogue_dir: Path) -> Dict[str, str]:
    metadata_path = catalogue_dir / "metadata.json"
    if metadata_path.exists():
        try:
            return json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def configure_tesseract(explicit_cmd: Optional[str]) -> Optional[str]:
    if explicit_cmd:
        cmd_path = Path(explicit_cmd).expanduser()
        if cmd_path.exists():
            pytesseract.pytesseract.tesseract_cmd = str(cmd_path)
            return str(cmd_path)
        raise FileNotFoundError(f"Tesseract executable not found: {cmd_path}")

    found = shutil.which("tesseract")
    if found:
        pytesseract.pytesseract.tesseract_cmd = found
    return found


def upscale_if_small(gray: np.ndarray, min_height: int = 60, min_width: int = 80) -> np.ndarray:
    h, w = gray.shape[:2]
    scale = 1.0
    if h < min_height:
        scale = max(scale, min_height / h)
    if w < min_width:
        scale = max(scale, min_width / w)
    if scale > 1.0:
        scale = min(scale, 4.0)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return gray


def add_border(img: np.ndarray, border: int = 15, color: int = 255) -> np.ndarray:
    return cv2.copyMakeBorder(
        img,
        border,
        border,
        border,
        border,
        cv2.BORDER_CONSTANT,
        value=color,
    )


def sharpen(gray: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(gray, (0, 0), 3)
    return cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)


def extract_black_text(crop_bgr: np.ndarray, dark_thresh: int = 80) -> Optional[np.ndarray]:
    if crop_bgr is None or crop_bgr.size == 0:
        return None
    if len(crop_bgr.shape) < 3:
        _, binary = cv2.threshold(crop_bgr, dark_thresh, 255, cv2.THRESH_BINARY_INV)
        return cv2.bitwise_not(binary)

    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    _, s, v = cv2.split(hsv)
    text_mask = (v < 50) | ((v < dark_thresh) & (s < 100))
    result = np.full(v.shape, 255, dtype=np.uint8)
    result[text_mask] = 0
    return result


def extract_black_text_aggressive(crop_bgr: np.ndarray, dark_thresh: int = 100) -> Optional[np.ndarray]:
    if crop_bgr is None or crop_bgr.size == 0:
        return None
    if len(crop_bgr.shape) < 3:
        _, binary = cv2.threshold(crop_bgr, dark_thresh, 255, cv2.THRESH_BINARY_INV)
        return cv2.bitwise_not(binary)

    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    _, s, v = cv2.split(hsv)
    text_mask = (v < 60) | ((v < dark_thresh) & (s < 120))
    result = np.full(v.shape, 255, dtype=np.uint8)
    result[text_mask] = 0
    return result


class OCREngine:
    def __init__(self) -> None:
        paddle_signature = signature(PaddleOCR)
        supported_params = paddle_signature.parameters
        init_kwargs = {"lang": "en"}

        # PaddleOCR renamed angle classification to textline orientation in
        # newer releases; detect the installed version's supported parameter.
        if "use_textline_orientation" in supported_params:
            init_kwargs["use_textline_orientation"] = False
        elif "use_angle_cls" in supported_params:
            init_kwargs["use_angle_cls"] = False

        if "show_log" in supported_params:
            init_kwargs["show_log"] = False

        self.paddle = PaddleOCR(**init_kwargs)

    def paddle_ocr_crop(self, crop_bgr: np.ndarray) -> List[Dict[str, object]]:
        if crop_bgr is None or crop_bgr.size == 0:
            return []
        if len(crop_bgr.shape) == 2:
            crop_bgr = cv2.cvtColor(crop_bgr, cv2.COLOR_GRAY2BGR)

        try:
            result = self.paddle.ocr(crop_bgr, cls=False)
        except Exception:
            return []

        if not result or not result[0]:
            return []

        detections: List[Dict[str, object]] = []
        for line in result[0]:
            bbox = line[0]
            text, conf = line[1]
            detections.append(
                {
                    "text": text.strip(),
                    "conf": conf,
                    "cx": (bbox[0][0] + bbox[2][0]) / 2,
                    "cy": (bbox[0][1] + bbox[2][1]) / 2,
                    "h": abs(bbox[2][1] - bbox[0][1]),
                }
            )
        detections.sort(key=lambda d: (float(d["cy"]), float(d["cx"])))
        return detections


def clean_price_text(raw: str) -> str:
    text = raw.replace("O", "0").replace("o", "0")
    text = text.replace("l", "1").replace("I", "1").replace("|", "1")
    text = text.replace("S", "5").replace("s", "5")
    text = text.replace("B", "8").replace("D", "0")
    text = text.replace(",", ".")
    return re.sub(r"[^\d.cC¢$ eaEA]", "", text)


def score_price(cleaned_text: str) -> Optional[Tuple[str, int]]:
    if not cleaned_text:
        return None

    decimal_match = re.search(r"(\d+)\.(\d{2})", cleaned_text)
    if decimal_match:
        try:
            val = float(decimal_match.group())
            if 0.01 <= val <= 999.99:
                return f"{val:.2f}", int(val * 100)
        except ValueError:
            pass

    digits_only = re.sub(r"\D", "", cleaned_text)
    if not digits_only:
        return None

    num = int(digits_only)
    if len(digits_only) == 3:
        val = num / 100
        if 0.50 <= val <= 99.99:
            return f"{val:.2f}", 1000 + num
    elif len(digits_only) == 4:
        val = num / 100
        if 1.00 <= val <= 999.99:
            return f"{val:.2f}", 900 + num // 10
    elif len(digits_only) == 1 and 1 <= num <= 9:
        return f"{num}.00", 500 + num
    elif len(digits_only) == 2 and 1 <= num <= 99:
        return f"{num}.00", 400 + num
    return None


def score_description(raw_text: str) -> Optional[Tuple[str, int]]:
    if not raw_text or len(raw_text.strip()) < 2:
        return None
    text = re.sub(r"\s+", " ", raw_text.strip())
    alpha_chars = sum(1 for c in text if c.isalpha())
    if alpha_chars < 2:
        return None
    return text, alpha_chars


def parse_promo_save_amount(raw_text: str) -> Optional[float]:
    if not raw_text:
        return None

    text = raw_text.upper().strip().replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    text = text.replace("O", "0").replace("o", "0").replace("l", "1").replace("I", "1")

    save_dec = re.search(r"SAVE\s*\$?\s*(\d+\.\d{2})", text)
    if save_dec:
        try:
            return float(save_dec.group(1))
        except ValueError:
            pass

    save_whole = re.search(r"SAVE\s*\$?\s*(\d+)", text)
    if save_whole:
        try:
            return float(save_whole.group(1))
        except ValueError:
            pass

    off_match = re.search(r"\$?\s*(\d+\.?\d*)\s*OFF", text)
    if off_match:
        try:
            return float(off_match.group(1))
        except ValueError:
            pass

    cent_match = re.search(r"SAVE\s*(\d+)\s*[cC¢]", text)
    if cent_match:
        try:
            return int(cent_match.group(1)) / 100.0
        except ValueError:
            pass

    all_numbers = re.findall(r"\d+\.?\d*", text)
    if len(all_numbers) >= 2:
        try:
            return min(float(n) for n in all_numbers)
        except ValueError:
            pass
    elif len(all_numbers) == 1:
        try:
            return float(all_numbers[0])
        except ValueError:
            pass
    return None


def generate_binary_candidates(gray: np.ndarray) -> List[Tuple[str, np.ndarray]]:
    candidates: List[Tuple[str, np.ndarray]] = []
    black_text = extract_black_text(gray if len(gray.shape) == 3 else cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))
    if black_text is not None:
        candidates.append(("black_text", black_text))
        candidates.append(("black_text_inv", cv2.bitwise_not(black_text)))

    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    candidates.append(("otsu", otsu))
    candidates.append(("otsu_inv", cv2.bitwise_not(otsu)))

    adaptive = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        10,
    )
    candidates.append(("adaptive", adaptive))
    candidates.append(("adaptive_inv", cv2.bitwise_not(adaptive)))
    return candidates


def paddle_extract_price(ocr_engine: OCREngine, crop_bgr: np.ndarray) -> Tuple[Optional[str], int, str]:
    best_price, best_score, best_method = None, 0, "none"
    variants = [
        ("paddle_raw", crop_bgr),
        ("paddle_black", extract_black_text(crop_bgr)),
        ("paddle_black_agg", extract_black_text_aggressive(crop_bgr)),
    ]

    for label, img in variants:
        if img is None:
            continue

        detections = ocr_engine.paddle_ocr_crop(img)
        if not detections:
            continue

        all_text = " ".join(str(d["text"]) for d in detections)
        cleaned = all_text.replace("$", "").replace(",", ".")
        cleaned = re.sub(r"[a-zA-Z]+", " ", cleaned).strip()

        decimal_match = re.search(r"(\d+)\.(\d{2})", cleaned)
        if decimal_match:
            try:
                val = float(decimal_match.group())
                if 0.01 <= val <= 999.99:
                    score = int(val * 100) + 5000
                    if score > best_score:
                        best_price, best_score, best_method = f"{val:.2f}", score, label
            except ValueError:
                pass

        if len(detections) >= 2 and not best_price:
            heights = [float(d["h"]) for d in detections if float(d["h"]) > 0]
            if heights:
                max_h = max(heights)
                big = [d for d in detections if float(d["h"]) > max_h * 0.5]
                small_top = [d for d in detections if float(d["h"]) <= max_h * 0.5]
                if big and small_top:
                    dollar_text = " ".join(str(d["text"]) for d in sorted(big, key=lambda d: float(d["cx"])))
                    dollar_text = re.sub(r"[^0-9]", "", dollar_text)
                    big_right = max(float(d["cx"]) for d in big)
                    cents_candidates = [d for d in small_top if float(d["cx"]) >= big_right - 10]
                    cents_candidates.sort(key=lambda d: float(d["cx"]))
                    cents_text = "".join(re.sub(r"[^0-9]", "", str(d["text"])) for d in cents_candidates)
                    if dollar_text and len(cents_text) >= 2:
                        try:
                            val = float(f"{int(dollar_text)}.{cents_text[:2]}")
                            if 0.01 <= val <= 999.99:
                                score = int(val * 100) + 4500
                                if score > best_score:
                                    best_price = f"{val:.2f}"
                                    best_score = score
                                    best_method = f"{label}_spatial"
                        except ValueError:
                            pass

        if not best_price:
            digits_only = re.sub(r"\D", "", cleaned)
            if digits_only:
                num = int(digits_only)
                if len(digits_only) in {3, 4}:
                    val = num / 100
                    if 0.01 <= val <= 999.99:
                        score = int(val * 100) + 3500
                        if score > best_score:
                            best_price, best_score, best_method = f"{val:.2f}", score, label

    return best_price, best_score, best_method


def zoned_price_parse(crop_bgr: np.ndarray) -> Tuple[Optional[str], int]:
    if crop_bgr is None or crop_bgr.size == 0:
        return None, 0

    if len(crop_bgr.shape) == 3:
        gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop_bgr.copy()

    gray = upscale_if_small(gray, min_height=120, min_width=160)
    gray = sharpen(gray)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    num_labels, _, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num_labels < 2:
        return None, 0

    h_img, w_img = binary.shape
    blobs = []
    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        cx, cy = centroids[i]
        if area < 50:
            continue
        if w > w_img * 0.9 and h > h_img * 0.9:
            continue
        if area < (h_img * w_img * 0.005):
            continue
        blobs.append({"x": x, "y": y, "w": w, "h": h, "area": area, "cx": cx, "cy": cy})

    if not blobs:
        return None, 0

    max_height = max(b["h"] for b in blobs)
    big_threshold = max_height * 0.55
    for blob in blobs:
        blob["is_big"] = blob["h"] >= big_threshold

    big_blobs = sorted([b for b in blobs if b["is_big"]], key=lambda b: b["cx"])
    small_blobs = [b for b in blobs if not b["is_big"]]
    if not big_blobs:
        return None, 0

    if len(big_blobs) > 1:
        first, second = big_blobs[0], big_blobs[1]
        if first["w"] < second["w"] * 0.7 and first["cx"] < second["cx"]:
            big_blobs = big_blobs[1:]

    dollar_digits = []
    for blob in big_blobs:
        pad = 5
        bx1 = max(0, blob["x"] - pad)
        by1 = max(0, blob["y"] - pad)
        bx2 = min(w_img, blob["x"] + blob["w"] + pad)
        by2 = min(h_img, blob["y"] + blob["h"] + pad)
        blob_crop = cv2.bitwise_not(binary[by1:by2, bx1:bx2])
        blob_bordered = add_border(blob_crop, border=10, color=255)
        try:
            digit_text = pytesseract.image_to_string(
                blob_bordered,
                config="--psm 10 -c tessedit_char_whitelist=0123456789$",
            ).strip()
        except Exception:
            digit_text = ""
        digit_text = digit_text.replace("$", "").replace(" ", "")
        digit_text = digit_text.replace("O", "0").replace("o", "0")
        digit_text = digit_text.replace("l", "1").replace("I", "1")
        if digit_text and digit_text[0].isdigit():
            dollar_digits.append(digit_text[0])

    if not dollar_digits:
        return None, 0

    dollar_str = "".join(dollar_digits)
    last_big_right = max(b["x"] + b["w"] for b in big_blobs)
    big_vert_center = np.mean([b["cy"] for b in big_blobs])

    cents_digits = []
    cents_blobs = []
    for blob in small_blobs:
        if blob["cx"] < last_big_right - (max_height * 0.3):
            continue
        if blob["cy"] > big_vert_center + max_height * 0.1:
            continue
        if blob["area"] < max_height * 2:
            continue
        cents_blobs.append(blob)

    cents_blobs.sort(key=lambda b: b["cx"])
    for blob in cents_blobs:
        pad = 5
        bx1 = max(0, blob["x"] - pad)
        by1 = max(0, blob["y"] - pad)
        bx2 = min(w_img, blob["x"] + blob["w"] + pad)
        by2 = min(h_img, blob["y"] + blob["h"] + pad)
        blob_crop = cv2.bitwise_not(binary[by1:by2, bx1:bx2])
        blob_bordered = add_border(blob_crop, border=10, color=255)
        try:
            digit_text = pytesseract.image_to_string(
                blob_bordered,
                config="--psm 10 -c tessedit_char_whitelist=0123456789",
            ).strip()
        except Exception:
            digit_text = ""
        digit_text = digit_text.replace("O", "0").replace("o", "0")
        digit_text = digit_text.replace("l", "1").replace("I", "1")
        if digit_text and digit_text[0].isdigit():
            cents_digits.append(digit_text[0])

    cents_str = "".join(cents_digits[:2]) if len(cents_digits) >= 2 else "00"
    if len(cents_digits) == 1:
        cents_str = cents_digits[0] + "0"

    price_str = f"{dollar_str}.{cents_str}"
    try:
        val = float(price_str)
        if 0.01 <= val <= 999.99:
            return price_str, int(val * 100) + 3000
    except ValueError:
        pass
    return None, 0


def zoned_price_parse_multi(crop_bgr: np.ndarray) -> Tuple[Optional[str], int, str]:
    best_price, best_score, best_method = None, 0, "none"
    for label, img in [
        ("zoned_raw", crop_bgr),
        ("zoned_black", extract_black_text(crop_bgr)),
        ("zoned_black_agg", extract_black_text_aggressive(crop_bgr)),
    ]:
        if img is None:
            continue
        price, score = zoned_price_parse(img)
        if score > best_score:
            best_price, best_score, best_method = price, score, label
    return best_price, best_score, best_method


def perform_field_ocr(
    crop_img: np.ndarray,
    class_name: str,
    ocr_engine: OCREngine,
    attempts_log: List[Dict[str, object]],
    row_context: Dict[str, object],
) -> Tuple[str, str]:
    field_name = CLASS_TO_FIELD.get(class_name, "")
    if not field_name:
        return "", "skipped"

    if class_name == "price_main":
        best_text, best_score, best_method = "", 0, "none"

        paddle_text, paddle_score, paddle_method = paddle_extract_price(ocr_engine, crop_img)
        attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": paddle_method, "Result": paddle_text or "", "Score": paddle_score})
        if paddle_text and paddle_score > best_score:
            best_text, best_score, best_method = paddle_text, paddle_score, paddle_method

        zoned_text, zoned_score, zoned_method = zoned_price_parse_multi(crop_img)
        attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": zoned_method, "Result": zoned_text or "", "Score": zoned_score})
        if zoned_text and zoned_score > best_score:
            best_text, best_score, best_method = zoned_text, zoned_score, zoned_method

        gray = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY) if len(crop_img.shape) == 3 else crop_img.copy()
        gray = upscale_if_small(gray, min_height=60, min_width=80)
        gray = sharpen(gray)
        gray = cv2.fastNlMeansDenoising(gray, h=8)
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        bordered = add_border(cv2.bitwise_not(otsu))
        try:
            raw = pytesseract.image_to_string(
                bordered,
                config="--psm 7 -c tessedit_char_whitelist=0123456789.$cC",
            ).strip()
        except Exception:
            raw = ""
        tess_score = 0
        tess_text = ""
        scored = score_price(clean_price_text(raw)) if raw else None
        if scored:
            tess_text, tess_score = scored
        attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": "tess_fallback", "Result": tess_text, "Score": tess_score})
        if tess_text and tess_score > best_score:
            best_text, best_score, best_method = tess_text, tess_score, "tess_fallback"

        return best_text, best_method

    if len(crop_img.shape) == 3:
        gray = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop_img.copy()
    gray = upscale_if_small(gray, min_height=60, min_width=80)
    gray = cv2.fastNlMeansDenoising(gray, h=8)

    best_text, best_score, best_method = "", -1, "none"

    if class_name == "description_block":
        paddle_text = " ".join(str(d["text"]) for d in ocr_engine.paddle_ocr_crop(crop_img)).strip()
        paddle_score = score_description(paddle_text)[1] + 5000 if score_description(paddle_text) else 0
        attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": "paddle_raw", "Result": paddle_text, "Score": paddle_score})
        if paddle_score > best_score:
            best_text, best_score, best_method = paddle_text, paddle_score, "paddle_raw"
        configs = DESC_CONFIGS
    elif class_name == "promo_text_block":
        paddle_text = " ".join(str(d["text"]) for d in ocr_engine.paddle_ocr_crop(crop_img)).strip()
        save_amt = parse_promo_save_amount(paddle_text)
        paddle_result = f"{save_amt:.2f}" if save_amt is not None else paddle_text
        paddle_score = 5000 + int(save_amt * 100) if save_amt is not None else len(paddle_text)
        attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": "paddle_raw", "Result": paddle_result, "Score": paddle_score})
        if paddle_score > best_score:
            best_text, best_score, best_method = paddle_result, paddle_score, "paddle_raw"
        configs = PROMO_CONFIGS
    else:
        paddle_text = " ".join(str(d["text"]) for d in ocr_engine.paddle_ocr_crop(crop_img)).strip()
        paddle_score = len(paddle_text) + 5000 if paddle_text else 0
        attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": "paddle_raw", "Result": paddle_text, "Score": paddle_score})
        if paddle_score > best_score:
            best_text, best_score, best_method = paddle_text, paddle_score, "paddle_raw"
        configs = UNIT_CONFIGS

    for method_name, config_str in configs:
        for binary_name, binary_img in generate_binary_candidates(gray):
            bordered = add_border(binary_img)
            try:
                raw = pytesseract.image_to_string(bordered, config=config_str).strip()
            except Exception:
                raw = ""
            attempt_text = raw
            attempt_score = 0

            if class_name == "description_block":
                scored = score_description(raw)
                if scored:
                    attempt_text, attempt_score = scored
            elif class_name == "promo_text_block":
                save_amt = parse_promo_save_amount(raw)
                if save_amt is not None:
                    attempt_text = f"{save_amt:.2f}"
                    attempt_score = 1000 + int(save_amt * 100)
                else:
                    attempt_score = len(raw)
            else:
                cleaned = re.sub(r"[^\d.$/ a-zA-Z]", "", raw).strip()
                attempt_text = cleaned
                attempt_score = len(cleaned)

            full_method = f"{binary_name}+{method_name}"
            attempts_log.append({**row_context, "Field": field_name, "Class": class_name, "Method": full_method, "Result": attempt_text, "Score": attempt_score})
            if attempt_score > best_score:
                best_text, best_score, best_method = attempt_text, attempt_score, full_method

    if class_name == "description_block" and best_text:
        best_text = re.sub(r"\s+", " ", best_text).strip()
        best_text = re.sub(r"^[^a-zA-Z0-9]+", "", best_text)
        best_text = re.sub(r"[^a-zA-Z0-9.!]+$", "", best_text)

    return best_text, best_method


def extract_numeric_price(text: str) -> Optional[float]:
    if not text:
        return None
    text = text.strip().replace("$", "").replace(",", "")
    match = re.search(r"\d+\.?\d*", text)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def build_quality_flag(name: str, price_now: str) -> str:
    flags: List[str] = []
    if not name:
        flags.append("missing_name")
    if not price_now:
        flags.append("missing_price")

    numeric_price = extract_numeric_price(price_now or "")
    if price_now and numeric_price is None:
        flags.append("price_not_numeric")
    elif numeric_price is not None and not (0.01 <= numeric_price <= 999.99):
        flags.append("price_implausible")
    return ";".join(flags)


def _upsert_master_csv(master_path: Path, new_df: pd.DataFrame, key_col: str) -> None:
    """Write new_df into master_path, replacing any existing rows for the same catalogue."""
    if new_df.empty:
        return
    ensure_dir(master_path.parent)
    if master_path.exists():
        try:
            existing = pd.read_csv(master_path)
            catalogue_name = new_df[key_col].iloc[0]
            existing = existing[existing[key_col] != catalogue_name]
            combined = pd.concat([existing, new_df], ignore_index=True)
        except Exception:
            combined = new_df
    else:
        combined = new_df
    combined.to_csv(master_path, index=False, encoding="utf-8-sig")


def append_master_outputs(script_dir: Path, results_df: pd.DataFrame, attempts_df: pd.DataFrame) -> None:
    _upsert_master_csv(script_dir / MASTER_RESULTS_CSV, results_df, key_col="Catalogue")
    _upsert_master_csv(script_dir / MASTER_ATTEMPTS_CSV, attempts_df, key_col="Catalogue")


def process_catalogue_folder(
    logger: logging.Logger,
    catalogue_dir: Path,
    base_dir: Path,
    ocr_engine: OCREngine,
    limit_tiles: Optional[int],
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    metadata = load_catalogue_metadata(catalogue_dir)
    zone_csv_path = catalogue_dir / ZONE_DETECTIONS_CSV
    try:
        zone_df = pd.read_csv(zone_csv_path)
    except EmptyDataError:
        logger.warning("Zone detections CSV is empty: %s", zone_csv_path)
        return (
            pd.DataFrame(columns=OCR_RESULT_COLUMNS),
            pd.DataFrame(columns=OCR_ATTEMPT_COLUMNS),
        )

    if zone_df.empty:
        return (
            pd.DataFrame(columns=OCR_RESULT_COLUMNS),
            pd.DataFrame(columns=OCR_ATTEMPT_COLUMNS),
        )

    if limit_tiles is not None:
        tile_names = list(dict.fromkeys(zone_df["tile_name"].tolist()))[:limit_tiles]
        zone_df = zone_df[zone_df["tile_name"].isin(tile_names)]

    attempts_log: List[Dict[str, object]] = []
    result_rows: List[Dict[str, object]] = []
    retailer = metadata.get("store") or extract_retailer(catalogue_dir.name)

    for tile_name, tile_group in zone_df.groupby("tile_name"):
        tile_group = tile_group.sort_values("confidence", ascending=False)
        fields: Dict[str, str] = {}
        methods: Dict[str, str] = {}

        first_row = tile_group.iloc[0]
        for class_name, class_group in tile_group.groupby("class_name"):
            best_row = class_group.sort_values("confidence", ascending=False).iloc[0]
            zone_image_path = catalogue_dir / str(best_row["zone_image_path"])
            crop_img = cv2.imread(str(zone_image_path))
            if crop_img is None:
                continue

            row_context = {
                "Retailer": retailer,
                "Catalogue": catalogue_dir.name,
                "Tile": tile_name,
                "Page_Name": str(best_row.get("page_name", "")),
            }
            text, method = perform_field_ocr(crop_img, str(class_name), ocr_engine, attempts_log, row_context)
            field_name = CLASS_TO_FIELD.get(str(class_name))
            if field_name:
                fields[field_name] = text
                methods[field_name] = method

        price_was = ""
        pn = extract_numeric_price(fields.get("Price_Now", ""))
        sa = extract_numeric_price(fields.get("Save_amount", ""))
        if pn is not None and sa is not None:
            price_was = f"{pn + sa:.2f}"

        result_rows.append(
            {
                "Retailer": retailer,
                "Store": metadata.get("store", ""),
                "Catalogue": catalogue_dir.name,
                "Catalogue_Title": metadata.get("title", ""),
                "Catalogue_On_Sale_Date": metadata.get("catalogue_on_sale_date", ""),
                "State": metadata.get("state", ""),
                "Year": metadata.get("year", ""),
                "Tile": tile_name,
                "Source_Image": str(first_row.get("source_image", "")),
                "Page_Name": str(first_row.get("page_name", "")),
                "Tile_Image_Path": safe_relative(catalogue_dir / str(first_row.get("tile_image_path", "")), base_dir),
                "Tile_Confidence": str(first_row.get("tile_confidence", "")),
                "Name": fields.get("Name", ""),
                "Price_Now": fields.get("Price_Now", ""),
                "Save_amount": fields.get("Save_amount", ""),
                "PriceWas": price_was,
                "UnitPrice": fields.get("UnitPrice", ""),
                "OCR_Method_Name": methods.get("Name", ""),
                "OCR_Method_Price": methods.get("Price_Now", ""),
                "OCR_Method_Save": methods.get("Save_amount", ""),
                "OCR_Method_UnitPrice": methods.get("UnitPrice", ""),
                "Num_Zone_Boxes": len(tile_group),
                "Quality_Flag": build_quality_flag(fields.get("Name", ""), fields.get("Price_Now", "")),
                "Processed_Timestamp": datetime.now().isoformat(),
            }
        )

    return (
        pd.DataFrame(result_rows, columns=OCR_RESULT_COLUMNS),
        pd.DataFrame(attempts_log, columns=OCR_ATTEMPT_COLUMNS),
    )


def run_stage(
    catalogues_dir: Path,
    limit_catalogues: Optional[int] = None,
    limit_tiles: Optional[int] = None,
    tesseract_cmd: Optional[str] = None,
    rebuild_master: bool = False,
    catalogue_dirs: Optional[Sequence[Path]] = None,
    on_catalogue_complete: Optional[Callable[[CatalogueStageOutcome], None]] = None,
) -> StageResult:
    script_dir = Path(__file__).resolve().parent
    logger, log_file = setup_logging(script_dir)
    result = make_stage_result("stage_4_ocr", log_file=log_file)

    logger.info("=" * 70)
    logger.info("CATALOGUE PADDLEOCR PIPELINE - SESSION START")
    logger.info("=" * 70)

    if not catalogues_dir.exists():
        raise FileNotFoundError(f"Catalogue directory not found: {catalogues_dir}")

    tesseract_path = configure_tesseract(tesseract_cmd)
    logger.info("Tesseract executable: %s", tesseract_path or "not found on PATH")

    if rebuild_master:
        for master_path in [script_dir / MASTER_RESULTS_CSV, script_dir / MASTER_ATTEMPTS_CSV]:
            if master_path.exists():
                master_path.unlink()

    selected_catalogues = list(catalogue_dirs) if catalogue_dirs is not None else find_catalogue_folders(
        catalogues_dir,
        limit=limit_catalogues,
    )
    if limit_catalogues is not None and catalogue_dirs is not None:
        selected_catalogues = selected_catalogues[:limit_catalogues]

    ocr_engine = OCREngine()

    for catalogue_dir in selected_catalogues:
        catalogue_id = "/".join(catalogue_dir.relative_to(catalogues_dir).parts)
        start = perf_counter()
        try:
            logger.info("Processing catalogue folder: %s", catalogue_dir)
            results_df, attempts_df = process_catalogue_folder(
                logger=logger,
                catalogue_dir=catalogue_dir,
                base_dir=catalogues_dir,
                ocr_engine=ocr_engine,
                limit_tiles=limit_tiles,
            )

            results_path = catalogue_dir / OCR_RESULTS_CSV
            attempts_path = catalogue_dir / OCR_ATTEMPTS_CSV
            results_df.to_csv(results_path, index=False, encoding="utf-8-sig")
            attempts_df.to_csv(attempts_path, index=False, encoding="utf-8-sig")
            append_master_outputs(script_dir, results_df, attempts_df)

            if not results_path.exists():
                raise RuntimeError(f"Expected output missing: {results_path}")

            outcome = CatalogueStageOutcome(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                status="success",
                rows_produced=len(results_df),
                files_produced=len(results_df) + len(attempts_df) + (1 if results_path.exists() else 0) + (1 if attempts_path.exists() else 0),
                elapsed_seconds=perf_counter() - start,
                local_path=str(catalogue_dir),
                details={
                    "ocr_results_csv": str(results_path),
                    "ocr_attempts_csv": str(attempts_path),
                },
            )
        except Exception as exc:
            failure = FailureDetail(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                error_type=type(exc).__name__,
                message=str(exc),
                traceback_summary=traceback.format_exc(limit=10),
                local_path=str(catalogue_dir),
            )
            outcome = CatalogueStageOutcome(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                status="failed",
                elapsed_seconds=perf_counter() - start,
                local_path=str(catalogue_dir),
                failure=failure,
            )
            logger.error("Catalogue failed: %s | %s", catalogue_id, exc)

        result.add_catalogue_result(outcome)
        if on_catalogue_complete is not None:
            on_catalogue_complete(outcome)

    logger.info(
        "PADDLEOCR PIPELINE COMPLETE - attempted=%d succeeded=%d failed=%d rows=%d files=%d",
        len(result.attempted_catalogues),
        len(result.succeeded_catalogues),
        len(result.failed_catalogues),
        result.rows_produced,
        result.files_produced,
    )
    logger.info("=" * 70)
    logger.info("SESSION END")
    logger.info("=" * 70)
    return finish_stage_result(result)


def main() -> None:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    base_dir = script_dir / args.catalogues_dir

    if not base_dir.exists():
        raise FileNotFoundError(f"Catalogue directory not found: {base_dir}")

    print("\n" + "=" * 70)
    print("CATALOGUE PADDLEOCR PIPELINE")
    print("=" * 70)
    print(f"  Catalogues: {base_dir}")

    stage_result = run_stage(
        catalogues_dir=base_dir,
        limit_catalogues=args.limit_catalogues,
        limit_tiles=args.limit_tiles,
        tesseract_cmd=args.tesseract_cmd,
        rebuild_master=args.rebuild_master,
    )
    if not stage_result.attempted_catalogues:
        print("[INFO] No catalogue folders with exported zones found.")
        return

    print("\n" + "=" * 70)
    print("PADDLEOCR PIPELINE COMPLETE")
    print("=" * 70)
    print(f"[DONE] Catalogues attempted: {len(stage_result.attempted_catalogues)}")
    print(f"[DONE] Successful catalogues: {len(stage_result.succeeded_catalogues)}")
    print(f"[DONE] Failed catalogues: {len(stage_result.failed_catalogues)}")
    print(f"[DONE] OCR result rows: {stage_result.rows_produced}")
    print(f"[DONE] Master results CSV: {script_dir / MASTER_RESULTS_CSV}")
    print(f"[DONE] Master attempts CSV: {script_dir / MASTER_ATTEMPTS_CSV}")


if __name__ == "__main__":
    main()
