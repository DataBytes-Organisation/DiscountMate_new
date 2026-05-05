"""
Catalogue OCR Production Pipeline
==================================
Reads catalogue_tracking.csv, processes unprocessed catalogues through:
  1. Model 1 (YOLO) → detect product tiles on each page
  2. Model 2 (YOLO) → detect sub-regions within each tile
  3. OCR → PaddleOCR only (no Tesseract)

Outputs:
  - Catalogue_OCR_Database.csv  (one row per product tile)
  - Updates catalogue_tracking.csv with ocr_processed = Y

Memory-safe: images are loaded/released per-page, no caching.
Resumable: skips catalogues already marked ocr_processed=Y.
"""

import os
import re
import gc
import sys
import cv2
import time
import logging
import numpy as np
import pandas as pd
import torch
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Tuple

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(os.path.dirname(os.path.abspath(__file__)))

CATALOGUE_DATA_DIR = SCRIPT_DIR / "catalogue_data"
CATALOGUES_IMAGE_DIR = SCRIPT_DIR / "catalogues"
WEIGHTS_DIR = SCRIPT_DIR / "weights_yolo"

TRACKING_CSV = CATALOGUE_DATA_DIR / "catalogue_tracking.csv"
OCR_OUTPUT_CSV = CATALOGUE_DATA_DIR / "Catalogue_OCR_Database.csv"

OUTPUT_COLUMNS = [
    'store', 'Retailer', 'title', 'slug', 'year', 'state',
    'catalogue_on_sale_date', 'scraped_date', 'page_count', 'catalogue_id',
    'page_number', 'tile_number', 'tile_confidence', 'tiles_on_page',
    'Name', 'Price_Now', 'Price_Raw', 'Price_Spatial', 'Price_Black',
    'Save_amount', 'PriceWas', 'UnitPrice', 'ocr_processed_date',
]

MODEL_1_WEIGHTS = WEIGHTS_DIR / "YOLO_Model_1_Full_Crop.pt"
MODEL_2_WEIGHTS = WEIGHTS_DIR / "YOLO_Model_2_sub_crop.pt"

MODEL_1_IMG_SIZE = 1280
MODEL_2_IMG_SIZE = 640
CONF_THRESHOLD = 0.25
IOU_THRESHOLD_M1 = 0.45
IOU_THRESHOLD_M2 = 0.7

GC_EVERY_N_PAGES = 2

# Auto-detect GPU for YOLO (PaddleOCR stays on CPU)
YOLO_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

CLASS_MAPPING = {
    'description_block': 'Name',
    'price_main': 'Price_Now',
    'promo_text_block': 'Save_amount',
    'unit_price_block': 'UnitPrice',
    'product_image_block': 'ProductImage',
}

KNOWN_RETAILERS = [
    'iga', 'woolworths', 'coles', 'aldi', 'metcash', 'foodland',
    'drakes', 'costco', 'spar', 'bi-lo', 'bilo', 'friendly grocer',
    'foodworks', 'ritchies', 'supabarn', 'harris farm'
]


# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
def setup_logging() -> logging.Logger:
    log_dir = CATALOGUE_DATA_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = log_dir / f'ocr_pipeline_log_{timestamp}.txt'
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout),
        ]
    )
    return logging.getLogger(__name__)


try:
    logger = setup_logging()
except Exception as e:
    print(f"LOGGING SETUP FAILED: {e}", flush=True)
    logger = logging.getLogger(__name__)
    logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# LAZY MODEL LOADING
# ---------------------------------------------------------------------------
_model1 = None
_model2 = None
_paddle_ocr = None


def get_model1():
    global _model1
    if _model1 is None:
        from ultralytics import YOLO
        logger.info(f"Loading Model 1 from {MODEL_1_WEIGHTS} (device: {YOLO_DEVICE})")
        _model1 = YOLO(str(MODEL_1_WEIGHTS))
        _model1.to(YOLO_DEVICE)
        logger.info("Model 1 loaded")
    return _model1


