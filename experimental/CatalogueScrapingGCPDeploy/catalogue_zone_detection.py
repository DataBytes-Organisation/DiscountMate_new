"""
Catalogue Zone Detection Pipeline
Detects OCR subregions inside exported product tiles using a single YOLO model.

Pipeline position:
- Stage 1: catalogue_scraper_main.py
- Stage 2: catalogue_tile_detection.py
- Stage 3: catalogue_zone_detection.py
- Stage 4: catalogue_ocr.py

This script:
- scans catalogue folders created by earlier stages
- reads tile images from `exported_tiles/`
- uses a single zone-detection model to find OCR subregions in each tile
- exports cropped zone images per catalogue
- writes zone detection CSV outputs per catalogue and a master CSV
"""

from __future__ import annotations

import argparse
import logging
import shutil
import traceback
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Callable, Dict, List, Optional, Sequence

import cv2
import pandas as pd
from ultralytics import YOLO

from catalogue_pipeline_common import (
    CatalogueStageOutcome,
    FailureDetail,
    StageResult,
    finish_stage_result,
    make_stage_result,
)


CATALOGUES_DIR = Path("catalogues")
LOG_SUBDIR = Path("catalogue_data/logs")
MASTER_ZONES_CSV = Path("catalogue_data/historical_zone_detections.csv")
ZONE_MODEL_PATH = Path("Models/catalogue_zone_detection_weight.pt")

TILE_SUBFOLDER = "exported_tiles"
ZONE_SUBFOLDER = "exported_zones"
TILE_DETECTIONS_CSV = "detections.csv"
ZONE_DETECTIONS_CSV = "zone_detections.csv"

IMG_SIZE = 640
CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.7
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ZONE_DETECTION_COLUMNS = [
    "brand",
    "year",
    "catalogue_folder",
    "source_image",
    "page_name",
    "tile_name",
    "tile_image_path",
    "tile_confidence",
    "class_id",
    "class_name",
    "confidence",
    "x1",
    "y1",
    "x2",
    "y2",
    "zone_image_path",
    "processed_timestamp",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Stage 3 zone detection over exported catalogue tiles."
    )
    parser.add_argument(
        "--catalogues-dir",
        type=str,
        default=str(CATALOGUES_DIR),
        help="Catalogue root directory. Default: catalogues",
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=str(ZONE_MODEL_PATH),
        help="Zone-detection weights path. Default: Models/catalogue_zone_detection_weight.pt",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=IMG_SIZE,
        help=f"YOLO inference image size. Default: {IMG_SIZE}.",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=CONF_THRESHOLD,
        help=f"YOLO confidence threshold. Default: {CONF_THRESHOLD}.",
    )
    parser.add_argument(
        "--iou",
        type=float,
        default=IOU_THRESHOLD,
        help=f"YOLO IOU threshold. Default: {IOU_THRESHOLD}.",
    )
    parser.add_argument(
        "--limit-catalogues",
        type=int,
        default=None,
        help="Optional cap on number of catalogue folders to process.",
    )
    parser.add_argument(
        "--limit-tiles",
        type=int,
        default=None,
        help="Optional cap on number of tiles per catalogue.",
    )
    parser.add_argument(
        "--rebuild-master",
        action="store_true",
        help="Delete and rebuild the master zone-detections CSV before processing.",
    )
    return parser.parse_args()


def setup_logging(script_dir: Path) -> tuple[logging.Logger, Path]:
    log_dir = script_dir / LOG_SUBDIR
    log_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"catalogue_zone_detection_log_{timestamp}.txt"

    logger = logging.getLogger("catalogue_zone_detection")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False
    handler = logging.FileHandler(log_file, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)
    return logger, log_file


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def safe_name(text: str) -> str:
    return text.replace(" ", "_").replace("/", "_")


def safe_relative(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)


def find_catalogue_folders(base_dir: Path, limit: Optional[int] = None) -> List[Path]:
    catalogue_folders: List[Path] = []
    if not base_dir.exists():
        return catalogue_folders

    for store_dir in sorted(base_dir.iterdir()):
        if not store_dir.is_dir():
            continue
        for year_dir in sorted(store_dir.iterdir()):
            if not year_dir.is_dir():
                continue
            for catalogue_dir in sorted(year_dir.iterdir()):
                if not catalogue_dir.is_dir():
                    continue
                tiles_dir = catalogue_dir / TILE_SUBFOLDER
                if tiles_dir.exists():
                    catalogue_folders.append(catalogue_dir)
                    if limit is not None and len(catalogue_folders) >= limit:
                        return catalogue_folders
    return catalogue_folders


