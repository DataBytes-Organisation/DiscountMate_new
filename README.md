# DiscountMate

**Updated version:** Trimester 1, 2026  
**Organisation:** DataBytes  
**Repository:** `DataBytes-Organisation/DiscountMate_new`

DiscountMate is a capstone grocery price intelligence platform that helps Australian shoppers compare supermarket prices, track savings, manage grocery lists, discover specials, and access AI-supported shopping assistance. The project combines full-stack application development, data engineering, machine learning, data analytics, cyber security, and cloud deployment work into one integrated product.

The T1 2026 version focuses on making DiscountMate more production-ready through Cloud Run deployment, CI/CD automation, ML sidecar services, a custom domain, Profile Hub improvements, and stronger support for live showcase demonstrations.

## Live Application

| Service | URL |
| --- | --- |
| Custom domain | https://discountmate.app/ |
| Frontend Cloud Run | https://webdev-frontend-518391291595.australia-southeast1.run.app/ |
| Backend Cloud Run | https://webdev-backend-518391291595.australia-southeast1.run.app/ |
| API docs | https://webdev-backend-518391291595.australia-southeast1.run.app/api-docs |

Current live deployment flow:

```text
discountmate.app
-> Firebase Hosting
-> Cloud Run frontend
-> Cloud Run backend
-> ML sidecars inside backend service
```

## Project Goals

DiscountMate aims to:

- Help users compare grocery prices across major Australian retailers.
- Surface weekly specials and discount opportunities.
- Support smarter shopping lists and basket comparison.
- Provide personalised user hub features such as profile management, notifications, subscriptions, support, and privacy pages.
- Use ML/AI features for recommendations, OCR receipt extraction, reverse image search, price prediction, and recipe assistance.
- Provide a deployable cloud architecture that can be maintained by future project teams.

## Key Features

- Product browsing, searching, and filtering.
- Category-based product discovery.
- Product detail and price comparison views.
- Basket and grocery list management.
- Smart list and list reprice support.
- Weekly specials powered through backend and ML endpoints.
- Reverse image search for product lookup.
- OCR receipt extraction support.
- Recipe assistant / RAG chatbot.
- Profile Hub with dashboard, notifications, alert segments, profile management, subscription, support, and privacy/terms pages.
- Support request submission to the project support email.
- Custom domain for showcase-ready access.

## Repository Structure

```text
DiscountMate_new/
|-- Backend/                    # Node.js / Express backend API
|-- Backend/ml-service/          # Python Flask ML service
|-- Backend/ml-service/reverse_image_search/
|   `--                         # FastAPI reverse image search sidecar
|-- Frontend/                   # Expo / React Native Web frontend
|-- DE/                         # Data Engineering ETL pipeline work
|-- ML/                         # ML research, notebooks, and experiments
|-- Data/                       # Data resources and local data references
|-- docs-site/                  # Docusaurus documentation site
|-- discount-mate-infra/        # Infrastructure as code / cloud setup references
|-- Catalogue_Scraping_2025/    # Catalogue OCR and scraping support
|-- Documentation/              # Project documentation
|-- .github/workflows/          # GitHub Actions workflows
|-- firebase.json               # Firebase Hosting rewrite to Cloud Run frontend
`-- README.md                   # Project overview and setup guide
```

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | Expo, React Native Web, TypeScript |
| Backend | Node.js, Express, MongoDB |
| ML service | Python, Flask, Gunicorn |
| Reverse image search | Python, FastAPI, Uvicorn, FAISS |
| OCR | Tesseract OCR and Python image processing |
| Recipe assistant | RAG pipeline, OpenRouter-compatible LLM integration |
| Data Engineering | Python, DuckDB, PostgreSQL, ETL pipelines |
| Deployment | Docker, Google Cloud Run, Artifact Registry |
| Hosting | Firebase Hosting custom domain rewrite |
| CI/CD | GitHub Actions |
| Documentation | Docusaurus, Markdown |

## Cloud Architecture

The current Cloud Run architecture keeps the frontend public and the backend as the single API entrypoint.

```text
User browser
-> discountmate.app
-> Firebase Hosting
-> webdev-frontend Cloud Run service
-> webdev-backend Cloud Run service
   -> backend container, port 8080
   -> ml-service sidecar, port 5001
   -> reverse-image-search sidecar, port 8001
```

The ML containers are not exposed publicly. The backend calls them through localhost inside the same Cloud Run service:

```text
ML_SERVICE_URL=http://127.0.0.1:5001
REVERSE_IMAGE_SEARCH_SERVICE_URL=http://127.0.0.1:8001
```

This keeps the public API surface smaller while still allowing the frontend to access ML-backed features through normal backend routes.

## Main Services

### Frontend

Location:

```text
Frontend/
```