def get_model2():
    global _model2
    if _model2 is None:
        from ultralytics import YOLO
        logger.info(f"Loading Model 2 from {MODEL_2_WEIGHTS} (device: {YOLO_DEVICE})")
        _model2 = YOLO(str(MODEL_2_WEIGHTS))
        _model2.to(YOLO_DEVICE)
        logger.info("Model 2 loaded")
    return _model2


def get_paddle_ocr():
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR
        logger.info("Loading PaddleOCR...")
        _paddle_ocr = PaddleOCR(use_angle_cls=False, lang='en', show_log=False)
        logger.info("PaddleOCR loaded")
    return _paddle_ocr


# ---------------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------------
def extract_retailer(catalogue_name: str) -> str:
    name_lower = catalogue_name.lower().replace('_', ' ').replace('-', ' ')
    for retailer in KNOWN_RETAILERS:
        if retailer in name_lower:
            return retailer.title()
    return "Unknown"


def extract_page_number(filename: str) -> int:
    match = re.search(r'page[_\s]*(\d+)', filename.lower())
    return int(match.group(1)) if match else 0


def _extract_black_text(crop_bgr: np.ndarray, dark_thresh: int = 80) -> Optional[np.ndarray]:
    if crop_bgr is None or crop_bgr.size == 0:
        return None
    if len(crop_bgr.shape) < 3:
        _, binary = cv2.threshold(crop_bgr, dark_thresh, 255, cv2.THRESH_BINARY_INV)
        return cv2.bitwise_not(binary)
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    text_mask = (v < 50) | ((v < dark_thresh) & (s < 100))
    result = np.full(v.shape, 255, dtype=np.uint8)
    result[text_mask] = 0
    return result


def extract_numeric_price(text: str) -> Optional[float]:
    if not text:
        return None
    text = text.strip().replace('$', '').replace(',', '')
    match = re.search(r'\d+\.?\d*', text)
    if match:
        try:
            return float(match.group())
        except Exception:
            return None
    return None


# ---------------------------------------------------------------------------
# PADDLEOCR WRAPPER — single call
# ---------------------------------------------------------------------------
def _paddle_ocr_crop(crop_bgr: np.ndarray) -> list:
    if crop_bgr is None or crop_bgr.size == 0:
        return []
    if len(crop_bgr.shape) == 2:
        crop_bgr = cv2.cvtColor(crop_bgr, cv2.COLOR_GRAY2BGR)
    try:
        result = get_paddle_ocr().ocr(crop_bgr, cls=False)
    except Exception:
        return []
    if not result or not result[0]:
        return []
    detections = []
    for line in result[0]:
        bbox = line[0]
        text, conf = line[1]
        y_center = (bbox[0][1] + bbox[2][1]) / 2
        x_center = (bbox[0][0] + bbox[2][0]) / 2
        box_h = abs(bbox[2][1] - bbox[0][1])
        detections.append({
            'text': text.strip(), 'conf': conf, 'bbox': bbox,
            'cx': x_center, 'cy': y_center, 'h': box_h,
        })
    detections.sort(key=lambda d: (d['cy'], d['cx']))
    return detections


