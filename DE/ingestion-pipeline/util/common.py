from __future__ import annotations

import csv
import json
import re
import time
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import yaml

if TYPE_CHECKING:
    import logging
    from pathlib import Path

    import httpx


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def legacy_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def sleep_if_needed(delay_seconds: float) -> None:
    if delay_seconds > 0:
        time.sleep(delay_seconds)


def safe_str(value: object) -> str:
    return "" if value is None else str(value)


def parse_cookie_string(cookie_string: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for item in cookie_string.split(";"):
        raw = item.strip()
        if not raw or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_json_file[T](path: Path, default: T) -> T:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json_file(path: Path, payload: object) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def append_jsonl(path: Path, payload: dict[str, object]) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False))
        handle.write("\n")


def read_jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    rows: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            rows.append(json.loads(raw))
    return rows


def write_csv_rows(path: Path, rows: list[dict[str, object]]) -> None:
    ensure_dir(path.parent)
    fieldnames: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)

    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [dict(row) for row in reader]


def remove_file_if_exists(path: Path) -> None:
    if path.exists():
        path.unlink()


def get_state_dir(output_dir: Path, source: str, runner: str) -> Path:
    return output_dir / source / runner / "state"


def log_request_debug(
    logger: logging.LoggerAdapter,
    source: str,
    method: str,
    url: str,
    request_context: str = "",
    response: httpx.Response | None = None,
    duration_seconds: float | None = None,
) -> None:
    if response is None:
        message = f"{source} request {method} {url}"
        if request_context:
            message += f" {request_context}"
        logger.debug(message)
        return

    status = response.status_code
    duration_ms = 0.0 if duration_seconds is None else duration_seconds * 1000.0
    message = f"{source} response {method} {url} status={status} duration_ms={duration_ms:.2f}"
    if request_context:
        message += f" {request_context}"
    logger.debug(message)


def request_with_debug(
    client: httpx.Client,
    logger: logging.LoggerAdapter,
    source: str,
    method: str,
    url: str,
    request_context: str = "",
    **kwargs: Any,  # noqa: ANN401
) -> httpx.Response:
    log_request_debug(logger, source, method, url, request_context=request_context)
    started = time.perf_counter()
    response = client.request(method, url, **kwargs)
    duration = time.perf_counter() - started
    log_request_debug(
        logger,
        source,
        method,
        url,
        request_context=request_context,
        response=response,
        duration_seconds=duration,
    )
    return response


def flatten_json(
    value: object, prefix: str = "", keep_lists: bool = True
) -> dict[str, object]:
    flattened: dict[str, object] = {}
    if isinstance(value, dict):
        for key, nested_value in value.items():
            nested_prefix = f"{prefix}.{key}" if prefix else str(key)
            flattened.update(flatten_json(nested_value, nested_prefix, keep_lists))
        return flattened
    if isinstance(value, list):
        if keep_lists:
            flattened[prefix] = json.dumps(value, ensure_ascii=False)
            return flattened
        for index, nested_value in enumerate(value):
            nested_prefix = f"{prefix}.{index}" if prefix else str(index)
            flattened.update(flatten_json(nested_value, nested_prefix, keep_lists))
        return flattened
    flattened[prefix] = value
    return flattened


def to_snake_case(value: str) -> str:
    value = re.sub(r"[^\w\.]+", "_", value.strip())
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    value = value.replace(".", "_")
    value = re.sub(r"_+", "_", value).strip("_")
    return value.lower()


def normalize_record_keys(record: dict[str, object]) -> dict[str, object]:
    normalized: dict[str, object] = {}
    seen: dict[str, int] = {}
    for key, value in record.items():
        normalized_key = to_snake_case(str(key))
        count = seen.get(normalized_key, 0) + 1
        seen[normalized_key] = count
        final_key = normalized_key if count == 1 else f"{normalized_key}_{count}"
        normalized[final_key] = value
    return normalized


def _load_brand_rows_from_yaml(path: Path) -> list[dict[str, str | None]]:
    with path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)

    if not isinstance(payload, dict):
        raise RuntimeError(f"Brand YAML must contain a top-level mapping: {path}")

    raw_rows = payload.get("brands")
    if not isinstance(raw_rows, list):
        raise RuntimeError(f"Brand YAML must contain a top-level 'brands' list: {path}")

    rows: list[dict[str, str | None]] = []
    for raw_row in raw_rows:
        if not isinstance(raw_row, dict):
            raise RuntimeError(f"Each brand entry must be a mapping: {path}")

        name = raw_row.get("name")
        retailer_specific = raw_row.get("retailer_specific")
        if not isinstance(name, str):
            raise RuntimeError(f"Each brand entry must include a string 'name': {path}")
        if retailer_specific is not None and not isinstance(retailer_specific, str):
            raise RuntimeError(
                f"'retailer_specific' must be a string or null in {path}"
            )

        rows.append(
            {
                "name": name,
                "retailer_specific": retailer_specific,
            }
        )

    return rows


def load_brand_queries(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"Brand list file not found: {path}")

    suffix = path.suffix.lower()
    if suffix not in {".yml", ".yaml"}:
        raise RuntimeError(f"Unsupported brand list format for {path}")

    rows = _load_brand_rows_from_yaml(path)
    field_name = "name"

    brands: list[str] = []
    seen: set[str] = set()
    for row in rows:
        value = safe_str(row.get(field_name)).strip()
        if not value:
            continue
        dedupe_key = value.casefold()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        brands.append(value)
    return brands
