from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_BRANDS_CSV = "config/custom/optimal_brands.csv"
VALID_DESTINATIONS = {"local", "gcs"}


def _read_str(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value is not None else default


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return int(value)


def _read_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return float(value)


def _read_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _read_csv_values(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return tuple(part.strip().lower() for part in value.split(",") if part.strip())


def _validate_destinations(destinations: tuple[str, ...]) -> tuple[str, ...]:
    invalid = sorted(set(destinations) - VALID_DESTINATIONS)
    if invalid:
        raise ValueError(f"Unsupported APP_DESTINATIONS values: {', '.join(invalid)}")
    return destinations


def _resolve_path(root: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


@dataclass(frozen=True)
class AppSettings:
    output_dir: Path
    destinations: tuple[str, ...]
    log_level: str


@dataclass(frozen=True)
class TelemetrySettings:
    service_name: str
    otlp_endpoint: str
    otlp_headers: str
    enabled: bool


@dataclass(frozen=True)
class GCSSettings:
    bucket: str
    prefix: str
    credentials_path: str


@dataclass(frozen=True)
class AldiSettings:
    sitemap_url: str
    api_url: str
    currency: str
    page_size: int
    timeout_seconds: float
    delay_seconds: float


@dataclass(frozen=True)
class ColesSettings:
    brands_csv_path: Path
    homepage_url: str
    fallback_build_id: str
    api_base_template: str
    page_size: int
    max_pages: int
    timeout_seconds: float
    cookie_string: str
    scraperapi_key: str
    delay_seconds: float


@dataclass(frozen=True)
class IgaSettings:
    brands_csv_path: Path
    base_url: str
    store_id: int
    shopping_mode_cookie: str
    page_size: int
    timeout_seconds: float
    delay_seconds: float


@dataclass(frozen=True)
class WoolworthsSettings:
    brands_csv_path: Path
    api_url: str
    page_size: int
    max_pages: int
    timeout_seconds: float
    cookie_string: str
    scraperapi_key: str
    delay_seconds: float


@dataclass(frozen=True)
class Settings:
    repo_root: Path
    app: AppSettings
    telemetry: TelemetrySettings
    gcs: GCSSettings
    aldi: AldiSettings
    coles: ColesSettings
    iga: IgaSettings
    ww: WoolworthsSettings


def load_settings(repo_root: Path) -> Settings:
    output_dir = _resolve_path(repo_root, _read_str("APP_OUTPUT_DIR", ".output"))
    brands_csv_path = _resolve_path(
        repo_root, _read_str("APP_BRANDS_CSV_PATH", DEFAULT_BRANDS_CSV)
    )
    destinations = _validate_destinations(
        _read_csv_values("APP_DESTINATIONS", ("local",))
    )

    return Settings(
        repo_root=repo_root,
        app=AppSettings(
            output_dir=output_dir,
            destinations=destinations,
            log_level=_read_str("APP_LOG_LEVEL", "INFO"),
        ),
        telemetry=TelemetrySettings(
            service_name=_read_str("OTEL_SERVICE_NAME", "discount-mate-de"),
            otlp_endpoint=_read_str("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
            otlp_headers=_read_str("OTEL_EXPORTER_OTLP_HEADERS", ""),
            enabled=_read_bool("OTEL_ENABLED", True),
        ),
        gcs=GCSSettings(
            bucket=_read_str("GCS_BUCKET", ""),
            prefix=_read_str("GCS_PREFIX", "").strip("/"),
            credentials_path=_read_str("GOOGLE_APPLICATION_CREDENTIALS", ""),
        ),
        aldi=AldiSettings(
            sitemap_url=_read_str(
                "ALDI_SITEMAP_URL", "https://www.aldi.com.au/sitemap_categories.xml"
            ),
            api_url=_read_str(
                "ALDI_API_URL", "https://api.aldi.com.au/v3/product-search"
            ),
            currency=_read_str("ALDI_CURRENCY", "AUD"),
            page_size=_read_int("ALDI_PAGE_SIZE", 30),
            timeout_seconds=_read_float("ALDI_TIMEOUT_SECONDS", 25.0),
            delay_seconds=_read_float("ALDI_DELAY_SECONDS", 1.0),
        ),
        coles=ColesSettings(
            brands_csv_path=brands_csv_path,
            homepage_url=_read_str("COLES_HOMEPAGE_URL", "https://www.coles.com.au"),
            fallback_build_id=_read_str("COLES_BUILD_ID", ""),
            api_base_template=_read_str(
                "COLES_API_BASE_TEMPLATE",
                "https://www.coles.com.au/_next/data/{build_id}/en/search/products.json",
            ),
            page_size=_read_int("COLES_PAGE_SIZE", 48),
            max_pages=_read_int("COLES_MAX_PAGES", 8),
            timeout_seconds=_read_float("COLES_TIMEOUT_SECONDS", 20.0),
            cookie_string=_read_str("COLES_COOKIE_STRING", ""),
            scraperapi_key=_read_str("COLES_SCRAPERAPI_KEY", ""),
            delay_seconds=_read_float("COLES_DELAY_SECONDS", 1.0),
        ),
        iga=IgaSettings(
            brands_csv_path=brands_csv_path,
            base_url=_read_str("IGA_BASE_URL", "https://www.igashop.com.au"),
            store_id=_read_int("IGA_STORE_ID", 206686),
            shopping_mode_cookie=_read_str("IGA_SHOPPING_MODE_COOKIE", "Pickup"),
            page_size=_read_int("IGA_PAGE_SIZE", 50),
            timeout_seconds=_read_float("IGA_TIMEOUT_SECONDS", 20.0),
            delay_seconds=_read_float("IGA_DELAY_SECONDS", 0.5),
        ),
        ww=WoolworthsSettings(
            brands_csv_path=brands_csv_path,
            api_url=_read_str(
                "WW_API_URL", "https://www.woolworths.com.au/apis/ui/Search/products"
            ),
            page_size=_read_int("WW_PAGE_SIZE", 36),
            max_pages=_read_int("WW_MAX_PAGES", 5),
            timeout_seconds=_read_float("WW_TIMEOUT_SECONDS", 20.0),
            cookie_string=_read_str("WW_COOKIE_STRING", ""),
            scraperapi_key=_read_str("WW_SCRAPERAPI_KEY", ""),
            delay_seconds=_read_float("WW_DELAY_SECONDS", 1.0),
        ),
    )