# ---------------------------------------------------------------------------
# PRICE EXTRACTION — one image variant → returns (raw_price, spatial_price)
# ---------------------------------------------------------------------------
def _extract_price_from_detections(detections: list) -> Tuple[Optional[str], Optional[str]]:
    """
    Given PaddleOCR detections, extract:
      raw_price    = regex-based price from concatenated text
      spatial_price = big-dollar + small-cents spatial layout
    Returns (raw_price, spatial_price)
    """
    if not detections:
        return None, None

    all_text = ' '.join(d['text'] for d in detections)
    raw_price = None
    spatial_price = None

    # --- RAW: decimal match ---
    cleaned = all_text.replace('$', '').replace(',', '.')
    cleaned = re.sub(r'[a-zA-Z]+', ' ', cleaned).strip()
    decimal_match = re.search(r'(\d+)\.(\d{2})', cleaned)
    if decimal_match:
        try:
            val = float(decimal_match.group())
            if 0.01 <= val <= 999.99:
                raw_price = f"{val:.2f}"
        except ValueError:
            pass

    # RAW fallback: space-separated "2 75"
    if not raw_price:
        space_match = re.search(r'(\d{1,3})\s+(\d{2})\b', all_text.replace('$', ''))
        if space_match:
            try:
                val = float(f"{space_match.group(1)}.{space_match.group(2)}")
                if 0.01 <= val <= 999.99:
                    raw_price = f"{val:.2f}"
            except ValueError:
                pass

    # RAW fallback: pure digits "275" -> "2.75"
    if not raw_price:
        digits_only = re.sub(r'\D', '', cleaned)
        if digits_only:
            num = int(digits_only)
            if len(digits_only) == 3 and 50 <= num <= 9999:
                raw_price = f"{num / 100:.2f}"
            elif len(digits_only) == 4 and 100 <= num <= 99999:
                raw_price = f"{num / 100:.2f}"
            elif len(digits_only) in [1, 2] and 1 <= num <= 99:
                raw_price = f"{num}.00"

    # --- SPATIAL: big dollar + small cents superscript ---
    if len(detections) >= 2:
        heights = [d['h'] for d in detections if d['h'] > 0]
        if heights:
            max_h = max(heights)
            big = [d for d in detections if d['h'] > max_h * 0.5]
            small_top = [d for d in detections if d['h'] <= max_h * 0.5]

            if big and small_top:
                dollar_text = ' '.join(d['text'] for d in sorted(big, key=lambda d: d['cx']))
                dollar_text = re.sub(r'[^0-9]', '', dollar_text)
                big_right = max(d['cx'] for d in big)
                cents_candidates = [d for d in small_top if d['cx'] >= big_right - 10]
                cents_candidates.sort(key=lambda d: d['cx'])
                cents_text = ''.join(re.sub(r'[^0-9]', '', d['text']) for d in cents_candidates)

                if dollar_text and len(cents_text) >= 2:
                    try:
                        val = float(f"{int(dollar_text)}.{cents_text[:2]}")
                        if 0.01 <= val <= 999.99:
                            spatial_price = f"{val:.2f}"
                    except ValueError:
                        pass

    return raw_price, spatial_price


def _paddle_extract_price(crop_bgr: np.ndarray) -> Dict:
    """
    Run PaddleOCR on raw image and black-text image.
    Returns dict with Price_Raw, Price_Spatial, Price_Black, Price_Now.
    Only 2 PaddleOCR calls total.
    """
    result = {
        'Price_Raw': '', 'Price_Spatial': '', 'Price_Black': '', 'Price_Now': ''
    }

    # --- Call 1: raw image ---
    detections_raw = _paddle_ocr_crop(crop_bgr)
    raw_price, spatial_price = _extract_price_from_detections(detections_raw)
    result['Price_Raw'] = raw_price or ''
    result['Price_Spatial'] = spatial_price or ''

    # --- Call 2: black text extracted image ---
    black_img = _extract_black_text(crop_bgr)
    if black_img is not None:
        detections_black = _paddle_ocr_crop(black_img)
        black_price, _ = _extract_price_from_detections(detections_black)
        result['Price_Black'] = black_price or ''

    # --- Best price: prefer raw > spatial > black ---
    result['Price_Now'] = raw_price or spatial_price or result['Price_Black'] or ''

    return result


# ---------------------------------------------------------------------------
# TEXT / PROMO / UNIT — single PaddleOCR call each (raw only)
# ---------------------------------------------------------------------------
def _paddle_extract_text(crop_bgr: np.ndarray) -> str:
    detections = _paddle_ocr_crop(crop_bgr)
    if not detections:
        return ""
    text = ' '.join(d['text'] for d in detections)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'^[^a-zA-Z0-9]+', '', text)
    text = re.sub(r'[^a-zA-Z0-9.!]+$', '', text)
    return text


