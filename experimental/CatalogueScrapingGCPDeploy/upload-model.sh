#!/usr/bin/env bash
# upload-model.sh — Upload a new model weight to GCS with automatic versioning.
#
# What it does:
#   1. Determines the next version number by listing existing versions in GCS.
#   2. Uploads the .pt file to  models/<stage>/v<N>/<filename>
#   3. Copies it to            models/<stage>/latest/<filename>  (the default active version)
#   4. Appends an entry to     model-registry.json in the bucket root
#   5. Prints the env vars you need to pin this exact version on the Cloud Run Job.
#
# Usage:
#   export GCP_PROJECT_ID=your-project
#   export GCS_BUCKET=your-bucket
#
#   # Upload a new tile-detection model
#   bash upload-model.sh --stage tile --file Models/catalogue_tile_detection_weight.pt
#
#   # Upload a new zone-detection model with release notes
#   bash upload-model.sh --stage zone --file Models/catalogue_zone_detection_weight.pt \
#       --notes "Retrained on 2025 Woolworths + Coles dataset, mAP 0.91"
#
#   # Promote an existing version back to latest (rollback)
#   bash upload-model.sh --stage tile --rollback v1

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Please export GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET:?Please export GCS_BUCKET}"
STAGE=""
FILE=""
NOTES="(no notes)"
ROLLBACK_VERSION=""

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)     STAGE="$2";            shift 2 ;;
    --file)      FILE="$2";             shift 2 ;;
    --notes)     NOTES="$2";            shift 2 ;;
    --rollback)  ROLLBACK_VERSION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$STAGE" ]]; then
  echo "ERROR: --stage is required (tile | zone)"
  exit 1
fi
if [[ "$STAGE" != "tile" && "$STAGE" != "zone" ]]; then
  echo "ERROR: --stage must be 'tile' or 'zone'"
  exit 1
fi

# ── Derive filename from stage ─────────────────────────────────────────────────
if [[ "$STAGE" == "tile" ]]; then
  WEIGHT_FILENAME="catalogue_tile_detection_weight.pt"
  ENV_BLOB_VAR="TILE_MODEL_BLOB"
  ENV_CHECKSUM_VAR="TILE_MODEL_CHECKSUM"
  ENV_GENERATION_VAR="TILE_MODEL_GENERATION"
else
  WEIGHT_FILENAME="catalogue_zone_detection_weight.pt"
  ENV_BLOB_VAR="ZONE_MODEL_BLOB"
  ENV_CHECKSUM_VAR="ZONE_MODEL_CHECKSUM"
  ENV_GENERATION_VAR="ZONE_MODEL_GENERATION"
fi

GCS_PREFIX="gs://${BUCKET}/models/${STAGE}"
REGISTRY_BLOB="gs://${BUCKET}/model-registry.json"
LATEST_BLOB="${GCS_PREFIX}/latest/${WEIGHT_FILENAME}"

# ── Rollback path ─────────────────────────────────────────────────────────────
if [[ -n "$ROLLBACK_VERSION" ]]; then
  SOURCE_BLOB="${GCS_PREFIX}/${ROLLBACK_VERSION}/${WEIGHT_FILENAME}"

  echo "=== Rolling back $STAGE model to $ROLLBACK_VERSION ==="
  if ! gsutil -q stat "$SOURCE_BLOB"; then
    echo "ERROR: $SOURCE_BLOB does not exist in GCS."
    exit 1
  fi

  echo "  Copying $ROLLBACK_VERSION → latest..."
  gsutil cp "$SOURCE_BLOB" "$LATEST_BLOB"
  GENERATION=$(gsutil stat "$LATEST_BLOB" | grep "Generation:" | awk '{print $2}')
  CHECKSUM=$(gsutil hash -m "$LATEST_BLOB" | grep "Hash (md5)" | awk '{print $NF}')

  echo ""
  echo "=== Rollback complete ==="
  echo "  Active version : $ROLLBACK_VERSION"
  echo "  Latest blob    : $LATEST_BLOB"
  echo ""
  echo "Pin the Cloud Run Job to this version:"
  echo "  gcloud run jobs update catalogue-scraper \\"
  echo "    --update-env-vars ${ENV_BLOB_VAR}=models/${STAGE}/${ROLLBACK_VERSION}/${WEIGHT_FILENAME},${ENV_CHECKSUM_VAR}=${CHECKSUM},${ENV_GENERATION_VAR}=${GENERATION} \\"
  echo "    --region=us-central1 --project=${PROJECT_ID}"
  exit 0