def load_tile_lookup(catalogue_dir: Path) -> Dict[str, Dict[str, str]]:
    tile_lookup: Dict[str, Dict[str, str]] = {}
    csv_path = catalogue_dir / TILE_DETECTIONS_CSV
    if not csv_path.exists():
        return tile_lookup

    df = pd.read_csv(csv_path)
    for _, row in df.iterrows():
        tile_rel_path = str(row.get("tile_image_path", ""))
        tile_name = Path(tile_rel_path).name
        tile_lookup[tile_name] = {
            "brand": str(row.get("brand", "")),
            "year": str(row.get("year", "")),
            "catalogue_folder": str(row.get("catalogue_folder", "")),
            "source_image": str(row.get("source_image", "")),
            "page_name": str(row.get("page_name", "")),
            "tile_confidence": str(row.get("confidence", "")),
        }
    return tile_lookup


def append_master_rows(script_dir: Path, rows_df: pd.DataFrame) -> None:
    master_path = script_dir / MASTER_ZONES_CSV
    ensure_dir(master_path.parent)
    if rows_df.empty:
        return

    if master_path.exists():
        try:
            existing = pd.read_csv(master_path)
            catalogue_name = rows_df["catalogue_folder"].iloc[0]
            existing = existing[existing["catalogue_folder"] != catalogue_name]
            combined = pd.concat([existing, rows_df], ignore_index=True)
        except Exception:
            combined = rows_df
    else:
        combined = rows_df

    combined.to_csv(master_path, index=False, encoding="utf-8-sig")


def process_catalogue_folder(
    logger: logging.Logger,
    catalogue_dir: Path,
    base_dir: Path,
    model: YOLO,
    imgsz: int,
    conf: float,
    iou: float,
    limit_tiles: Optional[int],
) -> pd.DataFrame:
    tiles_dir = catalogue_dir / TILE_SUBFOLDER
    zone_dir = catalogue_dir / ZONE_SUBFOLDER
    zone_csv_path = catalogue_dir / ZONE_DETECTIONS_CSV

    tile_lookup = load_tile_lookup(catalogue_dir)
    tile_paths = sorted([p for p in tiles_dir.iterdir() if is_image_file(p)])
    if limit_tiles is not None:
        tile_paths = tile_paths[:limit_tiles]

    if zone_dir.exists():
        shutil.rmtree(zone_dir)
    ensure_dir(zone_dir)

    zone_rows: List[Dict[str, object]] = []

    for tile_path in tile_paths:
        tile_name = tile_path.stem
        tile_meta = tile_lookup.get(tile_path.name, {})
        image = cv2.imread(str(tile_path))
        if image is None:
            logger.warning("Could not read tile image: %s", tile_path)
            continue

        results = model.predict(
            source=str(tile_path),
            imgsz=imgsz,
            conf=conf,
            iou=iou,
            verbose=False,
        )
        if not results:
            continue

        result = results[0]
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            continue

        h, w = image.shape[:2]
        for idx, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            x1 = max(0, min(x1, w - 1))
            y1 = max(0, min(y1, h - 1))
            x2 = max(0, min(x2, w))
            y2 = max(0, min(y2, h))
            if x2 <= x1 or y2 <= y1:
                continue

            crop = image[y1:y2, x1:x2]
            if crop.size == 0:
                continue

            class_id = int(box.cls[0])
            class_name = model.names[class_id]
            confidence = float(box.conf[0])

            zone_filename = (
                f"{safe_name(tile_name)}_"
                f"{safe_name(class_name)}_"
                f"{idx:03d}_"
                f"{confidence:.2f}.jpg"
            )
            zone_output_path = zone_dir / zone_filename
            cv2.imwrite(str(zone_output_path), crop)

            zone_rows.append(
                {
                    "brand": tile_meta.get("brand", ""),
                    "year": tile_meta.get("year", ""),
                    "catalogue_folder": tile_meta.get("catalogue_folder", catalogue_dir.name),
                    "source_image": tile_meta.get("source_image", ""),
                    "page_name": tile_meta.get("page_name", ""),
                    "tile_name": tile_name,
                    "tile_image_path": safe_relative(tile_path, catalogue_dir),
                    "tile_confidence": tile_meta.get("tile_confidence", ""),
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": round(confidence, 4),
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "zone_image_path": safe_relative(zone_output_path, catalogue_dir),
                    "processed_timestamp": datetime.now().isoformat(),
                }
            )

    # Always write a header row so downstream OCR can safely read
    # no-detection catalogues without tripping over an empty file.
    zone_df = pd.DataFrame(zone_rows, columns=ZONE_DETECTION_COLUMNS)
    zone_df.to_csv(zone_csv_path, index=False, encoding="utf-8-sig")
    return zone_df