def _parse_promo_save_amount(raw_text: str) -> Optional[float]:
    if not raw_text:
        return None
    text = raw_text.upper().strip().replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text)

    save_dec = re.search(r'SAVE\s*\$?\s*(\d+\.\d{2})', text)
    if save_dec:
        try:
            return float(save_dec.group(1))
        except ValueError:
            pass

    save_whole = re.search(r'SAVE\s*\$?\s*(\d+)', text)
    if save_whole:
        try:
            return float(save_whole.group(1))
        except ValueError:
            pass

    off_match = re.search(r'\$?\s*(\d+\.?\d*)\s*OFF', text)
    if off_match:
        try:
            return float(off_match.group(1))
        except ValueError:
            pass

    dollar_amounts = re.findall(r'\$\s*(\d+\.?\d*)', text)
    if dollar_amounts:
        try:
            return min(float(n) for n in dollar_amounts)
        except ValueError:
            pass

    all_numbers = re.findall(r'\d+\.?\d*', text)
    if all_numbers:
        try:
            return min(float(n) for n in all_numbers)
        except ValueError:
            pass

    return None


def _paddle_extract_promo(crop_bgr: np.ndarray) -> str:
    detections = _paddle_ocr_crop(crop_bgr)
    if not detections:
        return ""
    all_text = ' '.join(d['text'] for d in detections)
    save_amt = _parse_promo_save_amount(all_text)
    if save_amt is not None and save_amt > 0:
        return f"{save_amt:.2f}"
    return all_text.strip()


def _paddle_extract_unit(crop_bgr: np.ndarray) -> str:
    detections = _paddle_ocr_crop(crop_bgr)
    if not detections:
        return ""
    all_text = ' '.join(d['text'] for d in detections)
    return re.sub(r'[^\d.$/ a-zA-Z]', '', all_text).strip()


# ---------------------------------------------------------------------------
# CORE OCR — streamlined
# ---------------------------------------------------------------------------
def perform_ocr_production(crop_img: np.ndarray, box_class: str) -> Dict:
    if box_class == 'product_image_block':
        return {}

    if box_class == 'price_main':
        return _paddle_extract_price(crop_img)

    if box_class == 'description_block':
        return {'Name': _paddle_extract_text(crop_img)}

    if box_class == 'promo_text_block':
        return {'Save_amount': _paddle_extract_promo(crop_img)}

    if box_class == 'unit_price_block':
        return {'UnitPrice': _paddle_extract_unit(crop_img)}

    return {}


# ---------------------------------------------------------------------------
# PROCESS TILE
# ---------------------------------------------------------------------------
def process_single_tile(tile_bbox: tuple, page_img: np.ndarray) -> Dict:
    x1, y1, x2, y2 = map(int, tile_bbox)
    h_page, w_page = page_img.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w_page, x2), min(h_page, y2)

    tile_crop = page_img[y1:y2, x1:x2]
    if tile_crop.size == 0:
        return {}

    model2 = get_model2()
    result_m2 = model2.predict(
        source=tile_crop, imgsz=MODEL_2_IMG_SIZE,
        conf=CONF_THRESHOLD, iou=IOU_THRESHOLD_M2, verbose=False
    )[0]

    if result_m2.boxes is None or len(result_m2.boxes) == 0:
        return {}

    xyxy = result_m2.boxes.xyxy.cpu().numpy()
    confs = result_m2.boxes.conf.cpu().numpy()
    classes = result_m2.boxes.cls.cpu().numpy().astype(int)
    del result_m2
    class_best = {}
    for idx, (box, conf, cls_id) in enumerate(zip(xyxy, confs, classes)):
        if cls_id not in class_best or conf > class_best[cls_id][1]:
            class_best[cls_id] = (idx, conf)

    tile_result = {}
    h_tile, w_tile = tile_crop.shape[:2]

    for cls_id, (best_idx, best_conf) in class_best.items():
        sx1, sy1, sx2, sy2 = map(int, xyxy[best_idx])
        sx1, sy1 = max(0, sx1), max(0, sy1)
        sx2, sy2 = min(w_tile, sx2), min(h_tile, sy2)

        class_name = model2.names[cls_id]
        csv_field = CLASS_MAPPING.get(class_name)
        if not csv_field or (sx2 - sx1) < 5 or (sy2 - sy1) < 5:
            continue

        sub_crop = tile_crop[sy1:sy2, sx1:sx2]
        if sub_crop.size == 0:
            continue

        ocr_result = perform_ocr_production(sub_crop, class_name)
        tile_result.update(ocr_result)
        del sub_crop

    # PriceWas calculation
    pn = extract_numeric_price(tile_result.get('Price_Now', ''))
    sa = extract_numeric_price(tile_result.get('Save_amount', ''))
    if pn is not None and sa is not None:
        tile_result['PriceWas'] = f"{pn + sa:.2f}"
    else:
        tile_result['PriceWas'] = ""

    del tile_crop
    return tile_result


