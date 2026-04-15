# Catalogue Scraping Pipeline Planner

## Goal

Automated weekly scraping of Australian supermarket catalogues (Woolworths, Coles, Aldi, IGA),
extracting structured product and price data through a 4-stage ML pipeline deployed on GCP.

---

## Pipeline Architecture

```
Stage 1  →  Stage 2       →  Stage 3          →  Stage 4
Download     Tile Detection   Zone Detection       OCR Fusion
(scraper)    (YOLO)           (YOLO)               (PaddleOCR + Tesseract)
```

Each stage writes its outputs into the shared catalogue folder structure:

```
catalogues/<store>/<year>/<catalogue_slug>/
  page_001.jpg ... page_NNN.jpg       ← Stage 1 outputs
  metadata.json
  exported_tiles/*.jpg                ← Stage 2 outputs
  detections.csv
  exported_zones/*.jpg                ← Stage 3 outputs
  zone_detections.csv
  ocr_results.csv                     ← Stage 4 outputs
  ocr_attempts.csv
```

Master aggregate CSVs under `catalogue_data/`:
- `catalogue_tracking.csv`
- `historical_zone_detections.csv`
- `historical_ocr_results.csv`
- `historical_ocr_attempts.csv`

---

## Stage Status

### Stage 1 — Catalogue Download
**File:** `catalogue_scraper_main.py`

- Fetches archive metadata from `catalogueau.com`
- Supports all four stores: `woolworths`, `coles`, `aldi`, `iga`
- Downloads page images into `catalogues/<store>/<year>/<slug>/page_###.jpg`
- Writes per-catalogue `metadata.json`
- Writes and updates `catalogue_data/catalogue_tracking.csv`
- Fully non-interactive when `--pipeline-mode pipeline` or env `CATALOGUE_PIPELINE_MODE=pipeline`

**Status: production-ready**

---

### Stage 2 — Tile Detection
**File:** `catalogue_tile_detection.py`

- Loads YOLO weights from `Models/catalogue_tile_detection_weight.pt` (or GCS)
- Runs YOLO over page images, exports cropped tiles + `detections.csv`
- Callable programmatically via `run_stage()` — no subprocess shelling

**Status: production-ready**

---

### Stage 3 — Zone Detection
**File:** `catalogue_zone_detection.py`

- Loads YOLO weights from `Models/catalogue_zone_detection_weight.pt` (or GCS)
- Detects OCR subregions inside tile images
- Exports zone crops + `zone_detections.csv` + appends to master CSV
- Callable programmatically via `run_stage()`

**Status: production-ready**

---

### Stage 4 — OCR Fusion
**File:** `catalogue_ocr.py`

- Reads zone crops + `zone_detections.csv` per catalogue
- Runs PaddleOCR for text extraction
- Runs Tesseract as price-parsing fallback
- Extracts: `Name`, `Price_Now`, `Save_amount`, `PriceWas`, `UnitPrice`
- Writes `ocr_results.csv`, `ocr_attempts.csv`, appends to master CSVs
- Callable programmatically via `run_stage()`

**Status: production-ready**

---

### Orchestration
**File:** `catalogue_scraper_main.py`

- Single command runs all four stages in sequence
- Incremental logic: skips catalogues already fully processed, resumes partial ones
- Per-catalogue stage state tracked and written to run manifests
- GCS sync: downloads control artifacts before run, uploads outputs after each stage
- Preflight checks: validates model files, Tesseract, PaddleOCR before processing starts
- Structured JSON logs written to stdout (Cloud Logging compatible) and per-run log files
- Failure policy: `continue` — one failed catalogue does not block the rest

**Status: production-ready**

---

## Resolved Gaps (from earlier planner)

| Gap | Resolution |
|-----|-----------|
| No single orchestrator for all four stages | `catalogue_scraper_main.py` orchestrates all stages via `run_pipeline()` |
| Incremental processing inconsistent after Stage 1 | `determine_incremental_decisions()` inspects local + GCS state per catalogue |
| No shared pipeline state | Per-run JSON manifests written to `catalogue_data/pipeline_runs/` and GCS |
| Configuration split across scripts | Unified in `resolve_config()` — env vars or CLI args, one surface |
| PaddleOCR environment risk | Preflight check in `preflight_checks()` validates OCR before any processing |

---

## GCP Deployment

### Available GCP services used

| Service | Role |
|---------|------|
| **Cloud Run (Service)** | Runs the pipeline container on demand |
| **Cloud Storage (us-central1)** | Stores model weights, catalogue outputs, run manifests |
| **Artifact Registry** | Stores the Docker image |
| **Cloud Logging** | Receives structured JSON logs from the pipeline |

### Services NOT available (and what replaces them)

| Not available | Replacement |
|---------------|-------------|
| Cloud Run Jobs | Cloud Run Service with `--timeout=3600` |
| Cloud Scheduler | GitHub Actions cron workflow |
| Cloud Build | Local `docker build + push` |

---

### Container

**Base image:** `python:3.11-slim-bookworm`

Key runtime dependencies:
- `paddlepaddle==2.6.2` (CPU-only, installed before `requirements.txt`)
- `paddleocr==2.8.1`
- `ultralytics==8.3.0`
- `opencv-python==4.10.0.84`
- `tesseract-ocr` (system package)
- `libgl1-mesa-glx` (system package — required by OpenCV on slim images)

**HTTP wrapper:** `server.py` — listens on `$PORT` (default 8080), exposes:
- `GET  /health` — Cloud Run health probe
- `POST /run`    — triggers the full pipeline; blocks until complete; returns JSON

---

### Deployment files

