from __future__ import annotations

import json
import time
import xml.etree.ElementTree as element_tree
from typing import Any

import httpx

from util import (
    RunContext,
    RunResult,
    flatten_json,
    legacy_timestamp,
    request_with_debug,
    safe_str,
    sleep_if_needed,
    to_snake_case,
)


CORE_RENAME = {
    "Retailer": "retailer",
    "CategoryId_FromSitemap": "category_id_from_sitemap",
    "CategoryUrl_FromSitemap": "category_url_from_sitemap",
    "SKU": "sku",
    "Name": "name",
    "BrandName": "brand_name",
    "UrlSlugText": "url_slug",
    "ProductUrl": "product_url",
    "ImageUrl": "image_url",
    "PriceCents": "price_cents",
    "PriceDollars": "price_dollars",
    "PriceDisplay": "price_display",
    "Timestamp": "scraped_at",
    "RawJson": "raw_json",
    "ImageLocalPath": "image_local_path",
    "ImageWebPath": "image_web_path",
}
PREFERRED_ASSET_TYPES = ("FR01", "FR02", "NU01", "IN01")
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def _cents_to_dollars(cents: Any) -> float | str:
    if isinstance(cents, bool):
        return ""
    if isinstance(cents, (int, float)):
        return round(float(cents) / 100.0, 2)
    return ""


def _pick_asset(assets: Any) -> dict[str, Any]:
    if not isinstance(assets, list):
        return {}
    typed = [asset for asset in assets if isinstance(asset, dict) and asset.get("assetType")]
    for asset_type in PREFERRED_ASSET_TYPES:
        for asset in typed:
            if asset.get("assetType") == asset_type:
                return asset
    return typed[0] if typed else {}


def _category_urls(client: httpx.Client, context: RunContext, sitemap_url: str) -> list[str]:
    response = request_with_debug(
        client,
        context.logger,
        "aldi",
        "GET",
        sitemap_url,
        request_context="category_sitemap",
        headers={"User-Agent": USER_AGENT, "Accept": "application/xml,text/xml,*/*"},
    )
    response.raise_for_status()
    root = element_tree.fromstring(response.text)
    urls: list[str] = []
    for node in root.findall("sm:url", SITEMAP_NS):
        location = node.find("sm:loc", SITEMAP_NS)
        if location is not None and location.text:
            urls.append(location.text.strip())
    return urls


def _category_id(url: str) -> str:
    marker = "/k/"
    if marker not in url:
        return ""
    return url.rsplit(marker, 1)[-1].split("/", 1)[0]


def _normalize_aldi_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    seen: dict[str, int] = {}
    for key, value in record.items():
        normalized_key = CORE_RENAME.get(key, to_snake_case(key))
        count = seen.get(normalized_key, 0) + 1
        seen[normalized_key] = count
        final_key = normalized_key if count == 1 else f"{normalized_key}_{count}"
        normalized[final_key] = value
    return normalized


def _extract_records(
    category_id: str, category_url: str, payload: dict[str, Any]
) -> list[dict[str, Any]]:
    items = payload.get("data")
    if not isinstance(items, list):
        return []

    records: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue

        pricing = item.get("price") or {}
        chosen_asset = _pick_asset(item.get("assets") or [])
        image_url = safe_str(chosen_asset.get("url")) if chosen_asset else ""
        slug = safe_str(item.get("urlSlugText"))
        flat = flatten_json(item, "aldi", keep_lists=True)

        row = {
            **flat,
            "Retailer": "ALDI",
            "CategoryId_FromSitemap": category_id,
            "CategoryUrl_FromSitemap": category_url,
            "SKU": safe_str(item.get("sku") or item.get("id") or item.get("productId")),
            "Name": safe_str(item.get("name") or item.get("title") or item.get("displayName")),
            "BrandName": safe_str(item.get("brandName") or item.get("brand")),
            "UrlSlugText": slug,
            "ProductUrl": f"https://www.aldi.com.au/groceries/{slug.strip('/')}/" if slug else "",
            "ImageUrl": image_url,
            "ImageLocalPath": "",
            "ImageWebPath": "",
            "PriceCents": pricing.get("amount", ""),
            "PriceDollars": _cents_to_dollars(pricing.get("amount")),
            "PriceDisplay": safe_str(pricing.get("amountRelevantDisplay") or pricing.get("amountDisplay")),
            "Timestamp": legacy_timestamp(),
            "RawJson": json.dumps(item, ensure_ascii=False),
        }
        records.append(_normalize_aldi_record(row))
    return records


def run(context: RunContext) -> RunResult:
    settings = context.settings.aldi
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.aldi.com.au",
        "Referer": "https://www.aldi.com.au/",
    }
    all_records: list[dict[str, Any]] = []
    category_count = 0

    with context.tracer.start_as_current_span("aldi.products") as span:
        span.set_attribute("source", context.source)
        span.set_attribute("runner", context.runner)

        with httpx.Client(timeout=settings.timeout_seconds, follow_redirects=True) as client:
            for category_url in _category_urls(client, context, settings.sitemap_url):
                category_id = _category_id(category_url)
                if not category_id:
                    continue

                category_count += 1
                offset = 0
                while True:
                    response = request_with_debug(
                        client,
                        context.logger,
                        "aldi",
                        "GET",
                        settings.api_url,
                        request_context=f"category_id={category_id} offset={offset}",
                        headers=headers,
                        params={
                            "currency": settings.currency,
                            "limit": settings.page_size,
                            "offset": offset,
                            "sort": "relevance",
                            "categoryTree": category_id,
                        },
                    )
                    try:
                        response.raise_for_status()
                        batch = _extract_records(category_id, category_url, response.json())
                        if not batch:
                            break
                        all_records.extend(batch)
                        context.logger.info(
                            "Fetched %s ALDI records for category=%s offset=%s",
                            len(batch),
                            category_id,
                            offset,
                        )
                        if len(batch) < settings.page_size:
                            break
                        offset += settings.page_size
                        sleep_if_needed(settings.delay_seconds)
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 400:
                            context.logger.warn(
                                "Skipping url: %s, (limit=%s, offset=%s).\n Error: %s",
                                category_url,
                                settings.page_size,
                                offset,
                                e.response.text,
                            )
                            break
                        else:
                            raise e

    return RunResult(
        records=all_records,
        metadata={"category_count": category_count, "record_count": len(all_records)},
    )
