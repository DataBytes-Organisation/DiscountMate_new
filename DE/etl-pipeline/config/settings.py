from __future__ import annotations

import base64
import binascii
import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        extra="ignore",
        str_strip_whitespace=True,
        env_file=".env",
    )

    app_mode: str = Field(default="local", alias="APP_MODE")
    app_config_path: str = Field(default="config/config.yaml", alias="APP_CONFIG_PATH")
    app_config_base64: str | None = Field(default=None, alias="APP_CONFIG_BASE64")
    postgres_host: str = Field(default="127.0.0.1", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5433, alias="POSTGRES_PORT")
    postgres_database: str = Field(default="discountmate", alias="POSTGRES_DATABASE")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", alias="POSTGRES_PASSWORD")
    postgres_schema: str = Field(default="silver", alias="POSTGRES_SCHEMA")
    duckdb_home_directory: str = Field(
        default="/tmp/discountmate-duckdb/home",
        alias="DUCKDB_HOME_DIRECTORY",
    )
    duckdb_extension_directory: str = Field(
        default="/tmp/discountmate-duckdb/extensions",
        alias="DUCKDB_EXTENSION_DIRECTORY",
    )
    gcs_key_id: str | None = Field(default=None, alias="GCS_KEY_ID")
    gcs_secret: str | None = Field(default=None, alias="GCS_SECRET")

    def postgres_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_database}"
        )

    def postgres_duckdb_uri(self) -> str:
        encoded_user = quote(self.postgres_user, safe="")
        encoded_password = quote(self.postgres_password, safe="")
        encoded_database = quote(self.postgres_database, safe="")
        return (
            f"postgresql://{encoded_user}:{encoded_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{encoded_database}"
        )


class ModelRuntimeConfig(BaseModel):
    products: str | None = None
    products_glob: str | None = None
    coles_master: str | None = None


class RuntimePaths(BaseModel):
    bronze_root: str = "data/local_bronze"


class RuntimeConfig(BaseModel):
    mode: str = "local"
    paths: RuntimePaths
    models: dict[str, ModelRuntimeConfig]


def _expand_env_vars(value: object) -> object:
    if isinstance(value, dict):
        return {key: _expand_env_vars(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_expand_env_vars(item) for item in value]
    if isinstance(value, str):
        return os.path.expandvars(value)
    return value


def _load_runtime_config_dict_from_base64(encoded_config: str) -> dict[str, object]:
    try:
        decoded_bytes = base64.b64decode(encoded_config, validate=True)
    except binascii.Error as exc:
        raise RuntimeError(
            "APP_CONFIG_BASE64 is set but could not be base64-decoded."
        ) from exc

    try:
        decoded_text = decoded_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RuntimeError(
            "APP_CONFIG_BASE64 is set but does not decode to valid UTF-8 text."
        ) from exc

    try:
        raw_config = yaml.safe_load(decoded_text)
    except yaml.YAMLError as exc:
        raise RuntimeError(
            "APP_CONFIG_BASE64 is set but does not contain valid YAML."
        ) from exc

    if not isinstance(raw_config, dict):
        raise RuntimeError(
            "APP_CONFIG_BASE64 is set but did not decode to a YAML mapping."
        )

    return raw_config


def _load_runtime_config_dict_from_path(config_path: str) -> dict[str, object]:
    project_root = Path(__file__).resolve().parents[1]
    candidate = Path(config_path)
    resolved = candidate if candidate.is_absolute() else project_root / candidate
    with resolved.open("r", encoding="utf-8") as handle:
        raw_config = yaml.safe_load(handle)

    if not isinstance(raw_config, dict):
        raise RuntimeError(
            f"Runtime config at '{resolved}' did not parse to a YAML mapping."
        )

    return raw_config


def load_runtime_config(config_path: str | None = None) -> RuntimeConfig:
    settings = load_settings()
    if settings.app_config_base64:
        raw_config = _load_runtime_config_dict_from_base64(settings.app_config_base64)
    else:
        resolved_config_path = config_path or settings.app_config_path
        raw_config = _load_runtime_config_dict_from_path(resolved_config_path)

    return RuntimeConfig.model_validate(_expand_env_vars(raw_config))


@lru_cache(maxsize=1)
def load_settings() -> AppSettings:
    return AppSettings()
