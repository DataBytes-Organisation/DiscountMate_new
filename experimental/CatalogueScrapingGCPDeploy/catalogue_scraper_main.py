"""
Catalogue scraping and orchestration entrypoint.

Stage layout:
1. Download or refresh catalogue page images.
2. Run tile detection.
3. Run zone detection.
4. Run OCR.

This file owns pipeline orchestration, resolved configuration, incremental
selection, GCS coordination, run manifests, and the original Stage 1 download
logic.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import random
import re
import shutil
import sys
import traceback
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence
from uuid import uuid4

import pandas as pd
import requests
import urllib3

import catalogue_ocr
import catalogue_tile_detection
import catalogue_zone_detection
from catalogue_pipeline_common import (
    CatalogueStageOutcome,
    CatalogueWorkItem,
    FailureDetail,
    IncrementalDecision,
    StageResult,
    utc_now_iso,
)

try:
    from google.cloud import storage
except ImportError:  # pragma: no cover - handled in preflight.
    storage = None


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CATALOGUES_DIR = SCRIPT_DIR / "catalogues"
DEFAULT_DATA_DIR = SCRIPT_DIR / "catalogue_data"
DEFAULT_PIPELINE_RUNS_DIR = DEFAULT_DATA_DIR / "pipeline_runs"
DEFAULT_LOG_DIR = DEFAULT_DATA_DIR / "logs"
DEFAULT_MODELS_DIR = Path("/tmp/models")

TRACKING_CSV = Path("catalogue_data/catalogue_tracking.csv")
TRACKING_JSON = Path("catalogue_data/catalogue_tracking.json")
MASTER_ZONE_CSV = Path("catalogue_data/historical_zone_detections.csv")
MASTER_OCR_RESULTS_CSV = Path("catalogue_data/historical_ocr_results.csv")
MASTER_OCR_ATTEMPTS_CSV = Path("catalogue_data/historical_ocr_attempts.csv")

PAGE_IMAGE_PATTERN = re.compile(r"page_\d+\.(jpg|jpeg|png|webp)$", re.IGNORECASE)
CONTROL_ARTIFACTS = [
    TRACKING_CSV,
    TRACKING_JSON,
    MASTER_ZONE_CSV,
    MASTER_OCR_RESULTS_CSV,
    MASTER_OCR_ATTEMPTS_CSV,
]
STAGE_OUTPUT_MAP = {
    "stage_2_tile_detection": [
        "detections.csv",
        "exported_tiles",
    ],
    "stage_3_zone_detection": [
        "zone_detections.csv",
        "exported_zones",
    ],
    "stage_4_ocr": [
        "ocr_results.csv",
        "ocr_attempts.csv",
    ],
}


def _env(name: str) -> Optional[str]:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _env_bool(name: str, default: bool = False) -> bool:
    value = _env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}


def _env_int(name: str, default: Optional[int] = None) -> Optional[int]:
    value = _env(name)
    if value is None:
        return default
    return int(value)


def _env_float(name: str, default: Optional[float] = None) -> Optional[float]:
    value = _env(name)
    if value is None:
        return default
    return float(value)


def _env_list(name: str) -> Optional[List[str]]:
    value = _env(name)
    if value is None:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def _safe_int(value: Any, default: int = 0) -> int:
    if pd.isna(value):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any) -> bool:
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _jsonable(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {key: _jsonable(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


@dataclass
class DownloadConfig:
    stores: List[str]
    years: List[int]
    mode: str
    storage_type: str


@dataclass
class Stage2Config:
    imgsz: int
    conf: float
    limit_catalogues: Optional[int]
    limit_images: Optional[int]
    weights_path: Path
    model_blob: Optional[str]
    model_checksum: Optional[str]
    model_generation: Optional[str]


@dataclass
class Stage3Config:
    imgsz: int
    conf: float
    iou: float
    limit_catalogues: Optional[int]
    limit_tiles: Optional[int]
    weights_path: Path
    model_blob: Optional[str]
    model_checksum: Optional[str]
    model_generation: Optional[str]


@dataclass
class Stage4Config:
    limit_catalogues: Optional[int]
    limit_tiles: Optional[int]
    tesseract_cmd: Optional[str]


@dataclass
class GCPConfig:
    enabled: bool
    project_id: Optional[str]
    bucket_name: Optional[str]
    local_work_root: Path
    models_local_dir: Path
    run_id: str
    scheduler_job: Optional[str]
    scheduler_schedule: Optional[str]


@dataclass
class PipelineConfig:
    pipeline_mode: str
    download: DownloadConfig
    stage2: Stage2Config
    stage3: Stage3Config
    stage4: Stage4Config
    gcp: GCPConfig
    script_dir: Path
    catalogues_dir: Path
    data_dir: Path
    pipeline_runs_dir: Path
    log_dir: Path
    failure_policy: str
    cleanup_local_artifacts: bool
    force_catalogues: List[str] = field(default_factory=list)
    force_all: bool = False

    def to_manifest(self) -> Dict[str, Any]:
        payload = asdict(self)
        return _jsonable(payload)


def setup_pipeline_logging(run_id: str) -> tuple[logging.Logger, Path]:
    DEFAULT_LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = DEFAULT_LOG_DIR / f"catalogue_pipeline_{run_id}.log"

    logger = logging.getLogger("catalogue_pipeline")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    formatter = logging.Formatter("%(message)s")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(formatter)
    logger.addHandler(stdout_handler)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers.clear()
    root_logger.addHandler(stdout_handler)
    root_logger.addHandler(file_handler)
    return logger, log_file


def log_event(logger: logging.Logger, event_type: str, **fields: Any) -> None:
    payload = {
        "timestamp": utc_now_iso(),
        "event_type": event_type,
        **{key: _jsonable(value) for key, value in fields.items()},
    }
    logger.info(json.dumps(payload, ensure_ascii=False, sort_keys=True))


class CatalogueDateParser:
    MONTH_MAP = {
        "january": "01",
        "february": "02",
        "march": "03",
        "april": "04",
        "may": "05",
        "june": "06",
        "july": "07",
        "august": "08",
        "september": "09",
        "october": "10",
        "november": "11",
        "december": "12",
    }

    @classmethod
    def extract_date_from_slug(cls, slug: str) -> Optional[str]:
        if not slug:
            return None

        for month_name, month_num in cls.MONTH_MAP.items():
            if month_name in slug.lower():
                pattern = rf"{month_name}-(\d{{1,2}})-(?:\d{{1,2}}-)?(\d{{4}})"
                match = re.search(pattern, slug.lower())
                if match:
                    day = match.group(1).zfill(2)
                    year = match.group(2)
                    return f"{year}-{month_num}-{day}"
        return None


class BackupManager:
    @staticmethod
    def backup_folder_structure(source_folder: str) -> Optional[str]:
        if not os.path.exists(source_folder):
            logging.info("No existing folder to backup: %s", source_folder)
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_folder = f"{source_folder}_backup_{timestamp}"
        try:
            shutil.copytree(source_folder, backup_folder)
            return backup_folder
        except Exception as exc:
            logging.error("Backup error: %s", exc)
            return None

    @staticmethod
    def backup_tracking_file(file_path: str) -> Optional[str]:
        if not os.path.exists(file_path):
            return None
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{file_path}.backup_{timestamp}"
        try:
            shutil.copy2(file_path, backup_path)
            return backup_path
        except Exception as exc:
            logging.error("Tracking backup error: %s", exc)
            return None


class CatalogueDatabase:
    def __init__(self, storage_type: str = "csv", base_path: str = "catalogue_data"):
        self.storage_type = storage_type
        self.base_path = base_path
        self.csv_file = os.path.join(base_path, "catalogue_tracking.csv")
        self.json_file = os.path.join(base_path, "catalogue_tracking.json")
        os.makedirs(base_path, exist_ok=True)

    def load_existing_records(self) -> pd.DataFrame:
        if self.storage_type == "json" and os.path.exists(self.json_file):
            with open(self.json_file, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            return pd.DataFrame(data)
        if os.path.exists(self.csv_file):
            return pd.read_csv(self.csv_file)
        return pd.DataFrame()

    def save_records(self, df: pd.DataFrame, backup: bool = False) -> None:
        if backup:
            BackupManager.backup_tracking_file(self.csv_file)
            BackupManager.backup_tracking_file(self.json_file)

        df.to_csv(self.csv_file, index=False)
        if self.storage_type == "json":
            with open(self.json_file, "w", encoding="utf-8") as handle:
                json.dump(df.to_dict("records"), handle, indent=2, ensure_ascii=False)


class CatalogueMetadataTracker:
    def __init__(self) -> None:
        self.catalogues: List[Dict[str, Any]] = []

    def parse_catalogue_metadata(self, raw_cat: Dict[str, Any]) -> Dict[str, Any]:
        title = raw_cat.get("title", "")
        slug = raw_cat.get("slug", "")
        store = raw_cat.get("store_slug", "unknown")

        year_match = re.search(r"20\d{2}", title)
        year = year_match.group() if year_match else str(raw_cat.get("year", "Unknown"))

        state_pattern = r"\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b"
        state_match = re.search(state_pattern, title, re.IGNORECASE)
        state = state_match.group().upper() if state_match else "Multi-State"

        catalogue_on_sale_date = CatalogueDateParser.extract_date_from_slug(slug)
        if not catalogue_on_sale_date:
            start_timestamp = raw_cat.get("start_date", "")
            if start_timestamp and str(start_timestamp).isdigit():
                catalogue_on_sale_date = datetime.fromtimestamp(int(start_timestamp)).strftime("%Y-%m-%d")
            else:
                catalogue_on_sale_date = "Unknown"

        return {
            "store": store,
            "title": title,
            "slug": slug,
            "year": str(year),
            "state": state,
            "catalogue_on_sale_date": catalogue_on_sale_date,
            "scraped_date": None,
            "page_count": int(raw_cat.get("page_count", 0)),
            "pages_downloaded": 0,
            "downloaded": False,
            "id": raw_cat.get("id", ""),
        }

    def load_from_api_data(self, api_catalogues: List[Dict[str, Any]]) -> None:
        for catalogue in api_catalogues:
            self.catalogues.append(self.parse_catalogue_metadata(catalogue))

    def to_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(self.catalogues)

    def merge_with_existing(self, existing_df: pd.DataFrame) -> pd.DataFrame:
        new_df = self.to_dataframe()
        if existing_df.empty:
            return new_df

        merge_cols = [col for col in ["slug", "downloaded", "scraped_date", "pages_downloaded"] if col in existing_df.columns]
        merged = new_df.merge(existing_df[merge_cols], on="slug", how="left", suffixes=("", "_existing"))
        merged["downloaded"] = merged.get("downloaded_existing", merged["downloaded"]).fillna(merged["downloaded"])
        merged["scraped_date"] = merged.get("scraped_date_existing", merged["scraped_date"]).fillna(merged["scraped_date"])
        merged["pages_downloaded"] = merged.get("pages_downloaded_existing", merged["pages_downloaded"]).fillna(merged["pages_downloaded"])
        return merged[[col for col in merged.columns if not col.endswith("_existing")]]


class CatalogueDownloader:
    def __init__(self, output_folder: str = "catalogues"):
        self.output_folder = output_folder
        self.cdn_base = "https://caau.syd1.cdn.digitaloceanspaces.com/wp-content/uploads/catalogue"
        self.session = requests.Session()
        self.session.verify = False

    def fetch_catalogues_from_api(self, store: str, years: List[int]) -> List[Dict[str, Any]]:
        base_api = "https://www.catalogueau.com/api/web/catalogue/v1.php"
        all_catalogues: List[Dict[str, Any]] = []
        for year in years:
            api_url = f"{base_api}?get=archive&store={store}&year={year}&v1"
            try:
                response = self.session.get(api_url, timeout=15)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        for cat in data:
                            cat["store_slug"] = store
                        all_catalogues.extend(data)
            except Exception as exc:
                logging.error("API fetch failed for %s %s: %s", store, year, exc)
        return all_catalogues

    def download_single_catalogue(self, catalogue: Dict[str, Any]) -> Dict[str, Any]:
        store = catalogue["store"]
        slug = catalogue["slug"]
        year = str(catalogue["year"])
        expected_pages = int(catalogue["page_count"])

        catalogue_folder = os.path.join(self.output_folder, store, year, slug)
        os.makedirs(catalogue_folder, exist_ok=True)

        base_url = f"{self.cdn_base}/{store}/{slug}"
        downloaded = 0
        failed_pages: List[int] = []
        page_num = 1
        consecutive_failures = 0
        max_failures = 3

        while True:
            image_url = f"{base_url}/{page_num}.jpg"
            output_path = os.path.join(catalogue_folder, f"page_{page_num:03d}.jpg")

            if os.path.exists(output_path):
                downloaded += 1
                page_num += 1
                consecutive_failures = 0
                continue

            try:
                response = self.session.get(image_url, timeout=30)
                if response.status_code == 200:
                    with open(output_path, "wb") as handle:
                        handle.write(response.content)
                    downloaded += 1
                    consecutive_failures = 0
                elif response.status_code == 404:
                    break
                else:
                    failed_pages.append(page_num)
                    consecutive_failures += 1
            except Exception:
                failed_pages.append(page_num)
                consecutive_failures += 1

            if consecutive_failures >= max_failures:
                break
            if expected_pages > 0 and downloaded >= expected_pages:
                break
            page_num += 1

        download_success = downloaded > 0 and (
            expected_pages == 0 or downloaded >= expected_pages or len(failed_pages) == 0
        )

        metadata = {
            **catalogue,
            "downloaded": download_success,
            "scraped_date": datetime.now().isoformat(),
            "pages_downloaded": downloaded,
            "failed_pages": failed_pages,
        }
        metadata_path = os.path.join(catalogue_folder, "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as handle:
            json.dump(metadata, handle, indent=2, ensure_ascii=False)

        return {
            "slug": slug,
            "success": download_success,
            "pages_downloaded": downloaded,
            "failed_pages": failed_pages,
            "local_path": catalogue_folder,
        }


def get_user_configuration(defaults: DownloadConfig) -> Optional[DownloadConfig]:
    print("\n" + "=" * 70)
    print("CATALOGUE SCRAPER - CONFIGURATION")
    print("=" * 70 + "\n")

    available_stores = {
        "woolworths": "Woolworths",
        "coles": "Coles",
        "aldi": "Aldi",
        "iga": "IGA",
    }

    print("Available stores:")
    for slug, name in available_stores.items():
        print(f"  - {name} ({slug})")

    print("\n[INPUT] SELECT STORES:")
    print("  Enter store slugs separated by commas, or type 'all'")
    store_input = input("\n  Your selection: ").strip().lower()
    if store_input == "all":
        selected_stores = list(available_stores.keys())
    else:
        selected_stores = [item.strip() for item in store_input.split(",") if item.strip() in available_stores]
    if not selected_stores:
        return None

    print("\n[INPUT] SELECT YEARS:")
    print("  Enter years separated by commas, or type 'all'")
    year_input = input("\n  Your selection: ").strip().lower()
    if year_input == "all":
        current_year = datetime.now().year + 1
        selected_years = list(range(2020, current_year + 1))
    else:
        try:
            selected_years = sorted({int(item.strip()) for item in year_input.split(",") if item.strip()})
        except ValueError:
            return None

    print("\n[INPUT] SELECT MODE:")
    print("  1. Update only")
    print("  2. Refresh all")
    print("  3. Custom selection")
    mode_input = input("\n  Your selection (1/2/3): ").strip()

    mode = defaults.mode
    if mode_input == "2":
        confirm = input("\n  [CONFIRM] Re-download everything with backup? (yes/no): ").strip().lower()
        if confirm != "yes":
            return None
        mode = "refresh"
    elif mode_input == "3":
        mode = "custom"
    else:
        mode = "update"

    print("\n[INPUT] SELECT STORAGE TYPE:")
    print("  1. CSV")
    print("  2. JSON")
    storage_input = input("\n  Your selection (1/2): ").strip()
    storage_type = {"1": "csv", "2": "json"}.get(storage_input, defaults.storage_type)

    return DownloadConfig(
        stores=selected_stores,
        years=selected_years,
        mode=mode,
        storage_type=storage_type,
    )


def parse_stores(args_value: Optional[str], env_name: str, default: List[str]) -> List[str]:
    if args_value:
        return [item.strip() for item in args_value.split(",") if item.strip()]
    env_values = _env_list(env_name)
    return env_values if env_values is not None else default


def parse_years(args_value: Optional[str], env_name: str, default: List[int]) -> List[int]:
    if args_value:
        return sorted({int(item.strip()) for item in args_value.split(",") if item.strip()})
    env_values = _env_list(env_name)
    if env_values is not None:
        return sorted({int(item) for item in env_values})
    return default


def determine_default_pipeline_mode() -> str:
    env_mode = _env("CATALOGUE_PIPELINE_MODE")
    if env_mode:
        return env_mode
    return "interactive" if sys.stdin.isatty() else "pipeline"


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Catalogue pipeline orchestrator")
    parser.add_argument("--pipeline-mode", choices=["interactive", "download-only", "pipeline"], default=None)
    parser.add_argument("--stores", type=str, default=None)
    parser.add_argument("--years", type=str, default=None)
    parser.add_argument("--download-mode", choices=["update", "refresh", "custom"], default=None)
    parser.add_argument("--storage-type", choices=["csv", "json"], default=None)
    parser.add_argument("--disable-gcs", action="store_true")
    parser.add_argument("--force-all", action="store_true")
    parser.add_argument("--force-catalogue", action="append", default=None)

    parser.add_argument("--catalogues-dir", type=str, default=None)
    parser.add_argument("--catalogue-data-dir", type=str, default=None)
    parser.add_argument("--pipeline-runs-dir", type=str, default=None)
    parser.add_argument("--models-local-dir", type=str, default=None)

    parser.add_argument("--gcp-project", type=str, default=None)
    parser.add_argument("--gcs-bucket", type=str, default=None)
    parser.add_argument("--run-id", type=str, default=None)
    parser.add_argument("--scheduler-job", type=str, default=None)
    parser.add_argument("--scheduler-schedule", type=str, default=None)
    parser.add_argument("--failure-policy", choices=["continue"], default=None)
    parser.add_argument("--cleanup-local-artifacts", action="store_true")

    parser.add_argument("--tile-weights", type=str, default=None)
    parser.add_argument("--zone-weights", type=str, default=None)
    parser.add_argument("--tile-model-blob", type=str, default=None)
    parser.add_argument("--zone-model-blob", type=str, default=None)
    parser.add_argument("--tile-model-checksum", type=str, default=None)
    parser.add_argument("--zone-model-checksum", type=str, default=None)
    parser.add_argument("--tile-model-generation", type=str, default=None)
    parser.add_argument("--zone-model-generation", type=str, default=None)

    parser.add_argument("--stage2-imgsz", type=int, default=None)
    parser.add_argument("--stage2-conf", type=float, default=None)
    parser.add_argument("--stage2-limit-images", type=int, default=None)
    parser.add_argument("--stage2-limit-catalogues", type=int, default=None)

    parser.add_argument("--stage3-imgsz", type=int, default=None)
    parser.add_argument("--stage3-conf", type=float, default=None)
    parser.add_argument("--stage3-iou", type=float, default=None)
    parser.add_argument("--stage3-limit-tiles", type=int, default=None)
    parser.add_argument("--stage3-limit-catalogues", type=int, default=None)

    parser.add_argument("--stage4-limit-catalogues", type=int, default=None)
    parser.add_argument("--stage4-limit-tiles", type=int, default=None)
    parser.add_argument("--tesseract-cmd", type=str, default=None)

    parser.add_argument("--automated", action="store_true", help="Legacy alias for --pipeline-mode pipeline")
    parser.add_argument("--update-only", action="store_true", help="Legacy alias for --pipeline-mode download-only")
    return parser.parse_args(argv)


def resolve_config(args: argparse.Namespace) -> PipelineConfig:
    default_mode = determine_default_pipeline_mode()
    pipeline_mode = args.pipeline_mode or default_mode
    if args.automated:
        pipeline_mode = "pipeline"
    if args.update_only:
        pipeline_mode = "download-only"

    current_year = datetime.now().year + 1
    download_defaults = DownloadConfig(
        stores=["woolworths", "coles", "aldi", "iga"],
        years=list(range(2020, current_year + 1)),
        mode="update",
        storage_type="csv",
    )

    download = DownloadConfig(
        stores=parse_stores(args.stores, "CATALOGUE_STORES", download_defaults.stores),
        years=parse_years(args.years, "CATALOGUE_YEARS", download_defaults.years),
        mode=args.download_mode or _env("CATALOGUE_DOWNLOAD_MODE") or download_defaults.mode,
        storage_type=args.storage_type or _env("CATALOGUE_STORAGE_TYPE") or download_defaults.storage_type,
    )

    if pipeline_mode == "interactive":
        user_config = get_user_configuration(download)
        if user_config is None:
            raise ValueError("Interactive configuration was cancelled or invalid.")
        download = user_config

    catalogues_dir = Path(args.catalogues_dir or _env("CATALOGUES_DIR") or DEFAULT_CATALOGUES_DIR)
    data_dir = Path(args.catalogue_data_dir or _env("CATALOGUE_DATA_DIR") or DEFAULT_DATA_DIR)
    pipeline_runs_dir = Path(args.pipeline_runs_dir or _env("PIPELINE_RUNS_DIR") or (data_dir / "pipeline_runs"))
    models_local_dir = Path(args.models_local_dir or _env("MODELS_LOCAL_DIR") or DEFAULT_MODELS_DIR)

    bucket_name = args.gcs_bucket or _env("GCS_BUCKET")
    gcs_enabled = not args.disable_gcs and bool(bucket_name)
    run_id = args.run_id or _env("PIPELINE_RUN_ID") or datetime.utcnow().strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]

    stage2 = Stage2Config(
        imgsz=args.stage2_imgsz or _env_int("STAGE2_IMGSZ", catalogue_tile_detection.IMG_SIZE) or catalogue_tile_detection.IMG_SIZE,
        conf=args.stage2_conf if args.stage2_conf is not None else (_env_float("STAGE2_CONF", catalogue_tile_detection.CONF_THRESHOLD) or catalogue_tile_detection.CONF_THRESHOLD),
        limit_catalogues=args.stage2_limit_catalogues if args.stage2_limit_catalogues is not None else _env_int("STAGE2_LIMIT_CATALOGUES"),
        limit_images=args.stage2_limit_images if args.stage2_limit_images is not None else _env_int("STAGE2_LIMIT_IMAGES"),
        weights_path=Path(args.tile_weights or _env("TILE_WEIGHTS") or (models_local_dir / "catalogue_tile_detection_weight.pt")),
        model_blob=args.tile_model_blob or _env("TILE_MODEL_BLOB") or "models/tile/catalogue_tile_detection_weight.pt",
        model_checksum=args.tile_model_checksum or _env("TILE_MODEL_CHECKSUM"),
        model_generation=args.tile_model_generation or _env("TILE_MODEL_GENERATION"),
    )

    stage3 = Stage3Config(
        imgsz=args.stage3_imgsz or _env_int("STAGE3_IMGSZ", catalogue_zone_detection.IMG_SIZE) or catalogue_zone_detection.IMG_SIZE,
        conf=args.stage3_conf if args.stage3_conf is not None else (_env_float("STAGE3_CONF", catalogue_zone_detection.CONF_THRESHOLD) or catalogue_zone_detection.CONF_THRESHOLD),
        iou=args.stage3_iou if args.stage3_iou is not None else (_env_float("STAGE3_IOU", catalogue_zone_detection.IOU_THRESHOLD) or catalogue_zone_detection.IOU_THRESHOLD),
        limit_catalogues=args.stage3_limit_catalogues if args.stage3_limit_catalogues is not None else _env_int("STAGE3_LIMIT_CATALOGUES"),
        limit_tiles=args.stage3_limit_tiles if args.stage3_limit_tiles is not None else _env_int("STAGE3_LIMIT_TILES"),
        weights_path=Path(args.zone_weights or _env("ZONE_WEIGHTS") or (models_local_dir / "catalogue_zone_detection_weight.pt")),
        model_blob=args.zone_model_blob or _env("ZONE_MODEL_BLOB") or "models/zone/catalogue_zone_detection_weight.pt",
        model_checksum=args.zone_model_checksum or _env("ZONE_MODEL_CHECKSUM"),
        model_generation=args.zone_model_generation or _env("ZONE_MODEL_GENERATION"),
    )

    stage4 = Stage4Config(
        limit_catalogues=args.stage4_limit_catalogues if args.stage4_limit_catalogues is not None else _env_int("STAGE4_LIMIT_CATALOGUES"),
        limit_tiles=args.stage4_limit_tiles if args.stage4_limit_tiles is not None else _env_int("STAGE4_LIMIT_TILES"),
        tesseract_cmd=args.tesseract_cmd or _env("TESSERACT_CMD"),
    )

    gcp = GCPConfig(
        enabled=gcs_enabled,
        project_id=args.gcp_project or _env("GCP_PROJECT"),
        bucket_name=bucket_name,
        local_work_root=SCRIPT_DIR,
        models_local_dir=models_local_dir,
        run_id=run_id,
        scheduler_job=args.scheduler_job or _env("SCHEDULER_JOB"),
        scheduler_schedule=args.scheduler_schedule or _env("SCHEDULER_SCHEDULE"),
    )

    return PipelineConfig(
        pipeline_mode=pipeline_mode,
        download=download,
        stage2=stage2,
        stage3=stage3,
        stage4=stage4,
        gcp=gcp,
        script_dir=SCRIPT_DIR,
        catalogues_dir=catalogues_dir,
        data_dir=data_dir,
        pipeline_runs_dir=pipeline_runs_dir,
        log_dir=DEFAULT_LOG_DIR,
        failure_policy=args.failure_policy or _env("FAILURE_POLICY") or "continue",
        cleanup_local_artifacts=args.cleanup_local_artifacts or _env_bool("CLEANUP_LOCAL_ARTIFACTS", False),
        force_catalogues=args.force_catalogue or _env_list("FORCE_CATALOGUES") or [],
        force_all=args.force_all or _env_bool("FORCE_ALL", False),
    )


def validate_config(config: PipelineConfig) -> None:
    if not config.download.stores:
        raise ValueError("At least one store is required.")
    if not config.download.years:
        raise ValueError("At least one year is required.")
    if config.download.storage_type not in {"csv", "json"}:
        raise ValueError("Storage type must be csv or json.")
    if config.download.mode not in {"update", "refresh", "custom"}:
        raise ValueError("Download mode must be update, refresh, or custom.")
    if config.stage2.imgsz <= 0 or config.stage3.imgsz <= 0:
        raise ValueError("Image sizes must be positive.")
    if not 0 <= config.stage2.conf <= 1:
        raise ValueError("Stage 2 confidence must be between 0 and 1.")
    if not 0 <= config.stage3.conf <= 1:
        raise ValueError("Stage 3 confidence must be between 0 and 1.")
    if not 0 <= config.stage3.iou <= 1:
        raise ValueError("Stage 3 IOU must be between 0 and 1.")
    if config.failure_policy != "continue":
        raise ValueError("Only 'continue' failure policy is currently supported.")

    config.catalogues_dir.mkdir(parents=True, exist_ok=True)
    config.data_dir.mkdir(parents=True, exist_ok=True)
    config.pipeline_runs_dir.mkdir(parents=True, exist_ok=True)
    config.log_dir.mkdir(parents=True, exist_ok=True)
    config.gcp.models_local_dir.mkdir(parents=True, exist_ok=True)


class GCSStorageManager:
    def __init__(self, config: GCPConfig, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.enabled = config.enabled
        self._client = None
        self._bucket = None

        if not self.enabled:
            return
        if storage is None:
            raise ImportError("google-cloud-storage is not installed but GCS is enabled.")
        self._client = storage.Client(project=config.project_id)  # type: ignore[union-attr]
        self._bucket = self._client.bucket(config.bucket_name)

    @property
    def bucket(self):
        return self._bucket

    def ensure_access(self) -> None:
        if not self.enabled:
            return
        assert self._bucket is not None
        self._bucket.reload()

    def blob_exists(self, blob_name: str) -> bool:
        if not self.enabled:
            return False
        assert self._bucket is not None
        return self._bucket.blob(blob_name).exists(self._client)

    def prefix_exists(self, prefix: str) -> bool:
        if not self.enabled:
            return False
        assert self._client is not None and self._bucket is not None
        iterator = self._client.list_blobs(self._bucket, prefix=prefix.rstrip("/") + "/", max_results=1)
        return next(iter(iterator), None) is not None

    def get_blob(self, blob_name: str):
        if not self.enabled:
            return None
        assert self._bucket is not None
        return self._bucket.get_blob(blob_name)

    def download_blob(self, blob_name: str, local_path: Path) -> bool:
        if not self.enabled:
            return False
        blob = self.get_blob(blob_name)
        if blob is None:
            return False
        local_path.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(local_path))
        return True

    def upload_file(self, local_path: Path, blob_name: str) -> bool:
        if not self.enabled or not local_path.exists():
            return False
        assert self._bucket is not None
        blob = self._bucket.blob(blob_name)
        blob.upload_from_filename(str(local_path))
        return True

    def download_prefix(self, prefix: str, target_root: Path) -> List[str]:
        if not self.enabled:
            return []
        assert self._client is not None and self._bucket is not None
        downloaded: List[str] = []
        for blob in self._client.list_blobs(self._bucket, prefix=prefix.rstrip("/") + "/"):
            if blob.name.endswith("/"):
                continue
            local_path = target_root / blob.name
            local_path.parent.mkdir(parents=True, exist_ok=True)
            blob.download_to_filename(str(local_path))
            downloaded.append(blob.name)
        return downloaded

    def upload_catalogue_outputs(self, catalogue_dir: Path, relative_entries: Sequence[str]) -> List[str]:
        uploaded: List[str] = []
        for entry in relative_entries:
            path = catalogue_dir / entry
            if path.is_dir():
                for file_path in sorted(path.rglob("*")):
                    if not file_path.is_file():
                        continue
                    blob_name = relative_blob(file_path)
                    if self.upload_file(file_path, blob_name):
                        uploaded.append(blob_name)
            elif path.exists():
                blob_name = relative_blob(path)
                if self.upload_file(path, blob_name):
                    uploaded.append(blob_name)
        return uploaded


def compute_md5(file_path: Path) -> str:
    digest = hashlib.md5()
    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_model_file(
    logger: logging.Logger,
    gcs: GCSStorageManager,
    local_path: Path,
    model_blob: Optional[str],
    expected_checksum: Optional[str],
    expected_generation: Optional[str],
) -> Path:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    if not local_path.exists() and gcs.enabled and model_blob:
        if not gcs.download_blob(model_blob, local_path):
            raise FileNotFoundError(f"Model blob not found in GCS: {model_blob}")

    if not local_path.exists():
        raise FileNotFoundError(f"Model file not found: {local_path}")

    if gcs.enabled and model_blob:
        blob = gcs.get_blob(model_blob)
        if blob is None:
            raise FileNotFoundError(f"Model blob not found in GCS: {model_blob}")
        if expected_generation and str(blob.generation) != str(expected_generation):
            raise ValueError(f"Model generation mismatch for {model_blob}: expected {expected_generation}, got {blob.generation}")

    if expected_checksum:
        checksum = compute_md5(local_path)
        if checksum.lower() != expected_checksum.lower():
            raise ValueError(f"Checksum mismatch for {local_path.name}: expected {expected_checksum}, got {checksum}")

    log_event(logger, "model_ready", local_path=str(local_path), model_blob=model_blob)
    return local_path


def preflight_checks(config: PipelineConfig, logger: logging.Logger, gcs: GCSStorageManager) -> None:
    if gcs.enabled:
        gcs.ensure_access()
        log_event(logger, "gcs_access_ok", bucket=config.gcp.bucket_name, project=config.gcp.project_id)
    else:
        log_event(logger, "gcs_disabled", reason="No bucket configured or explicitly disabled")

    config.stage2.weights_path = ensure_model_file(
        logger,
        gcs,
        config.stage2.weights_path,
        config.stage2.model_blob,
        config.stage2.model_checksum,
        config.stage2.model_generation,
    )
    config.stage3.weights_path = ensure_model_file(
        logger,
        gcs,
        config.stage3.weights_path,
        config.stage3.model_blob,
        config.stage3.model_checksum,
        config.stage3.model_generation,
    )

    tesseract_path = catalogue_ocr.configure_tesseract(config.stage4.tesseract_cmd)
    if not tesseract_path:
        raise EnvironmentError("Tesseract executable could not be found during preflight.")
    try:
        catalogue_ocr.OCREngine()
    except Exception as exc:  # pragma: no cover - runtime dependency check.
        raise RuntimeError(f"PaddleOCR preflight failed: {exc}") from exc

    log_event(logger, "ocr_preflight_ok", tesseract_cmd=tesseract_path)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def write_incremental_csv(path: Path, decisions: Sequence[IncrementalDecision]) -> None:
    rows = [decision.to_row() for decision in decisions]
    columns = [
        "catalogue_id",
        "status",
        "reason",
        "starting_stage",
        "local_path",
        "gcs_prefix",
        "source",
        "remote_exists",
        "has_pages",
        "has_detections",
        "has_zone_detections",
        "has_ocr_results",
        "synced_from_gcs",
    ]
    pd.DataFrame(rows, columns=columns).to_csv(path, index=False)


def relative_blob(path: Path) -> str:
    try:
        return str(path.relative_to(SCRIPT_DIR)).replace(os.sep, "/")
    except ValueError:
        return f"external/{path.name}"


def download_control_artifacts(gcs: GCSStorageManager, logger: logging.Logger, manifest: Dict[str, Any]) -> None:
    downloads = manifest.setdefault("gcs_sync", {}).setdefault("control_downloads", [])
    for relative_path in CONTROL_ARTIFACTS:
        local_path = SCRIPT_DIR / relative_path
        blob_name = str(relative_path).replace(os.sep, "/")
        downloaded = gcs.download_blob(blob_name, local_path)
        downloads.append({"blob": blob_name, "local_path": str(local_path), "downloaded": downloaded})
    log_event(logger, "control_artifacts_downloaded", count=len(downloads))


def upload_run_artifact(gcs: GCSStorageManager, local_path: Path, manifest: Dict[str, Any], category: str) -> None:
    if not gcs.enabled:
        return
    uploaded = gcs.upload_file(local_path, relative_blob(local_path))
    manifest.setdefault("gcs_sync", {}).setdefault(category, []).append(
        {"blob": relative_blob(local_path), "local_path": str(local_path), "uploaded": uploaded}
    )


def build_catalogue_local_path(config: PipelineConfig, row: Dict[str, Any]) -> Path:
    return config.catalogues_dir / str(row["store"]) / str(row["year"]) / str(row["slug"])


def build_catalogue_prefix(row: Dict[str, Any]) -> str:
    return f"catalogues/{row['store']}/{row['year']}/{row['slug']}"


def load_local_metadata(catalogue_dir: Path) -> Dict[str, Any]:
    metadata_path = catalogue_dir / "metadata.json"
    if not metadata_path.exists():
        return {}
    try:
        return json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def run_stage1_download(
    config: PipelineConfig,
    logger: logging.Logger,
    manifest: Dict[str, Any],
) -> Dict[str, Any]:
    output_folder = config.catalogues_dir
    if config.download.mode == "custom":
        output_folder = config.script_dir / f"customDL_{datetime.now().strftime('%Y%m%d')}"
        output_folder.mkdir(parents=True, exist_ok=True)

    db = CatalogueDatabase(storage_type=config.download.storage_type, base_path=str(config.data_dir))
    downloader = CatalogueDownloader(output_folder=str(output_folder))
    tracker = CatalogueMetadataTracker()

    if config.download.mode == "refresh":
        BackupManager.backup_folder_structure(str(output_folder))
        BackupManager.backup_tracking_file(db.csv_file)
        BackupManager.backup_tracking_file(db.json_file)
        existing_df = pd.DataFrame()
    else:
        existing_df = db.load_existing_records()

    api_catalogues: List[Dict[str, Any]] = []
    for store_name in config.download.stores:
        api_catalogues.extend(downloader.fetch_catalogues_from_api(store_name, config.download.years))
    tracker.load_from_api_data(api_catalogues)
    df = tracker.merge_with_existing(existing_df)

    if config.download.mode == "update":
        to_download = df[df["downloaded"] != True]
    else:
        to_download = df

    downloaded_catalogues: List[str] = []
    failed_downloads: List[str] = []
    downloaded_paths: Dict[str, str] = {}

    for _, catalogue in to_download.iterrows():
        try:
            result = downloader.download_single_catalogue(catalogue.to_dict())
            df.loc[df["slug"] == catalogue["slug"], "downloaded"] = result["success"]
            df.loc[df["slug"] == catalogue["slug"], "scraped_date"] = datetime.now().isoformat()
            df.loc[df["slug"] == catalogue["slug"], "pages_downloaded"] = result["pages_downloaded"]
            db.save_records(df, backup=False)

            row = catalogue.to_dict()
            catalogue_id = f"{row['store']}/{row['year']}/{row['slug']}"
            downloaded_paths[catalogue_id] = result["local_path"]
            if result["success"]:
                downloaded_catalogues.append(catalogue_id)
            else:
                failed_downloads.append(catalogue_id)
        except Exception as exc:
            failed_downloads.append(f"{catalogue['store']}/{catalogue['year']}/{catalogue['slug']}")
            log_event(
                logger,
                "stage1_catalogue_failed",
                run_id=config.gcp.run_id,
                catalogue=f"{catalogue['store']}/{catalogue['year']}/{catalogue['slug']}",
                error=str(exc),
            )

    db.save_records(df, backup=True)

    stage_summary = {
        "attempted": int(len(to_download)),
        "downloaded": downloaded_catalogues,
        "failed": failed_downloads,
        "tracking_csv": str(Path(db.csv_file)),
        "output_folder": str(output_folder),
    }
    manifest.setdefault("stages", {})["stage_1_download"] = stage_summary
    log_event(
        logger,
        "stage1_complete",
        run_id=config.gcp.run_id,
        attempted=int(len(to_download)),
        downloaded=len(downloaded_catalogues),
        failed=len(failed_downloads),
    )
    return {
        "dataframe": df,
        "downloaded_catalogues": downloaded_catalogues,
        "failed_downloads": failed_downloads,
        "downloaded_paths": downloaded_paths,
        "tracking_csv": Path(db.csv_file),
    }


def build_candidate_work_items(
    config: PipelineConfig,
    df: pd.DataFrame,
    downloaded_this_run: Sequence[str],
) -> List[CatalogueWorkItem]:
    candidate_ids = set(downloaded_this_run)
    items: Dict[str, CatalogueWorkItem] = {}

    for _, row in df.iterrows():
        row_dict = row.to_dict()
        catalogue_id = f"{row_dict['store']}/{row_dict['year']}/{row_dict['slug']}"
        local_path = build_catalogue_local_path(config, row_dict)
        if _safe_bool(row_dict.get("downloaded")) or local_path.exists() or catalogue_id in candidate_ids:
            items[catalogue_id] = CatalogueWorkItem(
                store=str(row_dict["store"]),
                year=str(row_dict["year"]),
                slug=str(row_dict["slug"]),
                local_path=local_path,
                gcs_prefix=build_catalogue_prefix(row_dict),
                metadata=row_dict,
                source="downloaded_this_run" if catalogue_id in candidate_ids else "tracked",
            )
    return list(items.values())


def catalogue_has_pages(catalogue_dir: Path) -> bool:
    if not catalogue_dir.exists():
        return False
    for file_path in catalogue_dir.iterdir():
        if file_path.is_file() and PAGE_IMAGE_PATTERN.match(file_path.name):
            return True
    return False


def inspect_local_catalogue_state(catalogue_dir: Path) -> Dict[str, bool]:
    return {
        "has_pages": catalogue_has_pages(catalogue_dir),
        "has_detections": (catalogue_dir / "detections.csv").exists() and (catalogue_dir / "exported_tiles").exists(),
        "has_zone_detections": (catalogue_dir / "zone_detections.csv").exists() and (catalogue_dir / "exported_zones").exists(),
        "has_ocr_results": (catalogue_dir / "ocr_results.csv").exists(),
    }


def sync_catalogue_from_gcs(
    gcs: GCSStorageManager,
    work_item: CatalogueWorkItem,
    logger: logging.Logger,
    manifest: Dict[str, Any],
) -> bool:
    if not gcs.enabled or not gcs.prefix_exists(work_item.gcs_prefix):
        return False
    downloaded = gcs.download_prefix(work_item.gcs_prefix, SCRIPT_DIR)
    manifest.setdefault("gcs_sync", {}).setdefault("catalogue_downloads", []).append(
        {
            "catalogue_id": work_item.catalogue_id,
            "prefix": work_item.gcs_prefix,
            "downloaded_objects": len(downloaded),
        }
    )
    log_event(logger, "catalogue_synced_from_gcs", catalogue=work_item.catalogue_id, objects=len(downloaded))
    return bool(downloaded)


def determine_incremental_decisions(
    config: PipelineConfig,
    logger: logging.Logger,
    manifest: Dict[str, Any],
    gcs: GCSStorageManager,
    work_items: Sequence[CatalogueWorkItem],
) -> List[IncrementalDecision]:
    decisions: List[IncrementalDecision] = []
    force_catalogues = set(config.force_catalogues)

    for work_item in work_items:
        remote_exists = gcs.prefix_exists(work_item.gcs_prefix) if gcs.enabled else False
        remote_detections = gcs.blob_exists(f"{work_item.gcs_prefix}/detections.csv") if gcs.enabled else False
        remote_zones = gcs.blob_exists(f"{work_item.gcs_prefix}/zone_detections.csv") if gcs.enabled else False
        remote_ocr = gcs.blob_exists(f"{work_item.gcs_prefix}/ocr_results.csv") if gcs.enabled else False

        synced_from_gcs = False
        if remote_exists and not config.force_all and work_item.catalogue_id not in force_catalogues:
            synced_from_gcs = sync_catalogue_from_gcs(gcs, work_item, logger, manifest)

        state = inspect_local_catalogue_state(work_item.local_path)

        if config.force_all or work_item.catalogue_id in force_catalogues:
            status = "new"
            reason = "forced_reprocess"
            starting_stage = 2
        elif not state["has_pages"]:
            status = "invalid"
            reason = "missing_page_images"
            starting_stage = None
        elif state["has_zone_detections"] and state["has_ocr_results"]:
            status = "already_processed"
            reason = "zone_and_ocr_outputs_present"
            starting_stage = None
        elif state["has_zone_detections"]:
            status = "partial"
            reason = "ocr_missing"
            starting_stage = 4
        elif state["has_detections"]:
            status = "partial"
            reason = "zone_outputs_missing"
            starting_stage = 3
        else:
            status = "new"
            reason = "start_from_tile_detection"
            starting_stage = 2

        decision = IncrementalDecision(
            catalogue_id=work_item.catalogue_id,
            status=status,
            reason=reason,
            starting_stage=starting_stage,
            local_path=str(work_item.local_path),
            gcs_prefix=work_item.gcs_prefix,
            source=work_item.source,
            remote_exists=remote_exists,
            has_pages=state["has_pages"],
            has_detections=state["has_detections"] or remote_detections,
            has_zone_detections=state["has_zone_detections"] or remote_zones,
            has_ocr_results=state["has_ocr_results"] or remote_ocr,
            synced_from_gcs=synced_from_gcs,
        )
        decisions.append(decision)
        manifest.setdefault("catalogues", {}).setdefault(work_item.catalogue_id, {})
        manifest["catalogues"][work_item.catalogue_id]["incremental_decision"] = decision.to_row()
        log_event(
            logger,
            "incremental_decision",
            run_id=config.gcp.run_id,
            catalogue=work_item.catalogue_id,
            status=status,
            reason=reason,
            starting_stage=starting_stage,
        )
    return decisions


def stage_inputs(
    stage_number: int,
    work_lookup: Dict[str, CatalogueWorkItem],
    decisions: Sequence[IncrementalDecision],
    blocked_ids: Sequence[str],
    limit: Optional[int],
) -> List[Path]:
    blocked = set(blocked_ids)
    selected = [
        work_lookup[decision.catalogue_id].local_path
        for decision in decisions
        if decision.starting_stage is not None and decision.starting_stage <= stage_number and decision.catalogue_id not in blocked
    ]
    if limit is not None:
        selected = selected[:limit]
    return selected


def upload_stage_outputs_for_catalogue(
    stage_name: str,
    gcs: GCSStorageManager,
    work_item: CatalogueWorkItem,
    manifest: Dict[str, Any],
) -> List[str]:
    relative_entries = STAGE_OUTPUT_MAP.get(stage_name, [])
    uploaded = gcs.upload_catalogue_outputs(work_item.local_path, relative_entries)
    manifest.setdefault("gcs_sync", {}).setdefault("catalogue_uploads", []).append(
        {
            "catalogue_id": work_item.catalogue_id,
            "stage_name": stage_name,
            "uploaded_objects": uploaded,
        }
    )
    return uploaded


def cleanup_catalogue_artifacts(stage_name: str, catalogue_dir: Path) -> None:
    if stage_name == "stage_3_zone_detection":
        for entry in ["exported_tiles", "detections.csv"]:
            path = catalogue_dir / entry
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
            elif path.exists():
                path.unlink()
    elif stage_name == "stage_4_ocr":
        for entry in ["exported_zones", "zone_detections.csv"]:
            path = catalogue_dir / entry
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
            elif path.exists():
                path.unlink()


def update_manifest_with_stage_result(manifest: Dict[str, Any], stage_result: StageResult) -> None:
    manifest.setdefault("stages", {})[stage_result.stage_name] = stage_result.to_dict()
    for outcome in stage_result.catalogue_results:
        manifest.setdefault("catalogues", {}).setdefault(outcome.catalogue_id, {})
        manifest["catalogues"][outcome.catalogue_id].setdefault("stages", {})[stage_result.stage_name] = outcome.to_dict()


def upload_master_outputs(stage_name: str, gcs: GCSStorageManager, manifest: Dict[str, Any]) -> None:
    if stage_name == "stage_3_zone_detection":
        upload_run_artifact(gcs, SCRIPT_DIR / MASTER_ZONE_CSV, manifest, "master_uploads")
    elif stage_name == "stage_4_ocr":
        upload_run_artifact(gcs, SCRIPT_DIR / MASTER_OCR_RESULTS_CSV, manifest, "master_uploads")
        upload_run_artifact(gcs, SCRIPT_DIR / MASTER_OCR_ATTEMPTS_CSV, manifest, "master_uploads")


def execute_stage_runner(
    config: PipelineConfig,
    logger: logging.Logger,
    manifest: Dict[str, Any],
    gcs: GCSStorageManager,
    decisions: Sequence[IncrementalDecision],
    work_lookup: Dict[str, CatalogueWorkItem],
    stage_number: int,
    blocked_ids: List[str],
) -> Optional[StageResult]:
    stage_name_map = {
        2: "stage_2_tile_detection",
        3: "stage_3_zone_detection",
        4: "stage_4_ocr",
    }
    stage_name = stage_name_map[stage_number]
    limit = getattr(config, f"stage{stage_number}").limit_catalogues
    input_paths = stage_inputs(stage_number, work_lookup, decisions, blocked_ids, limit)
    if not input_paths:
        return None

    def on_catalogue_complete(outcome: CatalogueStageOutcome) -> None:
        work_item = work_lookup[outcome.catalogue_id]
        outcome.gcs_path = work_item.gcs_prefix
        if outcome.status == "success":
            uploaded = upload_stage_outputs_for_catalogue(stage_name, gcs, work_item, manifest)
            outcome.details["uploaded_objects"] = uploaded
            if config.cleanup_local_artifacts:
                cleanup_catalogue_artifacts(stage_name, work_item.local_path)
        else:
            blocked_ids.append(outcome.catalogue_id)

    log_event(logger, "stage_start", run_id=config.gcp.run_id, stage=stage_name, catalogues=len(input_paths))
    try:
        if stage_number == 2:
            stage_result = catalogue_tile_detection.run_stage(
                catalogues_dir=config.catalogues_dir,
                weights=config.stage2.weights_path,
                imgsz=config.stage2.imgsz,
                conf=config.stage2.conf,
                limit_catalogues=config.stage2.limit_catalogues,
                limit_images=config.stage2.limit_images,
                catalogue_dirs=input_paths,
                on_catalogue_complete=on_catalogue_complete,
            )
        elif stage_number == 3:
            stage_result = catalogue_zone_detection.run_stage(
                catalogues_dir=config.catalogues_dir,
                weights=config.stage3.weights_path,
                imgsz=config.stage3.imgsz,
                conf=config.stage3.conf,
                iou=config.stage3.iou,
                limit_catalogues=config.stage3.limit_catalogues,
                limit_tiles=config.stage3.limit_tiles,
                catalogue_dirs=input_paths,
                on_catalogue_complete=on_catalogue_complete,
            )
        else:
            stage_result = catalogue_ocr.run_stage(
                catalogues_dir=config.catalogues_dir,
                limit_catalogues=config.stage4.limit_catalogues,
                limit_tiles=config.stage4.limit_tiles,
                tesseract_cmd=config.stage4.tesseract_cmd,
                catalogue_dirs=input_paths,
                on_catalogue_complete=on_catalogue_complete,
            )
    except Exception as exc:
        failure = FailureDetail(
            stage_name=stage_name,
            catalogue_id=None,
            error_type=type(exc).__name__,
            message=str(exc),
            traceback_summary=traceback.format_exc(limit=20),
        )
        manifest.setdefault("stage_failures", []).append(failure.to_dict())
        log_event(
            logger,
            "stage_failure",
            run_id=config.gcp.run_id,
            stage=stage_name,
            error_type=type(exc).__name__,
            message=str(exc),
        )
        raise

    update_manifest_with_stage_result(manifest, stage_result)
    upload_master_outputs(stage_name, gcs, manifest)
    log_event(
        logger,
        "stage_complete",
        run_id=config.gcp.run_id,
        stage=stage_name,
        attempted=len(stage_result.attempted_catalogues),
        succeeded=len(stage_result.succeeded_catalogues),
        skipped=len(stage_result.skipped_catalogues),
        failed=len(stage_result.failed_catalogues),
    )
    blocked_ids.extend(stage_result.failed_catalogues)
    return stage_result


def persist_manifest(
    config: PipelineConfig,
    gcs: GCSStorageManager,
    manifest: Dict[str, Any],
    incremental_decisions: Sequence[IncrementalDecision],
) -> Dict[str, Path]:
    manifest_path = config.pipeline_runs_dir / f"pipeline_manifest_{config.gcp.run_id}.json"
    decisions_path = config.pipeline_runs_dir / f"incremental_decisions_{config.gcp.run_id}.csv"
    write_json(manifest_path, manifest)
    write_incremental_csv(decisions_path, incremental_decisions)
    upload_run_artifact(gcs, manifest_path, manifest, "run_artifact_uploads")
    upload_run_artifact(gcs, decisions_path, manifest, "run_artifact_uploads")
    return {"manifest": manifest_path, "decisions": decisions_path}


def upload_log_artifacts(gcs: GCSStorageManager, manifest: Dict[str, Any], paths: Iterable[Path]) -> None:
    if not gcs.enabled:
        return
    for path in paths:
        if not path.exists():
            continue
        blob_name = f"catalogue_data/pipeline_runs/{manifest['run_id']}/logs/{path.name}"
        uploaded = gcs.upload_file(path, blob_name)
        manifest.setdefault("gcs_sync", {}).setdefault("log_uploads", []).append(
            {"blob": blob_name, "local_path": str(path), "uploaded": uploaded}
        )


def run_pipeline(config: PipelineConfig) -> int:
    validate_config(config)
    logger, pipeline_log = setup_pipeline_logging(config.gcp.run_id)
    gcs = GCSStorageManager(config.gcp, logger)

    manifest: Dict[str, Any] = {
        "run_id": config.gcp.run_id,
        "status": "running",
        "started_at": utc_now_iso(),
        "pipeline_mode": config.pipeline_mode,
        "config": config.to_manifest(),
        "gcs_sync": {},
        "catalogues": {},
        "stages": {},
    }

    incremental_decisions: List[IncrementalDecision] = []
    exit_code = 0

    try:
        log_event(logger, "pipeline_start", run_id=config.gcp.run_id, pipeline_mode=config.pipeline_mode)
        if gcs.enabled:
            download_control_artifacts(gcs, logger, manifest)

        if config.pipeline_mode == "pipeline":
            preflight_checks(config, logger, gcs)
        stage1_result = run_stage1_download(config, logger, manifest)
        upload_run_artifact(gcs, stage1_result["tracking_csv"], manifest, "control_uploads")

        if config.pipeline_mode != "pipeline":
            any_stage1_failure = bool(stage1_result["failed_downloads"])
            manifest["status"] = "failed" if any_stage1_failure else "success"
            manifest["summary"] = {
                "message": "Stage 1 completed without downstream pipeline execution.",
                "downloaded_catalogues": stage1_result["downloaded_catalogues"],
                "failed_downloads": stage1_result["failed_downloads"],
            }
            exit_code = 1 if any_stage1_failure else 0
            return exit_code

        df = stage1_result["dataframe"]
        work_items = build_candidate_work_items(config, df, stage1_result["downloaded_catalogues"])
        work_lookup = {item.catalogue_id: item for item in work_items}

        incremental_decisions = determine_incremental_decisions(config, logger, manifest, gcs, work_items)
        persist_manifest(config, gcs, manifest, incremental_decisions)

        actionable = [decision for decision in incremental_decisions if decision.starting_stage is not None]
        if not actionable and not stage1_result["failed_downloads"]:
            manifest["status"] = "success"
            manifest["summary"] = {"message": "No new or partial catalogues required downstream processing."}
            persist_manifest(config, gcs, manifest, incremental_decisions)
            upload_log_artifacts(gcs, manifest, [pipeline_log])
            log_event(logger, "pipeline_complete", run_id=config.gcp.run_id, status="success", reason="no_work")
            return 0

        blocked_ids: List[str] = []
        for stage_number in [2, 3, 4]:
            execute_stage_runner(config, logger, manifest, gcs, incremental_decisions, work_lookup, stage_number, blocked_ids)
            persist_manifest(config, gcs, manifest, incremental_decisions)

        any_catalogue_failure = bool(blocked_ids or stage1_result["failed_downloads"])
        manifest["status"] = "failed" if any_catalogue_failure else "success"
        manifest["summary"] = {
            "catalogue_failures": sorted(set(blocked_ids + stage1_result["failed_downloads"])),
            "processed_catalogues": len([d for d in incremental_decisions if d.starting_stage is not None]),
            "skipped_catalogues": len([d for d in incremental_decisions if d.status == "already_processed"]),
            "invalid_catalogues": len([d for d in incremental_decisions if d.status == "invalid"]),
        }
        exit_code = 1 if any_catalogue_failure else 0
    except Exception as exc:
        manifest["status"] = "failed"
        manifest.setdefault("pipeline_failure", []).append(
            FailureDetail(
                stage_name="pipeline",
                catalogue_id=None,
                error_type=type(exc).__name__,
                message=str(exc),
                traceback_summary=traceback.format_exc(limit=20),
            ).to_dict()
        )
        exit_code = 1
        log_event(
            logger,
            "pipeline_failure",
            run_id=config.gcp.run_id,
            error_type=type(exc).__name__,
            message=str(exc),
        )
    finally:
        manifest["ended_at"] = utc_now_iso()

        log_paths = [pipeline_log]
        for stage_name in ["stage_2_tile_detection", "stage_3_zone_detection", "stage_4_ocr"]:
            stage_payload = manifest.get("stages", {}).get(stage_name, {})
            log_file = stage_payload.get("log_file")
            if log_file:
                log_paths.append(Path(log_file))
        upload_log_artifacts(gcs, manifest, log_paths)

        log_event(
            logger,
            "pipeline_complete",
            run_id=config.gcp.run_id,
            status=manifest["status"],
            exit_code=exit_code,
        )
        manifest["completed_event_emitted_at"] = utc_now_iso()
        persist_manifest(config, gcs, manifest, incremental_decisions)

    return exit_code


def main(argv: Optional[Sequence[str]] = None) -> int:
    try:
        config = resolve_config(parse_args(argv))
    except Exception as exc:
        print(f"[ERROR] Failed to resolve configuration: {exc}")
        return 1
    return run_pipeline(config)


if __name__ == "__main__":
    raise SystemExit(main())