# ---------------------------------------------------------------------------
# PROCESS PAGE
# ---------------------------------------------------------------------------
def process_single_page(page_image_path: str, catalogue_meta: Dict) -> List[Dict]:
    page_img = cv2.imread(str(page_image_path))
    if page_img is None:
        logger.warning(f"Could not load image: {page_image_path}")
        return []

    page_num = extract_page_number(Path(page_image_path).stem)

    model1 = get_model1()
    result_m1 = model1.predict(
        source=page_img, imgsz=MODEL_1_IMG_SIZE,
        conf=CONF_THRESHOLD, iou=IOU_THRESHOLD_M1, verbose=False
    )[0]

    if result_m1.boxes is None or len(result_m1.boxes) == 0:
        del page_img
        return []

    xyxy = result_m1.boxes.xyxy.cpu().numpy()
    confs = result_m1.boxes.conf.cpu().numpy()
    num_tiles = len(xyxy)

    # Free YOLO result immediately after extracting what we need
    del result_m1

    page_products = []
    for tile_idx, (bbox, tile_conf) in enumerate(zip(xyxy, confs), start=1):
        tile_result = process_single_tile(bbox, page_img)
        if not tile_result:
            continue

        product_row = {
            'store': catalogue_meta.get('store', ''),
            'Retailer': extract_retailer(catalogue_meta.get('slug', catalogue_meta.get('store', ''))),
            'title': catalogue_meta.get('title', ''),
            'slug': catalogue_meta.get('slug', ''),
            'year': catalogue_meta.get('year', ''),
            'state': catalogue_meta.get('state', ''),
            'catalogue_on_sale_date': catalogue_meta.get('catalogue_on_sale_date', ''),
            'scraped_date': catalogue_meta.get('scraped_date', ''),
            'page_count': catalogue_meta.get('page_count', 0),
            'catalogue_id': catalogue_meta.get('id', ''),
            'page_number': page_num,
            'tile_number': tile_idx,
            'tile_confidence': f"{tile_conf:.3f}",
            'tiles_on_page': num_tiles,
            # OCR results — clean columns
            'Name': tile_result.get('Name', ''),
            'Price_Now': tile_result.get('Price_Now', ''),
            'Price_Raw': tile_result.get('Price_Raw', ''),
            'Price_Spatial': tile_result.get('Price_Spatial', ''),
            'Price_Black': tile_result.get('Price_Black', ''),
            'Save_amount': tile_result.get('Save_amount', ''),
            'PriceWas': tile_result.get('PriceWas', ''),
            'UnitPrice': tile_result.get('UnitPrice', ''),
            'ocr_processed_date': datetime.now().isoformat(),
        }
        page_products.append(product_row)

    del page_img
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return page_products


# ---------------------------------------------------------------------------
# PROCESS CATALOGUE
# ---------------------------------------------------------------------------
def process_single_catalogue(catalogue_row: pd.Series) -> int:
    store = catalogue_row.get('store', '')
    year = str(catalogue_row.get('year', ''))
    slug = catalogue_row.get('slug', '')

    catalogue_folder = CATALOGUES_IMAGE_DIR / store / year / slug
    if not catalogue_folder.exists():
        logger.warning(f"Catalogue folder not found: {catalogue_folder}")
        return []

    page_images = sorted(catalogue_folder.glob("page_*.jpg"))
    if not page_images:
        page_images = sorted([
            p for p in catalogue_folder.iterdir()
            if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}
            and p.stem != 'metadata'
        ])
    if not page_images:
        logger.warning(f"No page images found in: {catalogue_folder}")
        return []

    print(f"    {slug} — {len(page_images)} pages", flush=True)

    catalogue_meta = catalogue_row.to_dict()
    catalogue_product_count = 0

    for page_idx, page_path in enumerate(page_images, start=1):
        try:
            page_products = process_single_page(str(page_path), catalogue_meta)
            if page_products:
                append_to_ocr_database(page_products)
                catalogue_product_count += len(page_products)
            #print(f"      Page {page_idx}/{len(page_images)}: {len(page_products)} products", flush=True)
        except Exception as e:
            logger.error(f"    Error on page {page_path.name}: {str(e)[:120]}")
            #print(f"      Page {page_idx}/{len(page_images)}: ERROR - {str(e)[:80]}", flush=True)
            continue
        finally:
            if 'page_products' in locals():
                del page_products

        if page_idx % GC_EVERY_N_PAGES == 0:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    print(f"    Done: {catalogue_product_count} products total", flush=True)
    return catalogue_product_count


