from __future__ import annotations

import random
import re
from typing import TYPE_CHECKING, Any

import httpx

from util import (
    RunContext,
    RunResult,
    get_state_dir,
    legacy_timestamp,
    load_brand_queries,
    load_json_file,
    parse_cookie_string,
    read_csv_rows,
    remove_file_if_exists,
    request_with_debug,
    save_json_file,
    sleep_if_needed,
    write_csv_rows,
)

if TYPE_CHECKING:
    from pathlib import Path

AUTOSAVE_EVERY_N_BRANDS = 5
BUILD_ID_PATTERN = re.compile(r"(?P<build_id>\d{8}\.\d+-[0-9a-fA-F]+)")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def _detect_build_id(
    client: httpx.Client,
    context: RunContext,
    homepage_url: str,
    configured_build_id: str,
    cookies: dict[str, str],
) -> str:
    if configured_build_id:
        return configured_build_id

    response = request_with_debug(
        client,
        context.logger,
        "coles",
        "GET",
        homepage_url,
        request_context="homepage build_id_probe",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": homepage_url,
        },
        cookies=cookies or None,
    )
    response.raise_for_status()
    match = BUILD_ID_PATTERN.search(response.text)
    if match:
        build_id = match.group("build_id")
        context.logger.info("Detected Coles build id: %s", build_id)
        return build_id
    raise RuntimeError(
        "Unable to detect Coles build id from homepage response. "
        "Set COLES_BUILD_ID or ensure COLES_HOMEPAGE_URL returns a valid build id."
    )


def _search_direct(
    client: httpx.Client,
    context: RunContext,
    api_url: str,
    brand: str,
    page_number: int,
    page_size: int,
    cookies: dict[str, str],
) -> tuple[dict[str, Any] | None, str]:
    response = request_with_debug(
        client,
        context.logger,
        "coles",
        "GET",
        api_url,
        request_context=f"brand={brand!r} page={page_number} direct",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Referer": f"https://www.coles.com.au/search?q={brand}",
        },
        params={"q": brand, "page": page_number, "pageSize": page_size},
        cookies=cookies or None,
    )
    if response.status_code == 403 or "Incapsula" in response.text:
        return None, "BLOCKED_403"
    if response.status_code == 429:
        return None, "RATE_LIMITED_429"
    if response.status_code != 200:
        return None, f"HTTP_{response.status_code}"
    return response.json(), "SUCCESS"


def _search_scraperapi(
    client: httpx.Client,
    context: RunContext,
    api_url: str,
    brand: str,
    page_number: int,
    page_size: int,
    scraperapi_key: str,
) -> tuple[dict[str, Any] | None, str]:
    response = request_with_debug(
        client,
        context.logger,
        "coles",
        "GET",
        "http://api.scraperapi.com",
        request_context=f"brand={brand!r} page={page_number} scraperapi",
        params={
            "api_key": scraperapi_key,
            "url": f"{api_url}?q={brand}&page={page_number}&pageSize={page_size}",
            "render": "false",
        },
    )
    if response.status_code == 403:
        return None, "SCRAPERAPI_CREDITS_EXHAUSTED"
    if response.status_code != 200:
        return None, f"SCRAPERAPI_HTTP_{response.status_code}"
    return response.json(), "SUCCESS_SCRAPERAPI"


def _sleep_random_delay(
    context: RunContext, min_seconds: float, max_seconds: float
) -> None:
    delay_seconds = random.uniform(min_seconds, max_seconds)
    context.logger.info("Sleeping for random Coles delay %.3fs", delay_seconds)
    sleep_if_needed(delay_seconds)


def _extract_coles_product_data(
    product: dict[str, Any], brand_searched: str
) -> dict[str, Any]:
    pricing = product.get("pricing") or {}
    unit = pricing.get("unit") or {}
    restrictions = product.get("restrictions") or {}
    merchandise = product.get("merchandiseHeir") or {}
    online_heirs = product.get("onlineHeirs") or []
    multi_buy = pricing.get("multiBuyPromotion") or {}
    online_heir_0 = online_heirs[0] if online_heirs else {}
    image_uris = product.get("imageUris") or []
    first_image = image_uris[0] if image_uris else {}

    return {
        "Brand_Searched": brand_searched,
        "ProductId": product.get("id", ""),
        "Name": product.get("name", ""),
        "Brand": product.get("brand", ""),
        "Description": product.get("description", ""),
        "Size": product.get("size", ""),
        "Price_Now": pricing.get("now", 0),
        "Price_Was": pricing.get("was", 0),
        "SaveAmount": pricing.get("saveAmount", 0),
        "SaveStatement": pricing.get("saveStatement", ""),
        "UnitPrice": unit.get("price", 0),
        "UnitQuantity": unit.get("ofMeasureQuantity", 0),
        "UnitMeasure": unit.get("ofMeasureUnits", ""),
        "Comparable": pricing.get("comparable", ""),
        "PromotionType": pricing.get("promotionType", ""),
        "SpecialType": pricing.get("specialType", ""),
        "OnlineSpecial": pricing.get("onlineSpecial", False),
        "OfferDescription": pricing.get("offerDescription", ""),
        "MultiBuy_MinQuantity": multi_buy.get("minQuantity", 0),
        "MultiBuy_Reward": multi_buy.get("reward", 0),
        "Availability": product.get("availability", False),
        "AvailabilityType": product.get("availabilityType", ""),
        "AvailableQuantity": product.get("availableQuantity", 0),
        "RetailLimit": restrictions.get("retailLimit", 0),
        "PromotionalLimit": restrictions.get("promotionalLimit", 0),
        "LiquorRestricted": restrictions.get("liquorAgeRestrictionFlag", False),
        "TobaccoRestricted": restrictions.get("tobaccoAgeRestrictionFlag", False),
        "TradeProfitCentre": merchandise.get("tradeProfitCentre", ""),
        "CategoryGroup": merchandise.get("categoryGroup", ""),
        "Category": merchandise.get("category", ""),
        "SubCategory": merchandise.get("subCategory", ""),
        "ClassName": merchandise.get("className", ""),
        "OnlineAisle": online_heir_0.get("aisle", ""),
        "OnlineCategory": online_heir_0.get("category", ""),
        "OnlineSubCategory": online_heir_0.get("subCategory", ""),
        "ImageUri": first_image.get("uri", ""),
        "Timestamp": legacy_timestamp(),
    }


