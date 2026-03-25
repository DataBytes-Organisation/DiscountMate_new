from __future__ import annotations

import csv
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import httpx

def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def legacy_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def sleep_if_needed(delay_seconds: float) -> None:
    if delay_seconds > 0:
        time.sleep(delay_seconds)


def safe_str(value: Any) -> str:
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


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json_file(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False))
        handle.write("\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            rows.append(json.loads(raw))
    return rows


def write_csv_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_dir(path.parent)
    fieldnames: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)

    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_csv_rows(path: Path) -> list[dict[str, Any]]:
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
    logger: Any,
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
    logger: Any,
    source: str,
    method: str,
    url: str,
    request_context: str = "",
    **kwargs: Any,
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
    value: Any, prefix: str = "", keep_lists: bool = True
) -> dict[str, Any]:
    flattened: dict[str, Any] = {}
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


def normalize_record_keys(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    seen: dict[str, int] = {}
    for key, value in record.items():
        normalized_key = to_snake_case(str(key))
        count = seen.get(normalized_key, 0) + 1
        seen[normalized_key] = count
        final_key = normalized_key if count == 1 else f"{normalized_key}_{count}"
        normalized[final_key] = value
    return normalized


def load_brand_queries(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"Brand list CSV not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise RuntimeError(f"CSV has no header row: {path}")

        candidates = ("Brands", "brand", "BrandName", "brand_name", "name")
        field_name = next(
            (name for name in candidates if name in reader.fieldnames),
            reader.fieldnames[0],
        )

        brands: list[str] = []
        seen: set[str] = set()
        for row in reader:
            value = safe_str(row.get(field_name)).strip()
            if not value:
                continue
            dedupe_key = value.casefold()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            brands.append(value)
    return brands