fi

# ── Upload path ───────────────────────────────────────────────────────────────
if [[ -z "$FILE" ]]; then
  echo "ERROR: --file is required when not using --rollback"
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: File not found: $FILE"
  exit 1
fi

# Determine next version number
echo "=== Uploading new $STAGE model ==="
echo "  Source : $FILE"

EXISTING_VERSIONS=$(gsutil ls "${GCS_PREFIX}/" 2>/dev/null \
  | grep -oP 'v\d+' \
  | grep -oP '\d+' \
  | sort -n \
  | tail -1 || true)

if [[ -z "$EXISTING_VERSIONS" ]]; then
  NEXT_VERSION=1
else
  NEXT_VERSION=$(( EXISTING_VERSIONS + 1 ))
fi
VERSION_TAG="v${NEXT_VERSION}"
VERSIONED_BLOB="${GCS_PREFIX}/${VERSION_TAG}/${WEIGHT_FILENAME}"

echo "  Version: $VERSION_TAG"
echo "  GCS    : $VERSIONED_BLOB"

# Compute local MD5 checksum before upload
if command -v md5sum &>/dev/null; then
  LOCAL_CHECKSUM=$(md5sum "$FILE" | awk '{print $1}')
elif command -v md5 &>/dev/null; then
  # macOS
  LOCAL_CHECKSUM=$(md5 -q "$FILE")
else
  LOCAL_CHECKSUM="unknown"
fi
echo "  MD5    : $LOCAL_CHECKSUM"

# Upload to versioned path
echo ""
echo "  Uploading to versioned path..."
gsutil cp "$FILE" "$VERSIONED_BLOB"

# Copy to latest
echo "  Promoting to latest..."
gsutil cp "$VERSIONED_BLOB" "$LATEST_BLOB"

# Get the GCS-assigned generation number of the versioned blob (for exact pinning)
GENERATION=$(gsutil stat "$VERSIONED_BLOB" | grep "Generation:" | awk '{print $2}')

# ── Update model registry ─────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Download existing registry or start fresh
TMP_REGISTRY=$(mktemp /tmp/model-registry-XXXXXX.json)
if gsutil -q stat "$REGISTRY_BLOB" 2>/dev/null; then
  gsutil cp "$REGISTRY_BLOB" "$TMP_REGISTRY"
else
  echo "[]" > "$TMP_REGISTRY"
fi

# Append the new entry using Python (available in the build environment)
python3 - <<PYEOF
import json, sys

registry_path = "$TMP_REGISTRY"
with open(registry_path) as f:
    registry = json.load(f)

registry.append({
    "stage":      "$STAGE",
    "version":    "$VERSION_TAG",
    "filename":   "$WEIGHT_FILENAME",
    "blob":       "models/${STAGE}/${VERSION_TAG}/${WEIGHT_FILENAME}",
    "checksum":   "$LOCAL_CHECKSUM",
    "generation": "$GENERATION",
    "uploaded_at": "$TIMESTAMP",
    "notes":      "$NOTES",
})

with open(registry_path, "w") as f:
    json.dump(registry, f, indent=2)
PYEOF

gsutil cp "$TMP_REGISTRY" "$REGISTRY_BLOB"
rm -f "$TMP_REGISTRY"

echo ""
echo "=== Upload complete ==="
echo "  Versioned : $VERSIONED_BLOB"
echo "  Latest    : $LATEST_BLOB"
echo "  Generation: $GENERATION"
echo "  Registry  : $REGISTRY_BLOB"
echo ""
echo "The Cloud Run Job will automatically pick up the new model on next run"
echo "(it reads from 'latest/' by default)."
echo ""
echo "To PIN the Cloud Run Job to this exact version (recommended for production):"
echo ""
echo "  gcloud run jobs update catalogue-scraper \\"
echo "    --update-env-vars \\"
echo "      ${ENV_BLOB_VAR}=models/${STAGE}/${VERSION_TAG}/${WEIGHT_FILENAME},\\"
echo "      ${ENV_CHECKSUM_VAR}=${LOCAL_CHECKSUM},\\"
echo "      ${ENV_GENERATION_VAR}=${GENERATION} \\"
echo "    --region=us-central1 --project=${PROJECT_ID}"
echo ""
echo "To see all model versions:"
echo "  gsutil ls ${GCS_PREFIX}/"
echo "  gsutil cat $REGISTRY_BLOB | python3 -m json.tool"
