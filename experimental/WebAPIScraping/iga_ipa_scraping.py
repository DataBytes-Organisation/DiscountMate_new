#!/usr/bin/env python
# coding: utf-8

# In[ ]:


"""
IGA brand based weekly scraper.

How it works.
. Loads a list of brands from a CSV
. For each brand, pages the store search endpoint to collect product rows
. Deduplicates by SKU across all brands
. Writes a weekly snapshot CSV and JSONL for the current run_id
. Supports checkpoint resume per brand and per page
. Optional image download. Skips files that already exist and are non empty

Outputs.
. Weekly snapshots.
  . ./IGA scraped product/iga_all_products_{RUN_ID}.csv
  . ./IGA scraped product/iga_all_products_{RUN_ID}.jsonl
. Cache and checkpoints.
  . ./iga_cache/brand_progress.json
  . ./iga_cache/run_progress.json
  . ./iga_cache/sku_index.json

Performance notes.
. Search paging is sequential to reduce 429s and blocking risk
. Optional image downloads are parallelised with ThreadPoolExecutor
. JSONL is written by the main thread for file safety
"""

from __future__ import annotations

import json
import os
import random
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd
import requests

# ============================================================
# ONE TOGGLE ONLY
# ============================================================
DOWNLOAD_IMAGES = False

# ============================================================
# INPUT. BRAND LIST
# ============================================================
BRANDS_CSV_PATH = "brands_to_scrape_optimal_IGA_website.csv"
BRAND_COLUMN_CANDIDATES = ["brand", "Brands", "BrandName", "brand_name", "name"]

# ============================================================
# FIXED IGA CONTEXT
# ============================================================
BASE_URL = "https://www.igashop.com.au"
STORE_ID = 206686
SHOPPING_MODE_COOKIE = "Pickup"

# ============================================================
# TUNING
# ============================================================
REQUEST_TIMEOUT_S = 25
MAX_RETRIES = 4
BACKOFF_BASE_S = 1.0
SLEEP_BETWEEN_CALLS = (0.35, 0.95)
TAKE = 50

# Checkpoint behaviour
AUTOSAVE_EVERY_N_BRANDS = 3
AUTOSAVE_EVERY_N_PAGES = 10

# Concurrency for optional image download
MAX_WORKERS = 16

# ============================================================
# OUTPUT STRUCTURE
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CACHE_DIR = os.path.join(BASE_DIR, "iga_cache")
SNAPSHOT_DIR = os.path.join(BASE_DIR, "iga_scraped_product")
IMAGES_ROOT_DIR = os.path.join(BASE_DIR, "images")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(SNAPSHOT_DIR, exist_ok=True)
os.makedirs(IMAGES_ROOT_DIR, exist_ok=True)

RUN_PROGRESS_JSON = os.path.join(CACHE_DIR, "run_progress.json")
BRAND_PROGRESS_JSON = os.path.join(CACHE_DIR, "brand_progress.json")
SKU_INDEX_JSON = os.path.join(CACHE_DIR, "sku_index.json")


# ============================================================
# UTILS
# ============================================================
def now_ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def safe_str(x: Any) -> str:
    return "" if x is None else str(x)


def new_session_id() -> str:
    return str(uuid.uuid4())


def norm_key(s: str) -> str:
    s = safe_str(s).strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def load_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: str, obj) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def append_jsonl(path: str, obj: Dict[str, Any]) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def sleep_jitter(lo_hi: Tuple[float, float]) -> None:
    time.sleep(random.uniform(*lo_hi))


def standardise_col_name(name: str) -> str:
    name = safe_str(name).strip()
    name = name.replace(".", "_")
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"[^a-zA-Z0-9_]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name.lower()


def standardise_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    raw = [standardise_col_name(c) for c in df.columns]
    seen: Dict[str, int] = {}
    fixed: List[str] = []
    for c in raw:
        if c not in seen:
            seen[c] = 1
            fixed.append(c)
        else:
            seen[c] += 1
            fixed.append(f"{c}_{seen[c]}")
    df.columns = fixed
    return df


