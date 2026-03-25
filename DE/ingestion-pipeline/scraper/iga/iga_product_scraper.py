from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

import httpx

from util import (
    RunContext,
    RunResult,
    append_jsonl,
    flatten_json,
    get_state_dir,
    legacy_timestamp,
    load_brand_queries,
    load_json_file,
    normalize_record_keys,
    read_jsonl,
    request_with_debug,
    safe_str,
    save_json_file,
    sleep_if_needed,
)


AUTOSAVE_EVERY_N_BRANDS = 3
AUTOSAVE_EVERY_N_PAGES = 10
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def _search(
    client: httpx.Client,
    context: RunContext,
    brand: str,
    take: int,
    skip: int,
    session_id: str,
) -> tuple[dict[str, Any] | None, str]:
    settings = context.settings.iga
    url = f"{settings.base_url}/api/storefront/stores/{settings.store_id}/search"
    response = request_with_debug(
        client,
        context.logger,
        "iga",
        "GET",
        url,
        request_context=f"brand={brand!r} skip={skip} take={take}",
        headers={
            "accept": "*/*",
            "user-agent": USER_AGENT,
            "referer": f"{settings.base_url}/",
            "x-shopping-mode": "11111111-1111-1111-1111-111111111111",
        },
        cookies={
            "iga-shop.retailerStoreId": str(settings.store_id),
            "iga-shop.shoppingMode": settings.shopping_mode_cookie,
        },
        params={
            "q": brand,
            "sessionId": session_id,
            "take": take,
            "skip": skip,
            "sort": "relevance",
        },
    )
    if response.status_code == 429:
        return None, "RATE_LIMITED_429"
    if response.status_code == 403:
        return None, "BLOCKED_403"
    if response.status_code != 200:
        return None, f"HTTP_{response.status_code}"
    return response.json(), "SUCCESS"


def _extract_products(
    payload: dict[str, Any], brand: str, store_id: int, state_run_id: str
) -> list[dict[str, Any]]:
    items = payload.get("items")
    if not isinstance(items, list):
        return []

    records: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        record = {
            "Retailer": "IGA",
            "StoreId": store_id,
            "SKU": safe_str(item.get("sku") or item.get("productId")),
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
            "PrimaryImageUrl": safe_str(((item.get("image") or {}).get("default")) or ""),
            "ScrapedAt": legacy_timestamp(),
            "RunId": state_run_id,
            "BrandQuery": brand,
            "RawJson": json.dumps(item, ensure_ascii=False),
        }
        flat = flatten_json(item, "iga")
        records.append(normalize_record_keys({**flat, **record}))
    return records


def _load_or_create_state_run_id(run_progress_path: Path, default_run_id: str) -> str:
    run_progress = load_json_file(run_progress_path, {})
    if (
        isinstance(run_progress, dict)
        and run_progress.get("status") == "RUNNING"
        and run_progress.get("run_id")
    ):
        return str(run_progress["run_id"])
    return default_run_id