The frontend is an Expo / React Native Web app. It is built as a web export and deployed to Cloud Run. The deployed frontend reads the backend API URL from:

```text
EXPO_PUBLIC_API_URL
```

Example:

```text
EXPO_PUBLIC_API_URL=https://webdev-backend-518391291595.australia-southeast1.run.app/api
```

### Backend

Location:

```text
Backend/
```

The backend is an Express API that handles product, user, basket, list, notification, support, ML proxy, reverse image search proxy, and Swagger documentation routes.

Important deployed backend routes:

```text
GET  /
GET  /api-docs
GET  /api/products
GET  /api/categories
GET  /api/ml/weekly-specials
POST /api/ml/recommendations
POST /api/ml/price-prediction
POST /api/contact
GET  /api/reverse-image-search/health
```

### ML Service

Location:

```text
Backend/ml-service/
```

The ML service provides:

- Weekly specials endpoint.
- Recommendation endpoint.
- Price prediction endpoint.
- OCR receipt processing.
- Recipe RAG endpoints.

It runs on port `5001` in deployment.

### Reverse Image Search

Location:

```text
Backend/ml-service/reverse_image_search/
```

Reverse image search runs as a dedicated FastAPI sidecar on port `8001`. It loads FAISS assets from Google Cloud Storage in Cloud Run.

## Local Development Setup

### Prerequisites

Install:

- Node.js 20+
- npm
- Python 3.10 or 3.11
- Docker Desktop
- Google Cloud CLI, only required for deployment tasks
- Firebase CLI, only required for Firebase hosting/domain tasks

Clone the repository:

```bash
git clone https://github.com/DataBytes-Organisation/DiscountMate_new.git
cd DiscountMate_new
```

If working from a fork, add the organisation repository as upstream:

```bash
git remote add upstream https://github.com/DataBytes-Organisation/DiscountMate_new.git
git fetch upstream
```

## Backend Local Setup

```bash
cd Backend
npm ci
cp .env.example .env
npm start
```

Default local backend:

```text
http://localhost:3000
```

Backend scripts:

```bash
npm start
npm run lint
npm run check:ci
```

Required local environment variables are documented in:

```text
Backend/.env.example
```

Minimum local backend values:

```text
PORT=3000
BASE_URL=http://localhost:3000
MONGO_URI=<mongodb connection string>
JWT_SECRET=<local jwt secret>
CORS_ORIGIN=http://localhost:8081
ML_SERVICE_URL=http://localhost:5001
REVERSE_IMAGE_SEARCH_SERVICE_URL=http://localhost:8001
```

Support email variables:

```text
SUPPORT_EMAIL=supportdiscountmate@gmail.com
SUPPORT_EMAIL_USER=supportdiscountmate@gmail.com
SUPPORT_EMAIL_APP_PASSWORD=<gmail app password>
```

Do not commit `.env` files or real secrets.

## Frontend Local Setup

```bash
cd Frontend
npm ci
cp .env.example .env
npm run web
```

Default local frontend:

```text
http://localhost:8081
```

Frontend scripts:

```bash
npm run web
npm run lint
npm run test:ci
npm run build:web
```

Frontend environment:

```text
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For live builds:

```text
EXPO_PUBLIC_API_URL=https://webdev-backend-518391291595.australia-southeast1.run.app/api
```

## ML Service Local Setup

```bash
cd Backend/ml-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Default local ML service:

```text
http://localhost:5001
```

Useful checks:

```bash
curl http://localhost:5001/health
curl "http://localhost:5001/api/weekly-specials?limit=2"
```

Some ML features require additional environment variables:

```text
GOOGLE_CLOUD_PROJECT=sit-26t1-discountmate-935cb94
FAISS_BUCKET_NAME=discountmate-ml-models
FAISS_OBJECT_NAME=reverse_image_search.faiss
RAG_BUCKET_NAME=discountmate-ml-models
RAG_OBJECT_PREFIX=recipe_rag/
OPEN_ROUTER_API_KEY=<secret>
HUGGING_FACE_TOKEN=<secret>
```

## Reverse Image Search Local Setup

Reverse image search can be run locally as a separate FastAPI service:

```bash
cd Backend/ml-service
source venv/bin/activate
uvicorn reverse_image_search.api:app --host 0.0.0.0 --port 8001
```

Default local reverse image search service:

```text
http://localhost:8001
```

Health check:

```bash
curl http://localhost:8001/health
```

If using GCS assets locally, authenticate with Google Cloud:

```bash
gcloud auth application-default login
gcloud config set project sit-26t1-discountmate-935cb94
gcloud auth application-default set-quota-project sit-26t1-discountmate-935cb94
```

## Running the Full App Locally

Use three terminals.

Terminal 1, ML service:

```bash
cd Backend/ml-service
source venv/bin/activate
python app.py
```