# ---------------------------------------------------------------------------
# DATABASE HELPERS
# ---------------------------------------------------------------------------
def load_ocr_database() -> pd.DataFrame:
    if OCR_OUTPUT_CSV.exists():
        return pd.read_csv(OCR_OUTPUT_CSV)
    return pd.DataFrame()


def save_ocr_database(df: pd.DataFrame):
    CATALOGUE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OCR_OUTPUT_CSV, index=False, encoding='utf-8-sig')


def append_to_ocr_database(new_rows: List[Dict]):
    if not new_rows:
        return
    CATALOGUE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    new_df = pd.DataFrame(new_rows)
    # Keep schema stable while appending in chunks to avoid loading the full CSV.
    new_df = new_df.reindex(columns=OUTPUT_COLUMNS, fill_value='')
    file_exists = OCR_OUTPUT_CSV.exists()
    write_header = (not file_exists) or (OCR_OUTPUT_CSV.stat().st_size == 0)
    new_df.to_csv(
        OCR_OUTPUT_CSV,
        mode='a',
        header=write_header,
        index=False,
        encoding='utf-8-sig' if write_header else 'utf-8'
    )


def load_tracking_csv() -> pd.DataFrame:
    if not TRACKING_CSV.exists():
        logger.error(f"Tracking CSV not found: {TRACKING_CSV}")
        sys.exit(1)
    df = pd.read_csv(TRACKING_CSV)
    if 'ocr_processed' not in df.columns:
        df['ocr_processed'] = ''
    return df


