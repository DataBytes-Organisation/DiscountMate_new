from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEFAULT_BRANDS_PATH = "config/custom/optimal_brands.yml"
VALID_DESTINATIONS = {"local", "gcs"}


def _validate_destinations(destinations: tuple[str, ...]) -> tuple[str, ...]:
    invalid = sorted(set(destinations) - VALID_DESTINATIONS)
    if invalid:
        raise ValueError(f"Unsupported APP_DESTINATIONS values: {', '.join(invalid)}")
    return destinations


def _validate_delay_window(
    min_seconds: float, max_seconds: float, env_prefix: str
) -> tuple[float, float]:
    if min_seconds < 0:
        raise ValueError(f"{env_prefix}_DELAY_SECONDS_MIN must be >= 0")
    if max_seconds < 0:
        raise ValueError(f"{env_prefix}_DELAY_SECONDS_MAX must be >= 0")
    if min_seconds > max_seconds:
        raise ValueError(
            f"{env_prefix}_DELAY_SECONDS_MIN must be <= {env_prefix}_DELAY_SECONDS_MAX"
        )
    return min_seconds, max_seconds


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="APP_",
        env_file=".env",
    )

    output_dir: Path = Field(
        default=Path(".output"),
        description="Root directory where scraper output is written.",
    )
    brands_path: Path = Field(
        default=Path(DEFAULT_BRANDS_PATH),
        description="Path to the YAML file containing default brand search queries.",
    )
    destinations: Annotated[tuple[str, ...], NoDecode] = Field(
        default=("local",),
        description="Configured output destinations for persisted scraper artifacts.",
    )
    log_level: str = Field(default="INFO", description="Application logging level.")

    @field_validator("destinations", mode="before")
    @classmethod
    def _parse_destinations(cls, value: str | tuple[str, ...]) -> tuple[str, ...]:
        print(value)
        if isinstance(value, tuple):
            return _validate_destinations(tuple(part.lower() for part in value))
        return _validate_destinations(
            tuple(part.strip().lower() for part in value.split(",") if part.strip())
        )


class TelemetrySettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="OTEL_",
        env_file=".env",
    )

    service_name: str = Field(
        default="discount-mate-de",
        description="OpenTelemetry service name.",
    )
    otlp_endpoint: str = Field(
        default="",
        validation_alias="OTEL_EXPORTER_OTLP_ENDPOINT",
        description="OTLP exporter endpoint URL.",
    )
    otlp_headers: str = Field(
        default="",
        validation_alias="OTEL_EXPORTER_OTLP_HEADERS",
        description="Comma-separated OTLP exporter headers.",
    )
    enabled: bool = Field(
        default=True, description="Whether telemetry export is enabled."
    )


class GCSSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="GCS_",
        env_file=".env",
    )

    bucket: str = Field(default="", description="Google Cloud Storage bucket name.")
    prefix: str = Field(
        default="", description="Optional path prefix applied to uploaded GCS objects."
    )
    credentials_path: str = Field(
        default="",
        validation_alias="GOOGLE_APPLICATION_CREDENTIALS",
        description="Path to Google application credentials used for GCS access.",
    )

    @field_validator("prefix")
    @classmethod
    def _normalize_prefix(cls, value: str) -> str:
        return value.strip("/")


class AldiSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="ALDI_",
        env_file=".env",
    )

    brands_path: Path = Field(
        default=Path(DEFAULT_BRANDS_PATH),
        description="Path to the YAML file containing ALDI brand search queries.",
    )
    sitemap_url: str = Field(
        default="https://www.aldi.com.au/sitemap_categories.xml",
        description="ALDI sitemap URL used to discover category pages.",
    )
    api_url: str = Field(
        default="https://api.aldi.com.au/v3/product-search",
        description="ALDI product search API endpoint.",
    )
    currency: str = Field(
        default="AUD", description="Currency code sent to the ALDI API."
    )
    page_size: int = Field(
        default=30, description="Number of ALDI products requested per page."
    )
    timeout_seconds: float = Field(
        default=25.0, description="HTTP timeout for ALDI requests in seconds."
    )
    delay_seconds: float = Field(
        default=1.0,
        description="Fixed delay between ALDI pagination requests in seconds.",
    )


class ColesSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="COLES_",
        env_file=".env",
    )

    brands_path: Path = Field(
        default=Path(DEFAULT_BRANDS_PATH),
        description="Path to the YAML file containing Coles brand search queries.",
    )
    homepage_url: str = Field(
        default="https://www.coles.com.au",
        description="Coles homepage URL used for build ID detection.",
    )
    fallback_build_id: str = Field(
        default="",
        description="Optional explicit Coles build ID used instead of homepage detection.",
    )
    api_base_template: str = Field(
        default="https://www.coles.com.au/_next/data/{build_id}/en/search/products.json",
        description="Coles API URL template containing a {build_id} placeholder.",
    )
    page_size: int = Field(
        default=48, description="Number of Coles products requested per page."
    )
    max_pages: int = Field(
        default=8, description="Maximum number of Coles result pages per brand."
    )
    timeout_seconds: float = Field(
        default=20.0, description="HTTP timeout for Coles requests in seconds."
    )
    cookie_string: str = Field(
        default="", description="Raw cookie header string supplied to Coles requests."
    )
    scraperapi_key: str = Field(
        default="",
        description="Optional ScraperAPI key used when direct Coles requests are blocked.",
    )
    delay_seconds_min: float = Field(
        default=1.0,
        description="Minimum random delay between Coles pagination requests in seconds.",
    )
    delay_seconds_max: float = Field(
        default=1.0,
        description="Maximum random delay between Coles pagination requests in seconds.",
    )

    @field_validator("delay_seconds_max")
    @classmethod
    def _validate_delay_bounds(cls, value: float, info: ValidationInfo) -> float:
        min_seconds = info.data.get("delay_seconds_min")
        if min_seconds is None:
            return value
        _validate_delay_window(min_seconds, value, "COLES")
        return value


class IgaSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="IGA_",
        env_file=".env",
    )

    brands_path: Path = Field(
        default=Path(DEFAULT_BRANDS_PATH),
        description="Path to the YAML file containing IGA brand search queries.",
    )
    base_url: str = Field(
        default="https://www.igashop.com.au",
        description="IGA storefront base URL.",
    )
    store_id: int = Field(
        default=206686,
        description="IGA store identifier used in API requests.",
    )
    shopping_mode_cookie: str = Field(
        default="Pickup",
        description="IGA shopping mode cookie value sent with requests.",
    )
    page_size: int = Field(
        default=50, description="Number of IGA products requested per page."
    )
    timeout_seconds: float = Field(
        default=20.0, description="HTTP timeout for IGA requests in seconds."
    )
    delay_seconds: float = Field(
        default=0.5,
        description="Fixed delay between IGA pagination requests in seconds.",
    )


class WoolworthsSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_prefix="WW_",
        env_file=".env",
    )

    brands_path: Path = Field(
        default=Path(DEFAULT_BRANDS_PATH),
        description="Path to the YAML file containing Woolworths brand search queries.",
    )
    api_url: str = Field(
        default="https://www.woolworths.com.au/apis/ui/Search/products",
        description="Woolworths product search API endpoint.",
    )
    page_size: int = Field(
        default=36, description="Number of Woolworths products requested per page."
    )
    max_pages: int = Field(
        default=5, description="Maximum number of Woolworths result pages per brand."
    )
    timeout_seconds: float = Field(
        default=20.0, description="HTTP timeout for Woolworths requests in seconds."
    )
    cookie_string: str = Field(
        default="",
        description="Raw cookie header string supplied to Woolworths requests.",
    )
    scraperapi_key: str = Field(
        default="",
        description="Optional ScraperAPI key used when direct Woolworths requests are blocked.",
    )
    delay_seconds: float = Field(
        default=1.0,
        description="Fixed delay between Woolworths pagination requests in seconds.",
    )


class Settings(BaseModel):
    app: AppSettings = Field(description="Application-level scraper settings.")
    telemetry: TelemetrySettings = Field(description="Telemetry configuration.")
    gcs: GCSSettings = Field(description="Google Cloud Storage configuration.")
    aldi: AldiSettings = Field(description="ALDI scraper configuration.")
    coles: ColesSettings = Field(description="Coles scraper configuration.")
    iga: IgaSettings = Field(description="IGA scraper configuration.")
    ww: WoolworthsSettings = Field(description="Woolworths scraper configuration.")


@lru_cache(maxsize=1)
def load_settings() -> Settings:
    raw_app = AppSettings()
    app = raw_app
    telemetry = TelemetrySettings()
    gcs = GCSSettings()
    shared_brands_path = app.brands_path
    aldi = AldiSettings().model_copy(update={"brands_path": shared_brands_path})
    coles = ColesSettings().model_copy(update={"brands_path": shared_brands_path})
    iga = IgaSettings().model_copy(update={"brands_path": shared_brands_path})
    ww = WoolworthsSettings().model_copy(update={"brands_path": shared_brands_path})

    return Settings(
        app=app,
        telemetry=telemetry,
        gcs=gcs,
        aldi=aldi,
        coles=coles,
        iga=iga,
        ww=ww,
    )