| File | Purpose |
|------|---------|
| `Dockerfile` | Container definition |
| `.dockerignore` | Excludes `catalogues/`, `Models/`, `*.pt`, notebooks from the image layer |
| `server.py` | HTTP wrapper — required for Cloud Run Service |
| `deploy-gcp.sh` | One-command deploy: enables APIs, creates service account, builds + pushes image, deploys Cloud Run Service, uploads model weights |
| `upload-model.sh` | Versioned model upload to GCS with registry tracking |
| `.github/workflows/trigger-scraper.yml` | Replaces Cloud Scheduler — weekly cron + manual dispatch |

---

### Model weight versioning

Weights are stored in GCS with versioned paths:

```
gs://<bucket>/
  models/
    tile/
      v1/catalogue_tile_detection_weight.pt
      v2/catalogue_tile_detection_weight.pt
      latest/catalogue_tile_detection_weight.pt   ← active version
    zone/
      v1/catalogue_zone_detection_weight.pt
      latest/catalogue_zone_detection_weight.pt
  model-registry.json   ← audit log: version, date, MD5, GCS generation, notes
```

The pipeline resolves weights via `TILE_MODEL_BLOB` / `ZONE_MODEL_BLOB` env vars (default: `latest/`).
Checksums and GCS generation numbers are validated at startup via `ensure_model_file()`.

**Workflow:**
1. Train new model → `bash upload-model.sh --stage tile --file weights.pt --notes "..."`
2. Script auto-increments version, uploads to `vN/`, copies to `latest/`, updates registry
3. Cloud Run Service picks up the new weights on next cold start (reads `latest/` by default)
4. To pin to a specific version, set `TILE_MODEL_BLOB=models/tile/v2/...` and redeploy

---

### Scheduling

Weekly trigger: **GitHub Actions** (`.github/workflows/trigger-scraper.yml`)
- Cron: `0 0 * * 3` — Wednesdays midnight UTC = 11am AEDT
- Authenticates to GCP using `GCP_SA_KEY` repository secret
- Calls `POST /run` on the Cloud Run Service URL
- Manual dispatch available from the GitHub Actions tab

Required GitHub repository secrets:
```
GCP_SA_KEY      — JSON key for catalogue-scraper-sa@<project>.iam.gserviceaccount.com
GCP_PROJECT_ID  — GCP project ID
SCRAPER_URL     — Cloud Run Service URL (printed at end of deploy-gcp.sh)
```

---

### Runtime environment variables (set on Cloud Run Service)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GCS_BUCKET` | — (required) | GCS bucket for all outputs |
| `GCP_PROJECT` | — (required) | GCP project ID |
| `MODELS_LOCAL_DIR` | `/tmp/models` | Local cache for downloaded model weights |
| `CATALOGUE_PIPELINE_MODE` | `pipeline` | Non-interactive mode |
| `TILE_MODEL_BLOB` | `models/tile/latest/...` | GCS path to tile detection weights |
| `TILE_MODEL_CHECKSUM` | — | Optional MD5 for weight validation |
| `TILE_MODEL_GENERATION` | — | Optional GCS generation for weight validation |
| `ZONE_MODEL_BLOB` | `models/zone/latest/...` | GCS path to zone detection weights |
| `ZONE_MODEL_CHECKSUM` | — | Optional MD5 for weight validation |
| `ZONE_MODEL_GENERATION` | — | Optional GCS generation for weight validation |
| `CATALOGUE_STORES` | all four stores | Comma-separated store slugs |
| `CATALOGUE_YEARS` | 2020–current | Comma-separated years |

---

## Operational Runbook

### First-time setup

```bash
# 1. Set required variables
export GCP_PROJECT_ID=your-project-id
export GCS_BUCKET=your-bucket-name

# 2. Upload model weights to GCS
bash upload-model.sh --stage tile --file Models/catalogue_tile_detection_weight.pt
bash upload-model.sh --stage zone --file Models/catalogue_zone_detection_weight.pt

# 3. Deploy
bash deploy-gcp.sh
```

### Manual pipeline trigger

```bash
TOKEN=$(gcloud auth print-identity-token)
curl -sf -X POST -H "Authorization: Bearer $TOKEN" <SERVICE_URL>/run
```

### Trigger for specific stores/years (override env vars before redeploying)

```bash
export CATALOGUE_STORES=coles,woolworths
export CATALOGUE_YEARS=2025
bash deploy-gcp.sh
```

### Deploy a new model version

```bash
bash upload-model.sh --stage tile \
  --file Models/catalogue_tile_detection_weight.pt \
  --notes "Retrained April 2026, mAP 0.92"
# Cloud Run picks up the new weights on next run (reads latest/ by default)
```

### Rollback a model

```bash
bash upload-model.sh --stage tile --rollback v1
```

### View pipeline logs

```
GCP Console → Cloud Logging → filter: resource.type="cloud_run_revision"
```

---

## Known Constraints

- **60-minute hard timeout** on Cloud Run Services. Weekly incremental runs (new catalogues only) fit within this. A full-archive reprocess should be batched using `STAGE2_LIMIT_CATALOGUES` / `STAGE3_LIMIT_CATALOGUES` env vars across multiple runs.
- **No GPU** on Cloud Run — YOLO and PaddleOCR run CPU-only. Inference is slower than GPU but sufficient for a weekly batch job.
- **Models cached to `/tmp/models`** — ephemeral per container instance. Every cold start re-downloads weights from GCS. With typical model sizes (~50 MB each), this adds ~10–15 seconds to cold start.
- **SSL verification disabled** on the catalogue CDN downloader (`session.verify = False`) — acceptable for a known internal CDN but worth revisiting if the CDN endpoint changes.