def save_tracking_csv(df: pd.DataFrame):
    df.to_csv(TRACKING_CSV, index=False)


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    # ---------------------------------------------------------------
    # SET THIS TO LIMIT PROCESSING (for testing)
    #   process_n = 5       → process only 5 catalogues
    #   process_n = "all"   → process everything
    # ---------------------------------------------------------------
    process_n = "all"

    # ---------------------------------------------------------------
    # SET THIS TO FILTER BY YEAR (to reduce total processing time)
    #   min_year = 2023     → only process 2023 onwards
    #   min_year = None     → process all years
    # ---------------------------------------------------------------
    min_year = 2024  

    logger.info("=" * 70)
    logger.info("CATALOGUE OCR PIPELINE — START (Paddle-only, no Tesseract)")
    logger.info("=" * 70)

    if not MODEL_1_WEIGHTS.exists():
        print(f"ERROR: Model 1 not found: {MODEL_1_WEIGHTS}", flush=True)
        sys.exit(1)
    if not MODEL_2_WEIGHTS.exists():
        print(f"ERROR: Model 2 not found: {MODEL_2_WEIGHTS}", flush=True)
        sys.exit(1)

    tracking_df = load_tracking_csv()

    downloaded = tracking_df[tracking_df['downloaded'] == True].copy()

        # Filter by year
    if min_year is not None:
        downloaded['year_int'] = pd.to_numeric(downloaded['year'], errors='coerce').fillna(0).astype(int)
        before_filter = len(downloaded)
        downloaded = downloaded[downloaded['year_int'] >= min_year].copy()
        downloaded.drop(columns=['year_int'], inplace=True)
        print(f"Year filter: {min_year}+ → {len(downloaded)} of {before_filter} catalogues", flush=True)





    unprocessed = downloaded[
        (downloaded['ocr_processed'] != 'Y') | (downloaded['ocr_processed'].isna()) | (downloaded['ocr_processed'] != 'Temp_Y')
    ].copy()

    total_catalogues = len(unprocessed)
    print(f"\nCatalogues in tracking: {len(tracking_df)}", flush=True)
    print(f"Downloaded: {len(downloaded)}", flush=True)
    print(f"To OCR-process: {total_catalogues}", flush=True)

    if total_catalogues == 0:
        print("\nAll catalogues already processed. Nothing to do.", flush=True)
        return

    if process_n != "all":
        process_n = int(process_n)
        unprocessed = unprocessed.head(process_n)
        total_catalogues = len(unprocessed)
        print(f"LIMITED to {process_n} catalogues (test mode)", flush=True)

    print(f"\n{'=' * 70}", flush=True)
    print(f"CATALOGUE OCR PIPELINE — Paddle-only (fast mode)", flush=True)
    print(f"{'=' * 70}", flush=True)
    print(f"  Catalogues: {total_catalogues}", flush=True)
    print(f"  Output: {OCR_OUTPUT_CSV}", flush=True)

    print("\nLoading models...", flush=True)
    get_model1()
    print("  Model 1 loaded", flush=True)
    get_model2()
    print("  Model 2 loaded", flush=True)
    get_paddle_ocr()
    print("  PaddleOCR loaded", flush=True)
    print("Starting OCR...\n", flush=True)

    catalogues_completed = 0
    total_products = 0
    start_time = time.perf_counter()

    for idx, (_, cat_row) in enumerate(unprocessed.iterrows(), start=1):
        slug = cat_row['slug']
        store = cat_row['store']
        title = cat_row.get('title', slug)

        print(f"\n[{idx}/{total_catalogues}] {store.upper()} — {title}", flush=True)

        try:
            product_count = process_single_catalogue(cat_row)

            if product_count > 0:
                total_products += product_count
                print(f"  ✓ {product_count} products saved (total: {total_products})", flush=True)
            else:
                print(f"  ✗ No products found", flush=True)

            tracking_df.loc[tracking_df['slug'] == slug, 'ocr_processed'] = 'Y'
            save_tracking_csv(tracking_df)
            catalogues_completed += 1

        except Exception as e:
            logger.error(f"CRITICAL ERROR {slug}: {str(e)}")
            print(f"  ERROR: {str(e)[:100]}", flush=True)
            continue

        elapsed = time.perf_counter() - start_time
        rate = elapsed / idx
        eta = rate * (total_catalogues - idx)
        print(f"  Time: {elapsed / 60:.1f}min elapsed | ETA: {eta / 60:.1f}min remaining", flush=True)

        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    elapsed_total = time.perf_counter() - start_time
    print(f"\n{'=' * 70}", flush=True)
    print(f"COMPLETE", flush=True)
    print(f"{'=' * 70}", flush=True)
    print(f"  Catalogues: {catalogues_completed}/{total_catalogues}", flush=True)
    print(f"  Products: {total_products}", flush=True)
    print(f"  Time: {elapsed_total / 60:.1f} minutes", flush=True)
    print(f"  Output: {OCR_OUTPUT_CSV}", flush=True)


if __name__ == "__main__":
    print("=" * 50, flush=True)
    print("SCRIPT STARTING...", flush=True)
    print(f"YOLO device:         {YOLO_DEVICE}", flush=True)
    if YOLO_DEVICE == "cuda":
        print(f"GPU:                 {torch.cuda.get_device_name(0)}", flush=True)
    print(f"Tracking CSV exists: {TRACKING_CSV.exists()}", flush=True)
    print(f"Model 1 exists: {MODEL_1_WEIGHTS.exists()}", flush=True)
    print(f"Model 2 exists: {MODEL_2_WEIGHTS.exists()}", flush=True)
    print("=" * 50, flush=True)
    try:
        main()
    except SystemExit as e:
        print(f"\nsys.exit({e})", flush=True)
    except Exception as e:
        print(f"\nFATAL ERROR: {e}", flush=True)
        import traceback
        traceback.print_exc()