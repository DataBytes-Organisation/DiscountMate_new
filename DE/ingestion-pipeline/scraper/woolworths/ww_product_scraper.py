from __future__ import annotations

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
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
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
        "ww",
        "GET",
        api_url,
        request_context=f"brand={brand!r} page={page_number} direct",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Referer": "https://www.woolworths.com.au/",
        },
        params={"searchTerm": brand, "pageSize": page_size, "pageNumber": page_number},
        cookies=cookies or None,
    )
    if response.status_code == 403:
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
        "ww",
        "GET",
        "http://api.scraperapi.com",
        request_context=f"brand={brand!r} page={page_number} scraperapi",
        params={
            "api_key": scraperapi_key,
            "url": f"{api_url}?searchTerm={brand}&pageSize={page_size}&pageNumber={page_number}",
            "render": "false",
        },
    )
    if response.status_code == 403:
        return None, "SCRAPERAPI_CREDITS_EXHAUSTED"
    if response.status_code != 200:
        return None, f"SCRAPERAPI_HTTP_{response.status_code}"
    return response.json(), "SUCCESS_SCRAPERAPI"


def _extract_product_data(
    product: dict[str, Any], brand_searched: str
) -> dict[str, Any]:
    additional_attrs = product.get("AdditionalAttributes", {}) or {}
    centre_tag = product.get("CentreTag", {}) or {}

    return {
        "Brand_Searched": brand_searched,
        "Stockcode": product.get("Stockcode", ""),
        "Barcode": product.get("Barcode", ""),
        "Name": product.get("Name", ""),
        "DisplayName": product.get("DisplayName", ""),
        "UrlFriendlyName": product.get("UrlFriendlyName", ""),
        "Description": product.get("Description", "").replace("<br>", " ")
        if product.get("Description")
        else "",
        "FullDescription": product.get("FullDescription", ""),
        "PackageSize": product.get("PackageSize", ""),
        "Price": product.get("Price", 0),
        "InstorePrice": product.get("InstorePrice", 0),
        "WasPrice": product.get("WasPrice", 0),
        "InstoreWasPrice": product.get("InstoreWasPrice", 0),
        "IsOnSpecial": product.get("IsOnSpecial", False),
        "InstoreIsOnSpecial": product.get("InstoreIsOnSpecial", False),
        "SavingsAmount": product.get("SavingsAmount", 0),
        "InstoreSavingsAmount": product.get("InstoreSavingsAmount", 0),
        "CupPrice": product.get("CupPrice", 0),
        "CupMeasure": product.get("CupMeasure", ""),
        "CupString": product.get("CupString", ""),
        "IsHalfPrice": product.get("IsHalfPrice", False),
        "IsOnlineOnly": product.get("IsOnlineOnly", False),
        "IsNew": product.get("IsNew", False),
        "IsInStock": product.get("IsInStock", False),
        "IsAvailable": product.get("IsAvailable", False),
        "SupplyLimit": product.get("SupplyLimit", 0),
        "ProductLimit": product.get("ProductLimit", 0),
        "Unit": product.get("Unit", ""),
        "MinimumQuantity": product.get("MinimumQuantity", 0),
        "SmallImageFile": product.get("SmallImageFile", ""),
        "MediumImageFile": product.get("MediumImageFile", ""),
        "LargeImageFile": product.get("LargeImageFile", ""),
        "AgeRestricted": product.get("AgeRestricted", False),
        "IsForDelivery": product.get("IsForDelivery", False),
        "IsForCollection": product.get("IsForCollection", False),
        "IsForExpress": product.get("IsForExpress", False),
        "ProductRestrictionMessage": product.get("ProductRestrictionMessage", ""),
        "ProductWarningMessage": product.get("ProductWarningMessage", ""),
        "SupplyLimitMessage": product.get("SupplyLimitMessage", ""),
        "HealthStarRating": additional_attrs.get("healthstarrating", ""),
        "CountryOfOrigin": additional_attrs.get("countryoforigin", ""),
        "Ingredients": additional_attrs.get("ingredients", ""),
        "AllergyStatement": additional_attrs.get("allergystatement", ""),
        "LifestyleAndDietaryStatement": additional_attrs.get(
            "lifestyleanddietarystatement", ""
        ),
        "StorageInstructions": additional_attrs.get("storageinstructions", ""),
        "ContainsGluten": additional_attrs.get("containsgluten", ""),
        "ContainsNuts": additional_attrs.get("containsnuts", ""),
        "SapDepartmentName": additional_attrs.get("sapdepartmentname", ""),
        "SapCategoryName": additional_attrs.get("sapcategoryname", ""),
        "SapSubCategoryName": additional_attrs.get("sapsubcategoryname", ""),
        "CentreTagType": centre_tag.get("TagType", ""),
        "PromotionType": centre_tag.get("PromotionType", ""),
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
    settings = context.settings.ww
    state_dir = get_state_dir(
        context.settings.app.output_dir, context.source, context.runner
    )
    checkpoint_path = state_dir / "woolworths_checkpoint.csv"
    progress_path = state_dir / "woolworths_progress.json"

    brands = load_brand_queries(settings.brands_path)
    progress = _load_progress(progress_path)
    all_products = read_csv_rows(checkpoint_path)
    start_index = int(progress.get("last_brand_index", -1)) + 1
    fallback_hits = 0
    cookies = parse_cookie_string(settings.cookie_string)

    with context.tracer.start_as_current_span("ww.products") as span:
        span.set_attribute("brand_count", len(brands))

        with httpx.Client(
            timeout=settings.timeout_seconds, follow_redirects=True
        ) as client:
            current_brand_index = max(start_index - 1, -1)
            try:
                for brand_index in range(start_index, len(brands)):
                    current_brand_index = brand_index
                    brand = brands[brand_index]

                    for page in range(1, settings.max_pages + 1):
                        payload, status = _search_direct(
                            client,
                            context,
                            settings.api_url,
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
                                settings.api_url,
                                brand,
                                page,
                                settings.page_size,
                                settings.scraperapi_key,
                            )
                            fallback_hits += 1

                        if payload is None:
                            context.logger.warning(
                                "WW request failed for brand=%s page=%s status=%s",
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

                        wrappers = payload.get("Products")
                        if not isinstance(wrappers, list) or not wrappers:
                            break

                        extracted = 0
                        for wrapper in wrappers:
                            products = []
                            if isinstance(wrapper, dict) and isinstance(
                                wrapper.get("Products"), list
                            ):
                                products = wrapper["Products"]
                            elif isinstance(wrapper, dict):
                                products = [wrapper]

                            for product in products:
                                if isinstance(product, dict) and "Stockcode" in product:
                                    all_products.append(
                                        _extract_product_data(product, brand)
                                    )
                                    extracted += 1

                        context.logger.info(
                            "Fetched %s WW records for brand=%s page=%s",
                            extracted,
                            brand,
                            page,
                        )
                        if extracted == 0 or extracted < settings.page_size:
                            break
                        sleep_if_needed(settings.delay_seconds)

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
