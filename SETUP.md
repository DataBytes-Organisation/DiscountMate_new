# DiscountMate — Full Stack Setup Guide

This guide covers everything needed to run the complete DiscountMate application locally and on GCP. It is a standalone reference; for feature-specific details see [README.md](README.md).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [GCP Setup](#3-gcp-setup)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Prerequisites

Complete all of these before starting any setup step.

### Accounts and access

| Requirement | Notes |
|---|---|
| GCP project with billing enabled | The FAISS index is stored in GCS. Contact the project owner for access. |
| MongoDB Atlas account or connection string | Required to run the Node.js backend. |
| Google Cloud SDK (`gcloud`) installed | Used for GCS authentication on local machines. |

Install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install

### Runtime versions

| Tool | Required version | How to verify |
|---|---|---|
| Python | 3.10, 3.11, or 3.12 (not 3.13 — some ML deps fail to install) | `python3 --version` |
| Node.js | [TODO: confirm — check `Backend/package.json` engines field] | `node --version` |
| npm | Bundled with Node.js | `npm --version` |

### Python package manager

The `python3-venv` module is required to create isolated Python environments.

- **macOS**: included with Python 3 from Homebrew (`brew install python3`)
- **Windows**: included with Python 3.10–3.12 from python.org
- **WSL / Linux (Debian/Ubuntu)**: `sudo apt install python3 python3-venv python3-full`

---

## 2. Local Development Setup

### Step 1 — Clone the repository

```bash
git clone <repository-url>
cd DiscountMate_new
```

[TODO: confirm — add the canonical repository URL here]

### Step 2 — Backend environment variables

Copy the example file and fill in your values:

```bash
cp Backend/.env.example Backend/.env
```

Open `.env` and set at minimum:

```env
PORT=3000
BASE_URL=http://localhost:3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_string

# Google Cloud (required for FAISS index download on first run)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
FAISS_BUCKET_NAME=discountmate-ml-models
FAISS_OBJECT_NAME=reverse_image_search.faiss
```

Generate `JWT_SECRET` with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the printed value into `Backend/.env`:

```env
JWT_SECRET=<printed-value>
```

See [Section 4 — Environment Variables Reference](#4-environment-variables-reference) for all available variables.

### Step 3 — Backend Node.js dependencies

```bash
cd Backend
npm install
```

### Step 4 — ml-service Python virtual environment

```bash
cd Backend/ml-service
python3 -m venv venv

# macOS / Linux / WSL:
source venv/bin/activate

# Windows (Command Prompt):
# venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt
```

### Step 5 — Authenticate with Google Cloud (for FAISS download)

Run these once per machine. They write Application Default Credentials that the Python sidecar uses to download the FAISS index from GCS.

```bash
gcloud auth login
gcloud auth application-default login
```

### Step 6 — Start the services

Open three separate terminals:

**Terminal 1 — Python ML Service (Flask, port 5001)**
```bash
cd Backend/ml-service
./start.sh
```

**Terminal 2 — Node.js Backend**
```bash
cd Backend
node server.js
```

> `node server.js` automatically downloads the FAISS index from GCS on first run (cached at `Backend/ml-service/ml_models/reverse_image_search.faiss`) and spawns the Reverse Image Search FastAPI sidecar on port 8001 before accepting any requests. No separate terminal is needed for the sidecar.

**Terminal 3 — Frontend**
```bash
cd Frontend
npm install
npm start
# or
npx expo start
```

### Step 7 — Verify the full stack

```bash
# Node.js backend root
curl http://localhost:3000/

# Flask ML service health
curl http://localhost:5001/health

# Reverse image search sidecar (auto-spawned by node server.js)
curl http://localhost:8001/health

# End-to-end: reverse image search via Node.js proxy
curl -X POST "http://localhost:3000/api/reverse-image-search" \
  -F "file=@/path/to/any-product-image.jpg"
```

All four commands should return HTTP 200. If the sidecar health check fails, wait up to 5 minutes for the first-run DINOv2 and FAISS downloads to complete.

### First-run note

The first `node server.js` run triggers two large downloads automatically:

1. **DINOv2 model** (~330 MB) — downloaded from PyTorch Hub into the Torch Hub cache directory
2. **FAISS index** — downloaded from GCS to `Backend/ml-service/ml_models/reverse_image_search.faiss`

Subsequent runs use the local caches and start in seconds.

---

## 3. GCP Setup

### Step 1 — GCP project

Identify or create a GCP project and note its project ID.

```bash
# List your projects
gcloud projects list

# Set the active project
gcloud config set project your-gcp-project-id
```

### Step 2 — Service account and IAM permissions

For production deployments, the application needs a service account with these IAM roles:

| Role | Purpose |
|---|---|
| `roles/storage.objectViewer` | Read the FAISS index from GCS |
| `roles/secretmanager.secretAccessor` | Read `mongo-uri` and `jwt-secret` from Secret Manager |

[TODO: confirm — verify whether any additional roles are needed (Firestore, Pub/Sub, etc.)]

```bash
# Create service account
gcloud iam service-accounts create discountmate-backend \
  --display-name="DiscountMate Backend" \
  --project=your-gcp-project-id

# Grant GCS read access
gcloud projects add-iam-policy-binding your-gcp-project-id \
  --member="serviceAccount:discountmate-backend@your-gcp-project-id.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Grant Secret Manager read access
gcloud projects add-iam-policy-binding your-gcp-project-id \
  --member="serviceAccount:discountmate-backend@your-gcp-project-id.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3 — GCS bucket and FAISS index

Create the bucket (skip if it already exists):

```bash
gcloud storage buckets create gs://discountmate-ml-models \
  --project=your-gcp-project-id \
  --location=your-preferred-region
```

Upload the FAISS index. The index is built by the notebooks in `ML/ReverseImageSearch/`. After building locally, upload it:

```bash
gcloud storage cp path/to/reverse_image_search.faiss \
  gs://discountmate-ml-models/reverse_image_search.faiss
```

[TODO: confirm — verify whether `reverse_image_search_metadata.json` also needs to be in GCS or if it is committed to the repository and deployed with the code]

### Step 4 — Secret Manager secrets

When `NODE_ENV=production`, the Node.js backend reads `MONGO_URI` and `JWT_SECRET` from Secret Manager rather than from environment variables. Create the secrets once:

```bash
# MongoDB connection string
printf '%s' 'your_mongodb_connection_string' | \
  gcloud secrets create mongo-uri \
    --data-file=- \
    --project=your-gcp-project-id

# JWT signing key
printf '%s' 'your_jwt_secret_key' | \
  gcloud secrets create jwt-secret \
    --data-file=- \
    --project=your-gcp-project-id
```

The default secret names are `mongo-uri` and `jwt-secret`. If you use different names, set `MONGO_URI_SECRET_NAME` and `JWT_SECRET_SECRET_NAME` in the deployment environment.

### Step 5 — Deployment

[TODO: confirm — the deployment configuration file (`app.yaml` for App Engine or a Cloud Run service definition) is not present in the audited codebase. Add the correct deploy command once that file is located.]

The runtime detects its GCP environment automatically:
- **Cloud Run**: the `K_SERVICE` env var is set automatically
- **App Engine**: the `GAE_SERVICE` env var is set automatically

In either environment, the FAISS index is cached at `/tmp/reverse_image_search.faiss`.

---

## 4. Environment Variables Reference

Set these in `Backend/.env` for local development. In production, `MONGO_URI` and `JWT_SECRET` are read from Secret Manager; other variables are set in the deployment configuration.

### Node.js backend

| Variable | Service | Required | Default | Description | Example |
|---|---|---|---|---|---|
| `PORT` | Backend | No | `8080` | Express server port. `.env.example` sets this to `3000` for local dev. | `3000` |
| `BASE_URL` | Backend | No | — | Public base URL of the backend | `http://localhost:3000` |
| `NODE_ENV` | Backend | No | — | Set to `production` to enable Secret Manager and trust proxy headers | `production` |
| `MONGO_URI` | Backend | Yes (local) | — | MongoDB connection string. Loaded from Secret Manager in production. | `mongodb+srv://u:p@cluster/db` |
| `JWT_SECRET` | Backend | Yes (local) | — | Secret key for signing JWTs. Loaded from Secret Manager in production. | `some-long-random-value` |
| `MONGO_URI_SECRET_NAME` | Backend | No | `mongo-uri` | Secret Manager name for `MONGO_URI` | `mongo-uri` |
| `JWT_SECRET_SECRET_NAME` | Backend | No | `jwt-secret` | Secret Manager name for `JWT_SECRET` | `jwt-secret` |
| `GOOGLE_CLOUD_PROJECT` | Backend + Sidecar | Yes | — | GCP project ID. Required for Secret Manager (production) and GCS (all envs). | `my-project-123` |
| `UPLOAD_DIR` | Backend | No | `<os.tmpdir>/uploads` | Temporary directory for uploaded images | `/tmp/uploads` |

### Reverse image search sidecar

| Variable | Service | Required | Default | Description | Example |
|---|---|---|---|---|---|
| `FAISS_BUCKET_NAME` | Sidecar | No | `discountmate-ml-models` | GCS bucket containing the FAISS index | `discountmate-ml-models` |
| `FAISS_OBJECT_NAME` | Sidecar | No | `reverse_image_search.faiss` | GCS object path for the FAISS index file | `reverse_image_search.faiss` |
| `FAISS_GCP_PROJECT` | Sidecar | No | — | GCP project that owns the FAISS bucket, if different from `GOOGLE_CLOUD_PROJECT` | `other-project-456` |
| `LOCAL_FAISS_PATH` | Sidecar | No | `ml_models/reverse_image_search.faiss` (local) or `/tmp/reverse_image_search.faiss` (GCP) | Override the local FAISS cache path | `/data/faiss/index.faiss` |
| `RIS_PYTHON` | Backend (launcher) | No | `venv/bin/python` (if venv exists) | Absolute path to the Python executable used to spawn the sidecar | `/usr/bin/python3.11` |
| `RIS_STARTUP_TIMEOUT_MS` | Backend (launcher) | No | `300000` (5 min) | Milliseconds to wait for the sidecar to become healthy on startup | `600000` |

### Python ML service (Flask)

| Variable | Service | Required | Default | Description | Example |
|---|---|---|---|---|---|
| `ML_SERVICE_PORT` | ML Service | No | `5001` | Port for the Flask service | `5001` |
| `MONGO_URI` | ML Service | No | — | MongoDB connection string for model endpoints that query the database | `mongodb+srv://...` |
| `MONGO_DB` | ML Service | No | — | MongoDB database name | `discountmate` |

---

## 5. Troubleshooting

### FAISS index download fails at startup

**Symptom:** `node server.js` exits with `Failed to download FAISS index from gs://discountmate-ml-models/...` and the sidecar never becomes healthy.

**Resolution:**

1. **Not authenticated locally:**
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project your-gcp-project-id
   ```

2. **`GOOGLE_CLOUD_PROJECT` not set:** Check that `Backend/.env` has `GOOGLE_CLOUD_PROJECT=your-gcp-project-id`.

3. **Index file missing from GCS:**
   ```bash
   gcloud storage ls gs://discountmate-ml-models/
   ```
   If `reverse_image_search.faiss` is not listed, build it from `ML/ReverseImageSearch/` notebooks and upload it (see [GCP Setup Step 3](#step-3----gcs-bucket-and-faiss-index)).

4. **Corrupted local cache from a previous interrupted download:** Delete the partial file and restart:
   ```bash
   rm Backend/ml-service/ml_models/reverse_image_search.faiss
   node server.js
   ```

---

### Sidecar uses the wrong Python and fails to import packages

**Symptom:** `node server.js` logs `[ReverseImageSearch] No venv or conda python found; falling back to system python3` followed by `ModuleNotFoundError: No module named 'fastapi'` (or similar).

**Resolution:** The sidecar must use the venv Python, not the system Python. Create the venv if it does not exist:

```bash
cd Backend/ml-service
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

If you have a non-standard Python location, set `RIS_PYTHON` in `Backend/.env`:

```env
RIS_PYTHON=/absolute/path/to/python3
```

---

### Reverse image search returns 502 after working initially

**Symptom:** `node server.js` logs `[ReverseImageSearch] Sidecar exited unexpectedly (code N). Restart the server to recover.` All reverse image search requests return 502.

**Cause:** The FastAPI/uvicorn sidecar process crashed after startup. The Node.js server continues running but cannot reach the sidecar.

**Resolution:** Restart `node server.js`. To find the root cause, look in the console output for lines prefixed with `[ReverseImageSearch]` — Python tracebacks appear there. Common causes:

- **Out of memory:** The DINOv2 model requires several GB of RAM. Reduce concurrent request load or run on a machine with more memory.
- **FAISS index file corrupt:** Delete the cached file and re-download:
  ```bash
  rm Backend/ml-service/ml_models/reverse_image_search.faiss
  node server.js
  ```

---

### MongoDB or Secret Manager errors on startup

**Symptom:** `node server.js` fails with `Failed to initialize MongoDB` or a permission error mentioning Secret Manager.

**Resolution:**

1. **Local development** (`NODE_ENV` not set to `production`): Set `MONGO_URI` and `JWT_SECRET` directly in `Backend/.env`.

2. **Production** (`NODE_ENV=production`): The backend reads these from Secret Manager. Verify:
   - Secrets `mongo-uri` and `jwt-secret` exist in the GCP project
   - The runtime service account has `roles/secretmanager.secretAccessor`
   - `GOOGLE_CLOUD_PROJECT` is set in the deployment environment

3. **Custom secret names:** If your secrets use different names, set overrides in the environment:
   ```env
   MONGO_URI_SECRET_NAME=my-mongo-secret
   JWT_SECRET_SECRET_NAME=my-jwt-secret
   ```
