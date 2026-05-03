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

import csv
from pathlib import Path
from typing import List

import cv2
from ultralytics import YOLO

# ========================
# Configuration
# ========================
MODEL_PATH = "weights.pt"
# This stage consumes the folder structure produced by catalogue_scraper_main.py:
# catalogues/<store>/<year>/<catalogue_slug>/page_001.jpg
INPUT_DIR = Path("catalogues")

OUTPUT_SUBFOLDER = "exported_tiles"
DETECTIONS_CSV_NAME = "detections.csv"

IMG_SIZE = 640
CONF_THRESHOLD = 0.25

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


# ========================
# Helper functions
# ========================
def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def safe_name(text: str) -> str:
    return text.replace(" ", "_").replace("/", "_")


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def find_catalogue_folders(base_dir: Path) -> List[Path]:
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

    return catalogue_folders


def find_images_in_catalogue(folder: Path) -> List[Path]:
    """Return page images stored directly inside one catalogue folder."""
    return sorted([p for p in folder.iterdir() if is_image_file(p)])


# ========================
# Main
# ========================
def main():
    """
    Run batch tile extraction across all downloaded catalogues.

    This stage assumes the main catalogue scraper has already downloaded page
    images into the shared `catalogues/` directory structure.
    """
    script_dir = Path(__file__).resolve().parent
    model_path = script_dir / MODEL_PATH
    input_dir = script_dir / INPUT_DIR

    if not model_path.exists():
        raise FileNotFoundError(f"Model weights not found: {model_path}")

    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    print("\n" + "=" * 70)
    print("CATALOGUE TILE EXTRACTION")
    print("=" * 70)
    print(f"  Input: {input_dir}")
    print(f"  Model: {model_path.name}")

    model = YOLO(str(model_path))
    catalogue_folders = find_catalogue_folders(input_dir)

    if not catalogue_folders:
        print(f"[INFO] No catalogue folders found in: {input_dir}")
        return

    print(f"\n[INFO] Found {len(catalogue_folders)} catalogue folders")

    total_catalogues = 0
    successful_catalogues = 0
    total_images = 0
    total_tiles = 0
    progress_interval = max(1, len(catalogue_folders) // 20)

    for catalogue_folder in catalogue_folders:
        total_catalogues += 1

        rel_catalogue_path = catalogue_folder.relative_to(input_dir)
        parts = rel_catalogue_path.parts

        brand = parts[0] if len(parts) > 0 else ""
        year = parts[1] if len(parts) > 1 else ""
        catalogue_name = parts[2] if len(parts) > 2 else catalogue_folder.name

        image_paths = find_images_in_catalogue(catalogue_folder)

        if not image_paths:
            continue

        # Tile outputs stay inside each catalogue folder so that every stage of
        # the pipeline remains self-contained and easy to trace.
        output_dir = catalogue_folder / OUTPUT_SUBFOLDER
        csv_path = catalogue_folder / DETECTIONS_CSV_NAME

        ensure_dir(output_dir)

        catalogue_tile_count = 0
        # One detections CSV is written per catalogue so downstream steps can
        # join extracted tiles back to the original catalogue and page.
        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([
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
                "tile_image_path"
            ])

            for image_path in image_paths:
                total_images += 1
                page_name = image_path.stem

                image = cv2.imread(str(image_path))
                if image is None:
                    continue

                results = model.predict(
                    source=str(image_path),
                    imgsz=IMG_SIZE,
                    conf=CONF_THRESHOLD,
                    verbose=False
                )

                if not results:
                    continue

                result = results[0]
                boxes = result.boxes

                if boxes is None or len(boxes) == 0:
                    continue

                h, w = image.shape[:2]
                page_tile_count = 0

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

                    writer.writerow([
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
                        str(tile_output_path.relative_to(catalogue_folder))
                    ])

                    page_tile_count += 1
                    catalogue_tile_count += 1
                    total_tiles += 1
        if catalogue_tile_count > 0:
            successful_catalogues += 1
        if total_catalogues % progress_interval == 0 or total_catalogues == len(catalogue_folders):
            progress_pct = (total_catalogues / len(catalogue_folders)) * 100
            print(
                f"[INFO] Progress: {progress_pct:.0f}% "
                f"({total_catalogues}/{len(catalogue_folders)} catalogues) | "
                f"Successful: {successful_catalogues} | Tiles: {total_tiles}"
            )

    print("\n" + "=" * 70)
    print("TILE EXTRACTION COMPLETE")
    print("=" * 70)
    print(f"[DONE] Catalogues processed: {total_catalogues}")
    print(f"[DONE] Successful catalogue extractions: {successful_catalogues}")
    print(f"[DONE] Images processed: {total_images}")
    print(f"[DONE] Tiles exported: {total_tiles}")


if __name__ == "__main__":
    main()