Terminal 2, backend:

```bash
cd Backend
npm start
```

Terminal 3, frontend:

```bash
cd Frontend
npm run web
```

Then open:

```text
http://localhost:8081
```

## CI/CD Workflow

Primary workflow:

```text
.github/workflows/app-dev-cloud-run-prep.yml
```

The workflow has two main purposes:

- Validate PRs with frontend, backend, and ML checks.
- Deploy frontend and backend services to Cloud Run after changes are merged to `main`, when deployment is enabled.

Deployment is gated by:

```text
ENABLE_CLOUD_RUN_DEPLOY=true
```

The workflow builds and pushes images for:

- `webdev-frontend`
- `webdev-backend`
- `webdev-ml-service`
- `webdev-reverse-image-search`

Images are pushed to Artifact Registry:

```text
australia-southeast1-docker.pkg.dev/sit-26t1-discountmate-935cb94/discount-mate-images
```

## Required GitHub Actions Variables

Set in:

```text
GitHub repository -> Settings -> Secrets and variables -> Actions -> Variables
```

Required variables:

```text
ENABLE_CLOUD_RUN_DEPLOY=true
GCP_PROJECT_ID=sit-26t1-discountmate-935cb94
GCP_REGION=australia-southeast1
GCP_ARTIFACT_REGISTRY_REPO=discount-mate-images
BACKEND_CLOUD_RUN_SERVICE=webdev-backend
FRONTEND_CLOUD_RUN_SERVICE=webdev-frontend
BACKEND_IMAGE_NAME=webdev-backend
FRONTEND_IMAGE_NAME=webdev-frontend
ML_IMAGE_NAME=webdev-ml-service
REVERSE_IMAGE_SEARCH_IMAGE_NAME=webdev-reverse-image-search
BACKEND_PUBLIC_API_URL=https://webdev-backend-518391291595.australia-southeast1.run.app/api
CORS_ORIGIN=https://webdev-frontend-518391291595.australia-southeast1.run.app,https://discountmate.app,https://www.discountmate.app
FAISS_BUCKET_NAME=discountmate-ml-models
FAISS_OBJECT_NAME=reverse_image_search.faiss
RAG_BUCKET_NAME=discountmate-ml-models
RAG_OBJECT_PREFIX=recipe_rag/
```

Optional variables:

```text
BASE_URL=https://webdev-backend-518391291595.australia-southeast1.run.app
ANALYTICS_SERVICE_URL=<analytics service url if available>
```

## Required GitHub Actions Secrets

Set in:

```text
GitHub repository -> Settings -> Secrets and variables -> Actions -> Secrets
```

Required secrets:

```text
GCP_SA_KEY
MONGO_URI
JWT_SECRET
OPEN_ROUTER_API_KEY
HUGGING_FACE_TOKEN
SUPPORT_EMAIL
SUPPORT_EMAIL_USER
SUPPORT_EMAIL_APP_PASSWORD
```

Important:

- `GCP_SA_KEY` authenticates GitHub Actions to Google Cloud.
- `SUPPORT_EMAIL_APP_PASSWORD` must be a Gmail app password, not a normal Gmail password.
- Do not store real secrets in source files, screenshots, PR descriptions, or issue comments.

## Google Cloud Deployment Notes

Main project:

```text
sit-26t1-discountmate-935cb94
```

Region:

```text
australia-southeast1
```

Runtime service account:

```text
github-actions-prod@sit-26t1-discountmate-935cb94.iam.gserviceaccount.com
```

Current public Cloud Run services:

```text
webdev-backend
webdev-frontend
```

The backend service uses multiple containers in a single Cloud Run revision:

```text
backend                 port 8080
ml-service              port 5001
reverse-image-search    port 8001
```

## Firebase Hosting and Custom Domain

Firebase Hosting is used to provide a clean public domain for the frontend:

```text
https://discountmate.app/
```

The Firebase config rewrites all routes to the Cloud Run frontend:

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "webdev-frontend",
          "region": "australia-southeast1"
        }
      }
    ]
  }
}
```

Because the browser origin becomes `https://discountmate.app`, the backend CORS configuration must include:

```text
https://discountmate.app
https://www.discountmate.app
```

## Manual Cloud Run Validation

Useful deployed backend checks:

```bash
curl https://webdev-backend-518391291595.australia-southeast1.run.app/
curl https://webdev-backend-518391291595.australia-southeast1.run.app/api/reverse-image-search/health
curl "https://webdev-backend-518391291595.australia-southeast1.run.app/api/ml/weekly-specials?limit=2"
```

Check CORS from the custom domain:

```bash
curl -i -H 'Origin: https://discountmate.app' \
  'https://webdev-backend-518391291595.australia-southeast1.run.app/api/products?page=1'
```

Expected:

