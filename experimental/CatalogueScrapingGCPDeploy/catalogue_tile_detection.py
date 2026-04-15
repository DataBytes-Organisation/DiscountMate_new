"""
Catalogue Tile Detection
Extracts product tiles from downloaded catalogue page images using a YOLO model.

Key Features:
- Uses the catalogue folder structure produced by catalogue_scraper_main.py
- Scans all stores, years, and catalogue folders in one batch run
- Exports cropped product tiles per catalogue folder
- Writes a per-catalogue detections CSV for downstream data integration

In line with current Deakin University guidelines(Accessed 09/12/2025):
https://www.deakin.edu.au/students/study-support/study-resources/artificial-intelligence/acknowledging-your-use

This component was developed with the assistance of 'Claude Sonnet 4.5' (via GitHub Copilot Pro Education License)
for code scaffolding, refactoring, and productionisation tasks.

The author contributed and is responsible for:
- Integration of the tile extraction stage into the catalogue scraping pipeline
- Configuration of folder traversal and output structure for downstream processing
- Refinement of terminal output, documentation, and operational behaviour
- Validation of compatibility with the catalogue downloader output format
- All decision-making regarding process design and operational logic

All submitted code and documentation are supplied as open source and intended for extension and review by future student cohorts.
"""

import argparse
import csv
import logging
import shutil
import traceback
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Callable, List, Optional, Sequence

import cv2
from ultralytics import YOLO

from catalogue_pipeline_common import (
    CatalogueStageOutcome,
    FailureDetail,
    StageResult,
    finish_stage_result,
    make_stage_result,
)

# ========================
# Configuration
# ========================
MODEL_PATH = "Models/catalogue_tile_detection_weight.pt"
# This stage consumes the folder structure produced by catalogue_scraper_main.py:
# catalogues/<store>/<year>/<catalogue_slug>/page_001.jpg
INPUT_DIR = Path("catalogues")

OUTPUT_SUBFOLDER = "exported_tiles"
DETECTIONS_CSV_NAME = "detections.csv"

IMG_SIZE = 640
CONF_THRESHOLD = 0.25

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
LOG_SUBDIR = "catalogue_data/logs"
DETECTION_COLUMNS = [
    "brand",
    "year",
    "catalogue_folder",
    "source_image",
    "page_name",
    "class_id",
    "class_name",
    "confidence",
    "x1",
    "y1",
    "x2",
    "y2",
    "tile_image_path",
]


# ========================
# Helper functions
# ========================


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Stage 2 tile detection over downloaded catalogue pages."
    )
    parser.add_argument(
        "--catalogues-dir",
        type=str,
        default=str(INPUT_DIR),
        help="Catalogue root directory. Default: catalogues",
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=MODEL_PATH,
        help="Tile-detection weights path. Default: Models/catalogue_tile_detection_weight.pt",
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
        "--limit-catalogues",
        type=int,
        default=None,
        help="Optional cap on number of catalogue folders to process.",
    )
    parser.add_argument(
        "--limit-images",
        type=int,
        default=None,
        help="Optional cap on number of page images per catalogue.",
    )
    return parser.parse_args()


def setup_logging(script_dir: Path) -> tuple[logging.Logger, Path]:
    log_dir = script_dir / LOG_SUBDIR
    log_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"catalogue_tile_detection_log_{timestamp}.txt"

    logger = logging.getLogger("catalogue_tile_detection")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False
    handler = logging.FileHandler(log_file, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)
    return logger, log_file


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def safe_name(text: str) -> str:
    return text.replace(" ", "_").replace("/", "_")


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def find_catalogue_folders(base_dir: Path, limit: Optional[int] = None) -> List[Path]:
    """
    Find catalogue folders matching the downloader output structure:
    catalogues/<brand>/<year>/<catalogue_folder>
    """
    catalogue_folders = []

    if not base_dir.exists():
        return catalogue_folders

    for brand_dir in sorted(base_dir.iterdir()):
        if not brand_dir.is_dir():
            continue

        for year_dir in sorted(brand_dir.iterdir()):
            if not year_dir.is_dir():
                continue

            for catalogue_dir in sorted(year_dir.iterdir()):
                if not catalogue_dir.is_dir():
                    continue

                # only keep folders that actually contain page images
                image_files = [p for p in catalogue_dir.iterdir() if is_image_file(p)]
                if image_files:
                    catalogue_folders.append(catalogue_dir)
                    if limit is not None and len(catalogue_folders) >= limit:
                        return catalogue_folders

    return catalogue_folders