def flatten_any_simple(
    obj: Any,
    parent_key: str = "iga",
    sep: str = ".",
    max_depth: int = 20,
    _depth: int = 0,
) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if _depth > max_depth:
        out[parent_key] = json.dumps(obj, ensure_ascii=False)
        return out
    if isinstance(obj, dict):
        for k, v in obj.items():
            nk = f"{parent_key}{sep}{k}" if parent_key else str(k)
            out.update(flatten_any_simple(v, nk, sep, max_depth, _depth + 1))
        return out
    if isinstance(obj, list):
        out[parent_key] = json.dumps(obj, ensure_ascii=False)
        return out
    out[parent_key] = obj
    return out


# ============================================================
# HTTP HELPERS
# ============================================================
def build_headers() -> Dict[str, str]:
    return {
        "accept": "*/*",
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/143.0.0.0 Safari/537.36"
        ),
        "referer": f"{BASE_URL}/",
        "x-shopping-mode": "11111111-1111-1111-1111-111111111111",
    }


def build_cookies() -> Dict[str, str]:
    return {
        "iga-shop.retailerStoreId": str(STORE_ID),
        "iga-shop.shoppingMode": SHOPPING_MODE_COOKIE,
    }


def request_json(session: requests.Session, url: str, params: Optional[Dict[str, Any]] = None):
    try:
        r = session.get(
            url,
            headers=build_headers(),
            cookies=build_cookies(),
            params=params,
            timeout=REQUEST_TIMEOUT_S,
        )
        if r.status_code == 429:
            return None, "RATE_LIMITED_429"
        if r.status_code == 403:
            return None, "BLOCKED_403"
        if r.status_code != 200:
            return None, f"HTTP_{r.status_code}"
        try:
            return r.json(), "SUCCESS"
        except Exception:
            return None, "INVALID_JSON"
    except requests.exceptions.Timeout:
        return None, "TIMEOUT"
    except requests.exceptions.ConnectionError:
        return None, "CONNECTION_ERROR"
    except Exception:
        return None, "ERROR_UNKNOWN"


def with_retries(fn):
    payload, status = None, "UNKNOWN"
    for attempt in range(MAX_RETRIES):
        payload, status = fn()
        if status == "SUCCESS":
            return payload, status

        delay = (BACKOFF_BASE_S * (1 + attempt)) * random.uniform(0.8, 1.6)

        # If blocked, back off more. This reduces repeated 403 loops.
        if status == "BLOCKED_403":
            delay = max(delay, 10.0 + random.uniform(0, 5))

        print(f"[HTTP] status={status} attempt={attempt+1}/{MAX_RETRIES} sleep={delay:.2f}s")
        time.sleep(delay)

    return payload, status


# ============================================================
# ENDPOINTS
# ============================================================
def store_search_url() -> str:
    return f"{BASE_URL}/api/storefront/stores/{STORE_ID}/search"


# ============================================================
# PARSERS
# ============================================================
def extract_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = payload.get("items")
    return [x for x in items if isinstance(x, dict)] if isinstance(items, list) else []


def extract_total(payload: Dict[str, Any]) -> Optional[int]:
    t = payload.get("total")
    return t if isinstance(t, int) else None


def extract_sku_from_item(item: Dict[str, Any]) -> str:
    return safe_str(item.get("sku") or item.get("productId") or "").strip()


def extract_primary_image_url_from_item(item: Dict[str, Any]) -> str:
    img = item.get("image") or {}
    if isinstance(img, dict):
        return safe_str(img.get("default") or img.get("details") or img.get("cell") or img.get("zoom") or "")
    return ""


# ============================================================
# BRAND LIST LOADER
# ============================================================
def load_brands_from_csv(path: str) -> List[str]:
    df = pd.read_csv(path)
    col = None
    for c in BRAND_COLUMN_CANDIDATES:
        if c in df.columns:
            col = c
            break
    if col is None:
        col = df.columns[0]

    brands = (
        df[col]
        .dropna()
        .astype(str)
        .map(lambda s: s.strip())
        .loc[lambda s: s != ""]
        .tolist()
    )

    seen: Set[str] = set()
    out: List[str] = []
    for b in brands:
        k = norm_key(b)
        if k not in seen:
            out.append(b)
            seen.add(k)
    return out