def run_stage(
    catalogues_dir: Path,
    weights: Path,
    imgsz: int = IMG_SIZE,
    conf: float = CONF_THRESHOLD,
    iou: float = IOU_THRESHOLD,
    limit_catalogues: Optional[int] = None,
    limit_tiles: Optional[int] = None,
    rebuild_master: bool = False,
    catalogue_dirs: Optional[Sequence[Path]] = None,
    on_catalogue_complete: Optional[Callable[[CatalogueStageOutcome], None]] = None,
) -> StageResult:
    script_dir = Path(__file__).resolve().parent
    logger, log_file = setup_logging(script_dir)
    result = make_stage_result("stage_3_zone_detection", log_file=log_file)

    logger.info("=" * 70)
    logger.info("CATALOGUE ZONE DETECTION PIPELINE - SESSION START")
    logger.info("=" * 70)

    if not weights.exists():
        raise FileNotFoundError(f"Zone-detection weights not found: {weights}")
    if not catalogues_dir.exists():
        raise FileNotFoundError(f"Catalogue directory not found: {catalogues_dir}")

    if rebuild_master:
        master_path = script_dir / MASTER_ZONES_CSV
        if master_path.exists():
            master_path.unlink()

    model = YOLO(str(weights))
    selected_catalogues = list(catalogue_dirs) if catalogue_dirs is not None else find_catalogue_folders(
        catalogues_dir,
        limit=limit_catalogues,
    )
    if limit_catalogues is not None and catalogue_dirs is not None:
        selected_catalogues = selected_catalogues[:limit_catalogues]

    for catalogue_dir in selected_catalogues:
        catalogue_id = "/".join(catalogue_dir.relative_to(catalogues_dir).parts)
        start = perf_counter()
        try:
            logger.info("Processing catalogue folder: %s", catalogue_dir)
            zone_df = process_catalogue_folder(
                logger=logger,
                catalogue_dir=catalogue_dir,
                base_dir=catalogues_dir,
                model=model,
                imgsz=imgsz,
                conf=conf,
                iou=iou,
                limit_tiles=limit_tiles,
            )
            append_master_rows(script_dir, zone_df)
            zone_csv_path = catalogue_dir / ZONE_DETECTIONS_CSV
            if not zone_csv_path.exists():
                raise RuntimeError(f"Expected output missing: {zone_csv_path}")

            files_produced = len(zone_df) + (1 if zone_csv_path.exists() else 0)
            outcome = CatalogueStageOutcome(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                status="success",
                rows_produced=len(zone_df),
                files_produced=files_produced,
                elapsed_seconds=perf_counter() - start,
                local_path=str(catalogue_dir),
                details={
                    "zone_csv": str(zone_csv_path),
                    "zone_output_dir": str(catalogue_dir / ZONE_SUBFOLDER),
                },
            )
        except Exception as exc:
            failure = FailureDetail(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                error_type=type(exc).__name__,
                message=str(exc),
                traceback_summary=traceback.format_exc(limit=10),
                local_path=str(catalogue_dir),
            )
            outcome = CatalogueStageOutcome(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                status="failed",
                elapsed_seconds=perf_counter() - start,
                local_path=str(catalogue_dir),
                failure=failure,
            )
            logger.error("Catalogue failed: %s | %s", catalogue_id, exc)

        result.add_catalogue_result(outcome)
        if on_catalogue_complete is not None:
            on_catalogue_complete(outcome)

    logger.info(
        "ZONE DETECTION COMPLETE - attempted=%d succeeded=%d failed=%d rows=%d files=%d",
        len(result.attempted_catalogues),
        len(result.succeeded_catalogues),
        len(result.failed_catalogues),
        result.rows_produced,
        result.files_produced,
    )
    logger.info("=" * 70)
    logger.info("SESSION END")
    logger.info("=" * 70)
    return finish_stage_result(result)


def main() -> None:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    base_dir = script_dir / args.catalogues_dir
    weights_path = Path(args.weights)
    if not weights_path.is_absolute():
        weights_path = script_dir / weights_path

    if not weights_path.exists():
        raise FileNotFoundError(f"Zone-detection weights not found: {weights_path}")
    if not base_dir.exists():
        raise FileNotFoundError(f"Catalogue directory not found: {base_dir}")

    print("\n" + "=" * 70)
    print("CATALOGUE ZONE DETECTION PIPELINE")
    print("=" * 70)
    print(f"  Catalogues: {base_dir}")
    print(f"  Zone model: {weights_path}")
    print(f"  Img size: {args.imgsz}")
    print(f"  Conf threshold: {args.conf}")
    print(f"  IOU threshold: {args.iou}")

    stage_result = run_stage(
        catalogues_dir=base_dir,
        weights=weights_path,
        imgsz=args.imgsz,
        conf=args.conf,
        iou=args.iou,
        limit_catalogues=args.limit_catalogues,
        limit_tiles=args.limit_tiles,
        rebuild_master=args.rebuild_master,
    )
    if not stage_result.attempted_catalogues:
        print("[INFO] No catalogue folders with exported tiles found.")
        return

    print("\n" + "=" * 70)
    print("ZONE DETECTION COMPLETE")
    print("=" * 70)
    print(f"[DONE] Catalogues attempted: {len(stage_result.attempted_catalogues)}")
    print(f"[DONE] Successful catalogues: {len(stage_result.succeeded_catalogues)}")
    print(f"[DONE] Failed catalogues: {len(stage_result.failed_catalogues)}")
    print(f"[DONE] Zone detections: {stage_result.rows_produced}")
    print(f"[DONE] Master zones CSV: {script_dir / MASTER_ZONES_CSV}")


if __name__ == "__main__":
    main()