def _load_progress(progress_path: Path) -> dict[str, Any]:
    progress = load_json_file(
        progress_path, {"last_brand_index": -1, "products_collected": 0}
    )
    if not isinstance(progress, dict):
        return {"last_brand_index": -1, "products_collected": 0}
    return progress


def _save_progress(progress_path: Path, brand_index: int, products_count: int) -> None:
    save_json_file(
        progress_path,
        {
            "last_brand_index": brand_index,
            "products_collected": products_count,
            "timestamp": legacy_timestamp(),
        },
    )


def _save_checkpoint(
    checkpoint_path: Path,
    progress_path: Path,
    all_products: list[dict[str, Any]],
    brand_index: int,
) -> None:
    if all_products:
        write_csv_rows(checkpoint_path, all_products)
        _save_progress(progress_path, brand_index, len(all_products))


def run(context: RunContext) -> RunResult:
    settings = context.settings.coles
    state_dir = get_state_dir(
        context.settings.app.output_dir, context.source, context.runner
    )
    checkpoint_path = state_dir / "coles_checkpoint.csv"
    progress_path = state_dir / "coles_progress.json"

    brands = load_brand_queries(settings.brands_path)
    progress = _load_progress(progress_path)
    all_products = read_csv_rows(checkpoint_path)
    start_index = int(progress.get("last_brand_index", -1)) + 1
    fallback_hits = 0

    with context.tracer.start_as_current_span("coles.products") as span:
        span.set_attribute("brand_count", len(brands))

        with httpx.Client(
            timeout=settings.timeout_seconds, follow_redirects=True
        ) as client:
            cookies = parse_cookie_string(settings.cookie_string)
            build_id = _detect_build_id(
                client,
                context,
                settings.homepage_url,
                settings.fallback_build_id,
                cookies,
            )
            api_url = settings.api_base_template.format(build_id=build_id)
            context.logger.info("Using Coles build id %s", build_id)
            current_brand_index = max(start_index - 1, -1)

            try:
                for brand_index in range(start_index, len(brands)):
                    current_brand_index = brand_index
                    brand = brands[brand_index]
                    brand_products = 0

                    for page in range(1, settings.max_pages + 1):
                        payload, status = _search_direct(
                            client,
                            context,
                            api_url,
                            brand,
                            page,
                            settings.page_size,
                            cookies,
                        )
                        if (
                            payload is None
                            and settings.scraperapi_key
                            and status in {"BLOCKED_403", "RATE_LIMITED_429"}
                        ):
                            payload, status = _search_scraperapi(
                                client,
                                context,
                                api_url,
                                brand,
                                page,
                                settings.page_size,
                                settings.scraperapi_key,
                            )
                            fallback_hits += 1

                        if payload is None:
                            context.logger.warning(
                                "Coles request failed for brand=%s page=%s status=%s",
                                brand,
                                page,
                                status,
                            )
                            if status == "SCRAPERAPI_CREDITS_EXHAUSTED":
                                _save_checkpoint(
                                    checkpoint_path,
                                    progress_path,
                                    all_products,
                                    brand_index,
                                )
                                raise RuntimeError("ScraperAPI credits exhausted")
                            break

                        results = (
                            ((payload.get("pageProps") or {}).get("searchResults"))
                            or {}
                        ).get("results") or []
                        extracted = 0
                        for item in results:
                            if (
                                isinstance(item, dict)
                                and item.get("_type") == "PRODUCT"
                            ):
                                all_products.append(
                                    _extract_coles_product_data(item, brand)
                                )
                                extracted += 1

                        brand_products += extracted
                        context.logger.info(
                            "Fetched %s Coles records for brand=%s page=%s",
                            extracted,
                            brand,
                            page,
                        )
                        if extracted == 0 or extracted < settings.page_size:
                            break
                        _sleep_random_delay(
                            context,
                            settings.delay_seconds_min,
                            settings.delay_seconds_max,
                        )

                    if ((brand_index + 1) % AUTOSAVE_EVERY_N_BRANDS == 0) or (
                        brand_index == len(brands) - 1
                    ):
                        _save_checkpoint(
                            checkpoint_path, progress_path, all_products, brand_index
                        )

            except KeyboardInterrupt:
                _save_checkpoint(
                    checkpoint_path,
                    progress_path,
                    all_products,
                    max(current_brand_index, 0),
                )
                raise
            except Exception:
                _save_checkpoint(
                    checkpoint_path,
                    progress_path,
                    all_products,
                    max(current_brand_index, 0),
                )
                raise

    remove_file_if_exists(checkpoint_path)
    remove_file_if_exists(progress_path)

    return RunResult(
        records=all_products,
        metadata={
            "brand_count": len(brands),
            "fallback_hits": fallback_hits,
            "record_count": len(all_products),
        },
    )