def run(context: RunContext) -> RunResult:
    settings = context.settings.iga
    state_dir = get_state_dir(context.settings.app.output_dir, context.source, context.runner)
    run_progress_path = state_dir / "run_progress.json"
    brand_progress_path = state_dir / "brand_progress.json"
    sku_index_path = state_dir / "sku_index.json"
    state_run_id = _load_or_create_state_run_id(run_progress_path, context.run_id)
    snapshot_jsonl_path = state_dir / f"iga_products_{state_run_id}.jsonl"

    brands = load_brand_queries(settings.brands_csv_path)
    run_progress = load_json_file(
        run_progress_path,
        {
            "status": "RUNNING",
            "run_id": state_run_id,
            "store_id": settings.store_id,
            "brands_count": len(brands),
            "started_at": legacy_timestamp(),
            "updated_at": legacy_timestamp(),
            "last_brand_index": -1,
        },
    )
    brand_progress = load_json_file(brand_progress_path, {})
    sku_index = load_json_file(sku_index_path, {})
    seen_skus: set[str] = set(sku_index.keys() if isinstance(sku_index, dict) else [])
    session_id = str(uuid.uuid4())

    if not isinstance(run_progress, dict):
        raise RuntimeError("Invalid IGA run progress state")
    if not isinstance(brand_progress, dict):
        brand_progress = {}
    if not isinstance(sku_index, dict):
        sku_index = {}

    def autosave(brand_index: int) -> None:
        run_progress["last_brand_index"] = int(brand_index)
        run_progress["updated_at"] = legacy_timestamp()
        save_json_file(run_progress_path, run_progress)
        save_json_file(brand_progress_path, brand_progress)
        save_json_file(sku_index_path, sku_index)

    with context.tracer.start_as_current_span("iga.products") as span:
        span.set_attribute("brand_count", len(brands))

        with httpx.Client(timeout=settings.timeout_seconds, follow_redirects=True) as client:
            current_brand_index = int(run_progress.get("last_brand_index", -1))
            try:
                for brand_index, brand in enumerate(brands):
                    current_brand_index = brand_index
                    if brand_index <= int(run_progress.get("last_brand_index", -1)):
                        continue

                    brand_value = safe_str(brand).strip()
                    if not brand_value:
                        autosave(brand_index)
                        continue

                    brand_key = brand_value.casefold()
                    state = brand_progress.get(
                        brand_key,
                        {"skip": 0, "done": False, "total": None, "brand": brand_value},
                    )
                    if state.get("done") is True:
                        autosave(brand_index)
                        continue

                    skip = int(state.get("skip", 0))
                    total_expected = state.get("total")
                    page_count = 0

                    while True:
                        payload, status = _search(
                            client,
                            context,
                            brand_value,
                            settings.page_size,
                            skip,
                            session_id,
                        )
                        if payload is None or status != "SUCCESS":
                            brand_progress[brand_key] = {
                                "skip": skip,
                                "done": False,
                                "total": total_expected,
                                "brand": brand_value,
                                "updated_at": legacy_timestamp(),
                            }
                            autosave(brand_index)
                            break

                        items = payload.get("items")
                        if total_expected is None:
                            total_expected = payload.get("total")

                        batch = []
                        for record in _extract_products(
                            payload, brand_value, settings.store_id, state_run_id
                        ):
                            sku = safe_str(record.get("sku"))
                            if not sku:
                                continue
                            entry = sku_index.get(sku)
                            if entry is None:
                                sku_index[sku] = {
                                    "first_seen": legacy_timestamp(),
                                    "last_seen": legacy_timestamp(),
                                    "brands": [brand_value],
                                }
                            else:
                                brands_seen = entry.get("brands") or []
                                if brand_value not in brands_seen:
                                    brands_seen.append(brand_value)
                                entry["brands"] = brands_seen
                                entry["last_seen"] = legacy_timestamp()
                                sku_index[sku] = entry

                            if sku in seen_skus:
                                continue
                            seen_skus.add(sku)
                            batch.append(record)
                            append_jsonl(snapshot_jsonl_path, record)

                        if not batch and not items:
                            brand_progress[brand_key] = {
                                "skip": skip,
                                "done": True,
                                "total": total_expected,
                                "brand": brand_value,
                                "updated_at": legacy_timestamp(),
                            }
                            autosave(brand_index)
                            break

                        context.logger.info(
                            "Fetched %s IGA records for brand=%s skip=%s",
                            len(batch),
                            brand_value,
                            skip,
                        )

                        skip += settings.page_size
                        page_count += 1
                        brand_progress[brand_key] = {
                            "skip": skip,
                            "done": False,
                            "total": total_expected,
                            "brand": brand_value,
                            "updated_at": legacy_timestamp(),
                        }

                        if page_count % AUTOSAVE_EVERY_N_PAGES == 0:
                            autosave(brand_index)

                        items_count = len(items) if isinstance(items, list) else 0
                        if items_count < settings.page_size or (
                            isinstance(total_expected, int) and skip >= total_expected
                        ):
                            brand_progress[brand_key] = {
                                "skip": skip,
                                "done": True,
                                "total": total_expected,
                                "brand": brand_value,
                                "updated_at": legacy_timestamp(),
                            }
                            autosave(brand_index)
                            break

                        sleep_if_needed(settings.delay_seconds)

                    if (brand_index + 1) % AUTOSAVE_EVERY_N_BRANDS == 0:
                        autosave(brand_index)

            except KeyboardInterrupt:
                autosave(current_brand_index)
                raise
            except Exception:
                autosave(current_brand_index)
                raise

    records = read_jsonl(snapshot_jsonl_path)
    run_progress["status"] = "DONE"
    run_progress["finished_at"] = legacy_timestamp()
    run_progress["updated_at"] = legacy_timestamp()
    save_json_file(run_progress_path, run_progress)

    return RunResult(
        records=records,
        metadata={
            "brand_count": len(brands),
            "unique_skus": len(seen_skus),
            "record_count": len(records),
            "state_run_id": state_run_id,
        },
    )
