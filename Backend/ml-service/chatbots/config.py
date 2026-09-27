"""Configuration helpers for DiscountMate chatbot tools."""

import os

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


BACKEND_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
ENV_PATH = os.path.join(BACKEND_ROOT, ".env")

def _load_simple_env(path: str):
    """Small .env fallback used when python-dotenv is unavailable."""
    with open(path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


if load_dotenv is None and os.path.exists(ENV_PATH):
    _load_simple_env(ENV_PATH)
elif load_dotenv is not None and os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH, override=False)
elif load_dotenv is not None:
    load_dotenv(override=False)


MONGO_URI = os.getenv("MONGO_URI", "").strip()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "DiscountMate_DB").strip()
CURRENCY = os.getenv("CHATBOT_CURRENCY", "AUD").strip() or "AUD"