```text
HTTP/2 200
access-control-allow-origin: https://discountmate.app
```

Test support email endpoint:

```bash
curl -i -H 'Origin: https://discountmate.app' \
  -F 'name=Deployment Test' \
  -F 'email=supportdiscountmate@gmail.com' \
  -F 'topic=Other' \
  -F 'subject=Cloud Run support email test' \
  -F 'message=Testing support email delivery from Cloud Run deployment.' \
  'https://webdev-backend-518391291595.australia-southeast1.run.app/api/contact'
```

Expected:

```text
emailStatus: "sent"
```

## Data Engineering

The `DE/` folder contains ETL pipeline work for transforming retailer data into structured outputs used by the application and analytics work.

Current focus areas include:

- Retailer product ingestion.
- Bronze to silver transformations.
- Product identity and matching.
- Category and retailer normalization.
- Price and promotion history.
- Reusable ETL framework patterns.

See:

```text
DE/etl-pipeline/
```

## Documentation Site

The `docs-site/` folder contains the Docusaurus documentation site.

Run locally:

```bash
cd docs-site
npm ci
npm start
```

Build:

```bash
npm run build
```

## Branching and Contribution Guide

Recommended workflow:

```bash
git fetch upstream
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

Before opening a PR:

```bash
git status
git diff
```

Run relevant checks:

```bash
cd Backend && npm run check:ci
cd Frontend && npm run lint
cd Frontend && npm run test:ci
cd Frontend && npm run build:web
```

PR guidance:

- Keep PRs focused and reviewable.
- Do not commit `.env` files, credentials, model artefacts, or local virtual environments.
- Include screenshots or test evidence for UI and deployment changes.
- Mention any required GitHub Secrets, GCP permissions, or manual setup steps.
- For deployment changes, explain whether they were tested locally, manually on Cloud Run, or through GitHub Actions.

## Security and Secret Handling

Never commit:

- `.env` files
- Gmail app passwords
- API keys
- MongoDB credentials
- Google Cloud service account JSON
- Hugging Face tokens
- OpenRouter keys
- large private model files

Use GitHub Secrets or Google Secret Manager for sensitive values.

If a secret is accidentally exposed:

1. Revoke or rotate it immediately.
2. Update GitHub Secrets or Secret Manager.
3. Tell the team lead or mentor.
4. Avoid reusing the exposed value.

## Known Deployment Considerations

- Cloud Run reserves the `PORT` variable for the ingress container. Do not manually set `PORT` in the Cloud Run manifest.
- Docker images for Cloud Run must support `linux/amd64`.
- ML containers may need higher memory and longer startup probes than the backend.
- Reverse image search requires access to FAISS files in Google Cloud Storage.
- Recipe RAG and LLM features require external API keys and model/token configuration.
- Firebase custom domain traffic requires matching backend CORS origins.
- Support email requires a Gmail app password.

## Troubleshooting

### Frontend loads but products fail

Check:

- `EXPO_PUBLIC_API_URL`
- Backend Cloud Run health
- Backend CORS origin
- Browser console network errors

### Backend cannot call ML service

Check:

- `ML_SERVICE_URL`
- ML sidecar startup logs
- Cloud Run multi-container manifest
- ML container memory and startup probe

### Reverse image search fails

Check:

- `REVERSE_IMAGE_SEARCH_SERVICE_URL`
- FAISS GCS bucket and object names
- Runtime service account GCS permissions
- Reverse image search container logs

### Support request does not email

Check:

- `SUPPORT_EMAIL`
- `SUPPORT_EMAIL_USER`
- `SUPPORT_EMAIL_APP_PASSWORD`
- Gmail app password validity
- Backend `/api/contact` response `emailStatus`

### GitHub Actions deploy does not run

Check:

- Branch is `main`
- `ENABLE_CLOUD_RUN_DEPLOY=true`
- Required variables are set
- Required secrets are set
- GitHub Actions permissions and GCP service account permissions

## Project Handover Notes

For future teams:

- Keep the custom domain and Cloud Run URLs documented.
- Keep GitHub Actions variables and secrets up to date.
- Rotate exposed or outdated secrets.
- Continue using small PRs for deployment changes.
- Validate production-like changes manually before relying on automation when external services are involved.
- Keep ML assets out of Git unless they are intentionally small and approved for version control.
- Add evidence to PRs when changing deployment, security, or user-facing behaviour.

## Contact and Support

Project support email:

```text
supportdiscountmate@gmail.com
```

For repository access, deployment permissions, or GCP issues, contact the current DataBytes project leads, mentors, or assigned technical administrators.

## Acknowledgement

DiscountMate is developed as a Deakin University DataBytes capstone project. The T1 2026 version reflects contributions across App Development, Data Engineering, Machine Learning, Data Analytics, Cyber Security, Infrastructure, and Documentation teams.
