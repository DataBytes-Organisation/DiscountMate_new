#!/usr/bin/env bash
# deploy-gcp.sh — Build and deploy the catalogue scraping pipeline to GCP.
#
# Targets the services actually available in this project:
#   Cloud Run (Service)   — runs the pipeline container on demand
#   Cloud Storage         — stores model weights and pipeline outputs (us-central1)
#   Artifact Registry     — stores the Docker image
#   Cloud Logging         — receives structured JSON logs from the pipeline
#
# Scheduling: Cloud Scheduler is NOT available in this project.
# Use the GitHub Actions workflow at .github/workflows/trigger-scraper.yml instead.
# It runs on a cron and calls POST /run on the Cloud Run Service.
#
# Note: Cloud Run Services have a hard 3600-second (60 min) request timeout.
# A weekly incremental run (new catalogues only) fits comfortably within this.
# For a full-archive rerun, set STAGE2_LIMIT_CATALOGUES / STAGE3_LIMIT_CATALOGUES
# env vars to batch the work across multiple runs.
#
# Prerequisites:
#   - Docker installed locally (used to build the image — Cloud Build not available)
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Billing enabled on the project
#   - Model weights uploaded to GCS via upload-model.sh
#
# Usage (deploy with latest model weights):
#   export GCP_PROJECT_ID=your-project-id
#   export GCS_BUCKET=your-bucket-name
#   bash deploy-gcp.sh
#
# Usage (pin to a specific model version — values printed by upload-model.sh):
#   export TILE_MODEL_BLOB=models/tile/v2/catalogue_tile_detection_weight.pt
#   export TILE_MODEL_CHECKSUM=abc123...
#   export TILE_MODEL_GENERATION=1234567890
#   export ZONE_MODEL_BLOB=models/zone/v1/catalogue_zone_detection_weight.pt
#   export ZONE_MODEL_CHECKSUM=def456...
#   export ZONE_MODEL_GENERATION=9876543210
#   bash deploy-gcp.sh

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Please export GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET:?Please export GCS_BUCKET}"
# Region matches your Cloud Storage bucket (us-central1)
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="catalogue-scraper"
SA_NAME="catalogue-scraper-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REPO="catalogue-scraper"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}:latest"

echo "=== Deploying catalogue-scraper ==="
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Bucket  : $BUCKET"
echo "  Image   : $IMAGE"
echo ""

# ── Enable required GCP APIs ──────────────────────────────────────────────────
echo "[1/6] Enabling GCP APIs..."
# Only APIs available in this project — Cloud Scheduler and Cloud Build excluded.
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  logging.googleapis.com \
  --project="$PROJECT_ID"

# ── Service account ───────────────────────────────────────────────────────────
echo "[2/6] Creating service account..."
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Catalogue Scraper" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  (already exists)"

# GCS read/write for model weights and outputs; log writing for Cloud Logging
for ROLE in roles/storage.objectAdmin roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

# ── Artifact Registry repo ────────────────────────────────────────────────────
echo "[3/6] Creating Artifact Registry repository..."
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  (already exists)"

# ── Build and push Docker image (local build — Cloud Build not available) ─────
echo "[4/6] Building Docker image locally and pushing to Artifact Registry..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Authenticate local Docker to push to Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

docker build --platform linux/amd64 -t "$IMAGE" "$SCRIPT_DIR"
docker push "$IMAGE"

# ── Deploy Cloud Run Service ──────────────────────────────────────────────────
echo "[5/6] Deploying Cloud Run Service..."
# --concurrency=1   : only one pipeline request runs at a time (enforced by server.py lock too)
# --max-instances=1 : prevents a second container from starting during a long run
# --min-instances=0 : scales to zero when idle — no cost between runs
# --timeout=3600    : maximum for Cloud Run Services; covers a weekly incremental run
# --no-allow-unauthenticated : callers must present a valid GCP identity token
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --service-account "$SA_EMAIL" \
  --timeout=3600 \
  --memory=8Gi \
  --cpu=4 \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=1 \
  --no-allow-unauthenticated \
  --set-env-vars "GCS_BUCKET=${BUCKET},GCP_PROJECT=${PROJECT_ID},MODELS_LOCAL_DIR=/tmp/models,CATALOGUE_PIPELINE_MODE=pipeline,TILE_MODEL_BLOB=${TILE_MODEL_BLOB:-models/tile/latest/catalogue_tile_detection_weight.pt},TILE_MODEL_CHECKSUM=${TILE_MODEL_CHECKSUM:-},TILE_MODEL_GENERATION=${TILE_MODEL_GENERATION:-},ZONE_MODEL_BLOB=${ZONE_MODEL_BLOB:-models/zone/latest/catalogue_zone_detection_weight.pt},ZONE_MODEL_CHECKSUM=${ZONE_MODEL_CHECKSUM:-},ZONE_MODEL_GENERATION=${ZONE_MODEL_GENERATION:-}"

# Grant the GitHub Actions service account permission to invoke this service.
# The GitHub Actions workflow authenticates with GCP_SA_KEY and calls POST /run.
gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker" \
  --quiet

# ── Upload model weights to GCS (first-time setup) ───────────────────────────
echo "[6/6] Checking model weights in GCS..."
for WEIGHT_FILE in catalogue_tile_detection_weight.pt catalogue_zone_detection_weight.pt; do
  LOCAL_PATH="$SCRIPT_DIR/Models/$WEIGHT_FILE"
  if [[ "$WEIGHT_FILE" == *tile* ]]; then
    GCS_PATH="gs://${BUCKET}/models/tile/latest/${WEIGHT_FILE}"
  else
    GCS_PATH="gs://${BUCKET}/models/zone/latest/${WEIGHT_FILE}"
  fi

  if gsutil -q stat "$GCS_PATH" 2>/dev/null; then
    echo "  $GCS_PATH — already present, skipping upload"
  elif [[ -f "$LOCAL_PATH" ]]; then
    echo "  Uploading $WEIGHT_FILE → $GCS_PATH"
    gsutil cp "$LOCAL_PATH" "$GCS_PATH"
  else
    echo "  WARNING: $WEIGHT_FILE not found locally and not in GCS."
    echo "           Run: bash upload-model.sh --stage tile --file <path-to-weights.pt>"
  fi
done

# ── Print service URL and trigger instructions ────────────────────────────────
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')

echo ""
echo "=== Deployment complete ==="
echo "  Cloud Run Service : $SERVICE_URL"
echo "  Authenticated     : POST /run to trigger pipeline"
echo "  Health check      : GET  /health"
echo ""
echo "── Manual trigger ──────────────────────────────────────────────────────"
echo "  TOKEN=\$(gcloud auth print-identity-token)"
echo "  curl -sf -X POST -H \"Authorization: Bearer \$TOKEN\" ${SERVICE_URL}/run"
echo ""
echo "── Automated weekly trigger ────────────────────────────────────────────"
echo "  See .github/workflows/trigger-scraper.yml"
echo "  Add these GitHub repository secrets:"
echo "    GCP_SA_KEY      — JSON key for service account: $SA_EMAIL"
echo "    GCP_PROJECT_ID  — $PROJECT_ID"
echo "    SCRAPER_URL     — $SERVICE_URL"
