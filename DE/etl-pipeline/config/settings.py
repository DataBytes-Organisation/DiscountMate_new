from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

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
    postgres_host: str = Field(default="127.0.0.1", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5433, alias="POSTGRES_PORT")
    postgres_database: str = Field(default="discountmate", alias="POSTGRES_DATABASE")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", alias="POSTGRES_PASSWORD")
    postgres_schema: str = Field(default="silver", alias="POSTGRES_SCHEMA")

    def postgres_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_database}"
        )


class ModelRuntimeConfig(BaseModel):
    products: str


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


def load_runtime_config(config_path: str | None = None) -> RuntimeConfig:
    project_root = Path(__file__).resolve().parents[1]
    resolved_config_path = config_path or load_settings().app_config_path
    candidate = Path(resolved_config_path)
    resolved = candidate if candidate.is_absolute() else project_root / candidate
    with resolved.open("r", encoding="utf-8") as handle:
        raw_config = yaml.safe_load(handle)
    return RuntimeConfig.model_validate(_expand_env_vars(raw_config))


@lru_cache(maxsize=1)
def load_settings() -> AppSettings:
    return AppSettings()