def find_images_in_catalogue(folder: Path, limit: Optional[int] = None) -> List[Path]:
    """Return page images stored directly inside one catalogue folder."""
    image_paths = sorted([p for p in folder.iterdir() if is_image_file(p)])
    if limit is not None:
        image_paths = image_paths[:limit]
    return image_paths


def process_catalogue_folder(
    logger: logging.Logger,
    catalogue_folder: Path,
    input_dir: Path,
    model: YOLO,
    imgsz: int,
    conf: float,
    limit_images: Optional[int],
) -> tuple[int, int, int]:
    rel_catalogue_path = catalogue_folder.relative_to(input_dir)
    parts = rel_catalogue_path.parts

    brand = parts[0] if len(parts) > 0 else ""
    year = parts[1] if len(parts) > 1 else ""
    catalogue_name = parts[2] if len(parts) > 2 else catalogue_folder.name

    image_paths = find_images_in_catalogue(catalogue_folder, limit=limit_images)
    if not image_paths:
        return 0, 0, 0

    output_dir = catalogue_folder / OUTPUT_SUBFOLDER
    csv_path = catalogue_folder / DETECTIONS_CSV_NAME

    if output_dir.exists():
        shutil.rmtree(output_dir)
    ensure_dir(output_dir)

    catalogue_tile_count = 0
    processed_images = 0
    with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(DETECTION_COLUMNS)

        for image_path in image_paths:
            processed_images += 1
            page_name = image_path.stem

            image = cv2.imread(str(image_path))
            if image is None:
                logger.warning("Could not read image: %s", image_path)
                continue

            results = model.predict(
                source=str(image_path),
                imgsz=imgsz,
                conf=conf,
                verbose=False,
            )

            if not results:
                continue

            result = results[0]
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            h, w = image.shape[:2]
            for i, box in enumerate(boxes):
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

                tile_filename = (
                    f"{safe_name(catalogue_name)}_"
                    f"{safe_name(page_name)}_"
                    f"{safe_name(class_name)}_"
                    f"{i:03d}_"
                    f"{confidence:.2f}.jpg"
                )

                tile_output_path = output_dir / tile_filename
                cv2.imwrite(str(tile_output_path), crop)

                writer.writerow(
                    [
                        brand,
                        year,
                        catalogue_name,
                        image_path.name,
                        page_name,
                        class_id,
                        class_name,
                        round(confidence, 4),
                        x1,
                        y1,
                        x2,
                        y2,
                        str(tile_output_path.relative_to(catalogue_folder)),
                    ]
                )

                catalogue_tile_count += 1

    files_produced = catalogue_tile_count + (1 if csv_path.exists() else 0)
    return processed_images, catalogue_tile_count, files_produced