# ============================================================
# OPTIONAL IMAGE DOWNLOAD
# ============================================================
def download_image_if_needed(session: requests.Session, image_url: str, sku: str) -> Tuple[bool, str, str]:
    if not image_url or not sku:
        return False, "", ""

    retailer = "iga"
    local_dir = os.path.join(IMAGES_ROOT_DIR, retailer)
    os.makedirs(local_dir, exist_ok=True)

    local_path = os.path.join(local_dir, f"{sku}.jpg")
    web_rel = f"{retailer}/{sku}.jpg"

    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        return False, local_path, web_rel

    tmp_path = local_path + ".part"
    try:
        with session.get(image_url, timeout=REQUEST_TIMEOUT_S, stream=True) as r:
            if r.status_code != 200:
                return False, "", ""
            with open(tmp_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        f.write(chunk)

        os.replace(tmp_path, local_path)

        if os.path.getsize(local_path) == 0:
            os.remove(local_path)
            return False, "", ""

        return True, local_path, web_rel
    except Exception:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        return False, "", ""


# ============================================================
# CHECKPOINT STATE
# ============================================================
def load_or_create_run_id() -> str:
    """
    If an unfinished run exists, reuse its run_id and continue writing to the same snapshot files.
    Otherwise create a new run_id for a new weekly snapshot.
    """
    rp = load_json(RUN_PROGRESS_JSON, {})
    if rp.get("status") == "RUNNING" and rp.get("run_id"):
        return str(rp["run_id"])
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def snapshot_paths(run_id: str) -> Tuple[str, str]:
    csv_path = os.path.join(BASE_DIR, f"iga_all_products_{run_id}.csv")
    jsonl_path = os.path.join(SNAPSHOT_DIR, f"iga_all_products_{run_id}.jsonl")
    return csv_path, jsonl_path


def init_run_progress(run_id: str, brands_count: int) -> Dict[str, Any]:
    rp = load_json(RUN_PROGRESS_JSON, {})
    if rp.get("status") == "RUNNING" and rp.get("run_id") == run_id:
        return rp

    rp = {
        "status": "RUNNING",
        "run_id": run_id,
        "store_id": STORE_ID,
        "brands_count": brands_count,
        "started_at": now_ts(),
        "updated_at": now_ts(),
        "last_brand_index": -1,
    }
    save_json(RUN_PROGRESS_JSON, rp)
    return rp


def mark_run_done(run_id: str) -> None:
    rp = load_json(RUN_PROGRESS_JSON, {})
    if rp.get("run_id") != run_id:
        return
    rp["status"] = "DONE"
    rp["finished_at"] = now_ts()
    rp["updated_at"] = now_ts()
    save_json(RUN_PROGRESS_JSON, rp)


def load_brand_progress() -> Dict[str, Any]:
    return load_json(BRAND_PROGRESS_JSON, {})


def save_brand_progress(bp: Dict[str, Any]) -> None:
    save_json(BRAND_PROGRESS_JSON, bp)


def load_sku_index() -> Dict[str, Any]:
    return load_json(SKU_INDEX_JSON, {})


def save_sku_index(si: Dict[str, Any]) -> None:
    save_json(SKU_INDEX_JSON, si)


def update_sku_index(si: Dict[str, Any], sku: str, brand: str) -> None:
    if not sku:
        return
    entry = si.get(sku)
    if entry is None:
        si[sku] = {"first_seen": now_ts(), "last_seen": now_ts(), "brands": [brand]}
        return
    entry["last_seen"] = now_ts()
    brands = entry.get("brands") or []
    if brand not in brands:
        brands.append(brand)
    entry["brands"] = brands
    si[sku] = entry


# ============================================================
# WEEKLY SNAPSHOT. BRAND SEARCH PAGING WITH RESUME
# ============================================================
def fetch_search_page(http: requests.Session, brand_query: str, session_id: str, take: int, skip: int):
    url = store_search_url()
    params = {"q": brand_query, "sessionId": session_id, "take": take, "skip": skip, "sort": "relevance"}
    return with_retries(lambda: request_json(http, url, params=params))


def item_to_row(item: Dict[str, Any], brand_query: str, run_id: str) -> Dict[str, Any]:
    sku = extract_sku_from_item(item)
    img_url = extract_primary_image_url_from_item(item)

    core = {
        "Retailer": "IGA",
        "StoreId": STORE_ID,
        "SKU": sku,
        "Name": safe_str(item.get("name") or ""),
        "BrandName": safe_str(item.get("brand") or ""),
        "Barcode": safe_str(item.get("barcode") or ""),
        "Available": item.get("available") if item.get("available") is not None else "",
        "SellBy": safe_str(item.get("sellBy") or ""),
        "PriceDisplay": safe_str(item.get("price") or ""),
        "PriceNumeric": item.get("priceNumeric") if item.get("priceNumeric") is not None else "",
        "WasPriceDisplay": safe_str(item.get("wasPrice") or ""),
        "WasPriceNumeric": item.get("wasPriceNumeric") if item.get("wasPriceNumeric") is not None else "",
        "PriceLabel": safe_str(item.get("priceLabel") or ""),
        "PriceSource": safe_str(item.get("priceSource") or ""),
        "PricePerUnit": safe_str(item.get("pricePerUnit") or ""),
        "PrimaryImageUrl": img_url,
        "ScrapedAt": now_ts(),
        "RunId": run_id,
        "BrandQuery": brand_query,
        "RawJson": json.dumps(item, ensure_ascii=False),
    }

    flat = flatten_any_simple(item, "iga")
    return {**flat, **core}


def scrape_weekly_snapshot_by_brands(brands: List[str]) -> pd.DataFrame:
    """
    Weekly snapshot with resume.
    . Uses brand_progress.json to resume from the exact brand and skip offset
    . Uses sku_index.json to avoid re reading JSONL to rebuild seen SKUs
    . Writes JSONL continuously so an interrupted run still has usable partial output
    . Writes CSV at the end (or after interruption, if possible)
    """
    run_id = load_or_create_run_id()
    snapshot_csv, snapshot_jsonl = snapshot_paths(run_id)

    rp = init_run_progress(run_id, brands_count=len(brands))
    bp = load_brand_progress()
    si = load_sku_index()

    http = requests.Session()
    session_id = new_session_id()

    seen_skus: Set[str] = set(si.keys())
    rows: List[Dict[str, Any]] = []
    image_tasks: List[Tuple[str, str]] = []

    print(f"[INIT] run_id={run_id} store_id={STORE_ID} brands={len(brands)} take={TAKE} download_images={DOWNLOAD_IMAGES}")
    print(f"[OUT]  CSV={snapshot_csv}")
    print(f"[OUT]  JSONL={snapshot_jsonl}")
    print(f"[RESUME] last_brand_index={rp.get('last_brand_index', -1)} seen_skus={len(seen_skus)}")

    def autosave(brand_index: int) -> None:
        rp2 = load_json(RUN_PROGRESS_JSON, {})
        if rp2.get("run_id") == run_id:
            rp2["last_brand_index"] = int(brand_index)
            rp2["updated_at"] = now_ts()
            save_json(RUN_PROGRESS_JSON, rp2)
        save_brand_progress(bp)
        save_sku_index(si)

    try:
        for bi, brand in enumerate(brands, start=0):
            # Resume at brand index level
            if bi <= int(rp.get("last_brand_index", -1)):
                continue

            brand = safe_str(brand).strip()
            if not brand:
                autosave(bi)
                continue

            bkey = norm_key(brand)
            state = bp.get(bkey, {"skip": 0, "done": False, "total": None, "brand": brand})
            if state.get("done") is True:
                autosave(bi)
                continue

            skip = int(state.get("skip", 0))
            total_expected: Optional[int] = state.get("total")
            page_count = 0

            print(f"[BRAND {bi+1:>4}/{len(brands)}] start {brand} skip={skip}")

            while True:
                payload, status = fetch_search_page(http, brand, session_id, TAKE, skip)
                if not payload or status != "SUCCESS":
                    print(f"[BRAND] fail {brand} skip={skip} status={status}")

                    # Persist state so next run resumes on the same brand and skip
                    bp[bkey] = {"skip": skip, "done": False, "total": total_expected, "brand": brand, "updated_at": now_ts()}
                    autosave(bi)
                    break

                if total_expected is None:
                    total_expected = extract_total(payload)

                items = extract_items(payload)
                if not items:
                    print(f"[BRAND] done {brand} total={total_expected}")
                    bp[bkey] = {"skip": skip, "done": True, "total": total_expected, "brand": brand, "updated_at": now_ts()}
                    autosave(bi)
                    break

                added = 0
                for it in items:
                    sku = extract_sku_from_item(it)
                    if not sku:
                        continue

                    # Always update sku index for audit, even if already seen
                    update_sku_index(si, sku, brand)

                    if sku in seen_skus:
                        continue

                    row = item_to_row(it, brand_query=brand, run_id=run_id)
                    rows.append(row)
                    append_jsonl(snapshot_jsonl, row)

                    seen_skus.add(sku)
                    added += 1

                    if DOWNLOAD_IMAGES:
                        img_url = row.get("PrimaryImageUrl") or ""
                        if img_url:
                            image_tasks.append((sku, img_url))

                print(f"[BRAND] page {brand} skip={skip} items={len(items)} +new_rows={added} unique_skus={len(seen_skus)}")

                skip += TAKE
                page_count += 1

                # Update brand state frequently so resume is accurate
                bp[bkey] = {"skip": skip, "done": False, "total": total_expected, "brand": brand, "updated_at": now_ts()}

                if page_count % AUTOSAVE_EVERY_N_PAGES == 0:
                    autosave(bi)

                # End conditions
                if len(items) < TAKE:
                    bp[bkey] = {"skip": skip, "done": True, "total": total_expected, "brand": brand, "updated_at": now_ts()}
                    autosave(bi)
                    print(f"[BRAND] done {brand} total={total_expected}")
                    break

                if isinstance(total_expected, int) and skip >= total_expected:
                    bp[bkey] = {"skip": skip, "done": True, "total": total_expected, "brand": brand, "updated_at": now_ts()}
                    autosave(bi)
                    print(f"[BRAND] done {brand} total={total_expected}")
                    break

                sleep_jitter(SLEEP_BETWEEN_CALLS)

            # Brand level autosave
            if (bi + 1) % AUTOSAVE_EVERY_N_BRANDS == 0:
                autosave(bi)

        # Images after data scrape
        images_written = 0
        if DOWNLOAD_IMAGES and image_tasks:
            print(f"[IMG] downloading images tasks={len(image_tasks)} workers={MAX_WORKERS}")

            def _img_worker(task: Tuple[str, str]) -> bool:
                sku, img_url = task
                s = requests.Session()
                ok, _, _ = download_image_if_needed(s, img_url, sku)
                return bool(ok)

            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                futures = [ex.submit(_img_worker, t) for t in image_tasks]
                done = 0
                for f in as_completed(futures):
                    done += 1
                    try:
                        if f.result():
                            images_written += 1
                    except Exception:
                        pass
                    if done % 200 == 0:
                        print(f"[IMG] progress {done}/{len(image_tasks)} images_written={images_written}")

            print(f"[IMG] done images_written={images_written}")

        # Build final CSV from jsonl output.
        # We rebuild from file so resume and partial writes are included.
        if os.path.exists(snapshot_jsonl):
            file_rows: List[Dict[str, Any]] = []
            with open(snapshot_jsonl, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        file_rows.append(json.loads(line))
                    except Exception:
                        continue

            df = pd.DataFrame(file_rows)
        else:
            df = pd.DataFrame(rows)

        df = standardise_dataframe_columns(df)
        df.to_csv(snapshot_csv, index=False, encoding="utf-8-sig")

        print("[DONE] weekly snapshot saved")
        print(f". CSV:   {snapshot_csv}")
        print(f". JSONL: {snapshot_jsonl}")
        print(f". rows={len(df)} cols={len(df.columns)} unique_skus={len(seen_skus)} images_written={images_written}")

        mark_run_done(run_id)
        return df

    except KeyboardInterrupt:
        print("\n[INTERRUPT] saving progress and exiting")
        autosave(int(rp.get("last_brand_index", -1)))
        raise

    except Exception as e:
        print(f"\n[ERROR] {type(e).__name__}: {e}")
        autosave(int(rp.get("last_brand_index", -1)))
        raise


# ============================================================
# RUN
# ============================================================
if __name__ == "__main__":
    brands = load_brands_from_csv(BRANDS_CSV_PATH)
    print(f"[BOOT] loaded brands={len(brands)} sample={brands[:10]}")
    df_week = scrape_weekly_snapshot_by_brands(brands)
    print(df_week.head(5))

