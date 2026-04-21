# discount-mate-infra

Infrastructure as code for Discount Mate using OpenTofu on Google Cloud.

This repository currently manages:

- Remote state stored in Google Cloud Storage
- One data bucket for `test`
- One data bucket for `prod`
- One Docker Artifact Registry repository for `prod`
- One GitHub Actions service account and key for `prod`
- One Cloud Run backend service and Secret Manager secrets for `prod`
- One Cloud SQL PostgreSQL instance for `prod`

The layout is intentionally split by environment and uses shared modules so Cloud Run and PostgreSQL can be added later without restructuring the repo.

## Repository layout

```text
.
├── environments
│   ├── prod
│   └── test
└── modules
    ├── artifact_registry
    ├── cloud_run
    ├── gcs_bucket
    ├── github_actions_identity
    └── postgresql
```

## Prerequisites

- Google Cloud project already created
- A GCS bucket already created for OpenTofu remote state
- Google Cloud credentials available locally
- `tofu` installed

For local authentication, prefer Application Default Credentials:

```bash
gcloud auth application-default login
```

## Usage

1. Copy the example files in the target environment:

```bash
cd environments/test
cp backend.hcl.example backend.hcl
cp env.auto.tfvars.example env.auto.tfvars
```

2. Update the values:

- `backend.hcl`: remote state bucket and state prefix
- `env.auto.tfvars`: GCP project, region, labels, and bucket settings

3. Initialize and plan:

```bash
tofu init -backend-config=backend.hcl
tofu plan
```

4. Apply when ready:

```bash
tofu apply
```

## Current managed resources

- `environments/test`: bucket `test-discount-mate-data`
- `environments/prod`: bucket `discount-mate-data`
- `environments/prod`: Docker repository `australia-southeast1-docker.pkg.dev/<project>/discount-mate-images`
- `environments/prod`: GitHub Actions CI/CD service account and service account key
- `environments/prod`: Cloud Run service `webdev-backend`
- `environments/prod`: Secret Manager secrets for backend Mongo URI and JWT secret
- `environments/prod`: Cloud SQL PostgreSQL instance, one database, and one application user

## Scaling later

The repository is prepared for future expansion through shared modules and environment roots.

- `modules/cloud_run`: planned module contract for application deployment
- `modules/postgresql`: planned module contract for PostgreSQL provisioning
- Each environment already owns its provider, backend, variables, and outputs

When Cloud Run or PostgreSQL is introduced later, each environment can adopt those modules independently without changing the current state layout.

The production Artifact Registry output can be used directly as the base path for container image tags, for example:

```text
australia-southeast1-docker.pkg.dev/<project>/discount-mate-images/app:<tag>
```

The production GitHub Actions CI/CD service account is managed in this repository and reused as the Cloud Run runtime identity for the backend service.

## Prod Backend Cloud Run

The production backend service is deployed to Cloud Run using:

- service name `webdev-backend`
- image `australia-southeast1-docker.pkg.dev/sit-26t1-discountmate-935cb94/discount-mate-images/webdev-backend:latest`
- public unauthenticated HTTPS access
- runtime service account equal to the existing GitHub Actions service account

The backend receives these environment variables:

- `PORT=8080`
- `GOOGLE_CLOUD_PROJECT=<project_id>`
- `MONGO_URI` from Secret Manager
- `JWT_SECRET` from Secret Manager

Terraform creates the following secrets and initial secret versions:

- `webdev-backend-mongo-uri`
- `webdev-backend-jwt-secret`

These are standard Secret Manager secrets with user-managed replication pinned to the prod region.

The initial secret values are supplied via Terraform inputs, which means they are stored in Terraform state.

If the application needs `BASE_URL` to equal the generated Cloud Run URL, use a two-step apply:

1. Apply with `base_url = null`.
2. Read the output `backend_service_url`.
3. Set `base_url` to that URL and apply again.

## Prod PostgreSQL

The production PostgreSQL database is provisioned with Cloud SQL using:

- instance name `discount-mate-prod-postgres`
- PostgreSQL `POSTGRES_16`
- public IPv4 enabled
- one logical database `discount_mate`
- one application user `discount_mate_app`

Public access is limited with Cloud SQL authorized networks. Cloud SQL does not support native country-based allow rules, so the Australian restriction is implemented as a manually maintained CIDR allowlist in `postgres_authorized_networks`.

The first rollout uses a small single-zone baseline and keeps backups and deletion protection disabled.

## GitHub Actions Key Auth

This repository now provisions a single production service account for GitHub Actions and generates a JSON credentials key for it.

The same service account is used for both CI/CD actions and Cloud Run runtime identity.

Set the following values from `environments/prod` outputs as GitHub Actions variables or secrets in `DataBytes-Organisation/DiscountMate_new`:

- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_SERVICE_ACCOUNT_KEY`
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `GCP_CLOUD_RUN_SERVICE`

`GCP_SERVICE_ACCOUNT_KEY` should contain the sensitive Terraform output `github_actions_service_account_private_key`.

This approach is less secure than workload identity federation and the generated key will exist in Terraform state.

Example workflow:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v3
        with:
          credentials_json: ${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker auth
        run: gcloud auth configure-docker "${{ vars.GCP_REGION }}-docker.pkg.dev" --quiet

      - name: Build image
        run: |
          docker build -t "${{ vars.GCP_ARTIFACT_REGISTRY_REPOSITORY }}/app:${{ github.sha }}" .

      - name: Push image
        run: |
          docker push "${{ vars.GCP_ARTIFACT_REGISTRY_REPOSITORY }}/app:${{ github.sha }}"

      - id: deploy
        uses: google-github-actions/deploy-cloudrun@v3
        with:
          service: ${{ vars.GCP_CLOUD_RUN_SERVICE }}
          region: ${{ vars.GCP_REGION }}
          image: "${{ vars.GCP_ARTIFACT_REGISTRY_REPOSITORY }}/app:${{ github.sha }}"
          flags: >-
            --service-account=${{ vars.GCP_SERVICE_ACCOUNT_EMAIL }}
```

## OpenTofu notes

- Provider lockfiles are committed per environment and should be updated with OpenTofu
- Child modules resolve from the checked-out project root rather than `../` paths