def run_stage(
    catalogues_dir: Path,
    weights: Path,
    imgsz: int = IMG_SIZE,
    conf: float = CONF_THRESHOLD,
    limit_catalogues: Optional[int] = None,
    limit_images: Optional[int] = None,
    catalogue_dirs: Optional[Sequence[Path]] = None,
    on_catalogue_complete: Optional[Callable[[CatalogueStageOutcome], None]] = None,
) -> StageResult:
    script_dir = Path(__file__).resolve().parent
    logger, log_file = setup_logging(script_dir)
    result = make_stage_result("stage_2_tile_detection", log_file=log_file)

    logger.info("=" * 70)
    logger.info("CATALOGUE TILE EXTRACTION - SESSION START")
    logger.info("=" * 70)

    if not weights.exists():
        raise FileNotFoundError(f"Model weights not found: {weights}")
    if not catalogues_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {catalogues_dir}")

    model = YOLO(str(weights))
    selected_catalogues = list(catalogue_dirs) if catalogue_dirs is not None else find_catalogue_folders(
        catalogues_dir,
        limit=limit_catalogues,
    )
    if limit_catalogues is not None and catalogue_dirs is not None:
        selected_catalogues = selected_catalogues[:limit_catalogues]

    for catalogue_folder in selected_catalogues:
        catalogue_id = "/".join(catalogue_folder.relative_to(catalogues_dir).parts)
        start = perf_counter()
        try:
            processed_images, tile_count, files_produced = process_catalogue_folder(
                logger=logger,
                catalogue_folder=catalogue_folder,
                input_dir=catalogues_dir,
                model=model,
                imgsz=imgsz,
                conf=conf,
                limit_images=limit_images,
            )
            csv_path = catalogue_folder / DETECTIONS_CSV_NAME
            if not csv_path.exists():
                raise RuntimeError(f"Expected output missing: {csv_path}")

            status = "success" if processed_images > 0 else "skipped"
            outcome = CatalogueStageOutcome(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                status=status,
                rows_produced=tile_count,
                files_produced=files_produced,
                elapsed_seconds=perf_counter() - start,
                local_path=str(catalogue_folder),
                details={
                    "processed_images": processed_images,
                    "tile_output_dir": str((catalogue_folder / OUTPUT_SUBFOLDER)),
                    "detections_csv": str(csv_path),
                },
            )
            logger.info(
                "Catalogue %s | status=%s | images=%d | tiles=%d",
                catalogue_id,
                status,
                processed_images,
                tile_count,
            )
        except Exception as exc:
            failure = FailureDetail(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                error_type=type(exc).__name__,
                message=str(exc),
                traceback_summary=traceback.format_exc(limit=10),
                local_path=str(catalogue_folder),
            )
            outcome = CatalogueStageOutcome(
                stage_name=result.stage_name,
                catalogue_id=catalogue_id,
                status="failed",
                elapsed_seconds=perf_counter() - start,
                local_path=str(catalogue_folder),
                failure=failure,
            )
            logger.error("Catalogue failed: %s | %s", catalogue_id, exc)

        result.add_catalogue_result(outcome)
        if on_catalogue_complete is not None:
            on_catalogue_complete(outcome)

    logger.info(
        "TILE EXTRACTION COMPLETE - attempted=%d succeeded=%d skipped=%d failed=%d rows=%d files=%d",
        len(result.attempted_catalogues),
        len(result.succeeded_catalogues),
        len(result.skipped_catalogues),
        len(result.failed_catalogues),
        result.rows_produced,
        result.files_produced,
    )
    logger.info("=" * 70)
    logger.info("SESSION END")
    logger.info("=" * 70)
    return finish_stage_result(result)


# ========================
# Main
# ========================
def main():
    """
    Run batch tile extraction across all downloaded catalogues.

    This stage assumes the main catalogue scraper has already downloaded page
    images into the shared `catalogues/` directory structure.
    """
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    model_path = Path(args.weights)
    if not model_path.is_absolute():
        model_path = script_dir / model_path
    input_dir = script_dir / args.catalogues_dir

    if not model_path.exists():
        raise FileNotFoundError(f"Model weights not found: {model_path}")
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    print("\n" + "=" * 70)
    print("CATALOGUE TILE EXTRACTION")
    print("=" * 70)
    print(f"  Input: {input_dir}")
    print(f"  Model: {model_path}")
    print(f"  Img size: {args.imgsz}")
    print(f"  Conf threshold: {args.conf}")
    stage_result = run_stage(
        catalogues_dir=input_dir,
        weights=model_path,
        imgsz=args.imgsz,
        conf=args.conf,
        limit_catalogues=args.limit_catalogues,
        limit_images=args.limit_images,
    )
    if not stage_result.attempted_catalogues:
        print(f"[INFO] No catalogue folders found in: {input_dir}")
        return

    print("\n" + "=" * 70)
    print("TILE EXTRACTION COMPLETE")
    print("=" * 70)
    print(f"[DONE] Catalogues attempted: {len(stage_result.attempted_catalogues)}")
    print(f"[DONE] Successful catalogue extractions: {len(stage_result.succeeded_catalogues)}")
    print(f"[DONE] Skipped catalogues: {len(stage_result.skipped_catalogues)}")
    print(f"[DONE] Failed catalogues: {len(stage_result.failed_catalogues)}")
    print(f"[DONE] Tiles exported: {stage_result.rows_produced}")


if __name__ == "__main__":
    main()
