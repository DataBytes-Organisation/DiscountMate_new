---
title: Discount Mate Infrastructure
sidebar_label: Overview
sidebar_position: 1
---

# Discount Mate Infrastructure

`discount-mate-infra` manages DiscountMate Google Cloud resources with OpenTofu. It is split by environment and uses shared modules so services can be added without restructuring the project.

## Repository layout

```text
discount-mate-infra/
├── environments/
│   ├── prod/
│   └── test/
└── modules/
    ├── artifact_registry/
    ├── cloud_run/
    ├── cloud_run_job/
    ├── gcs_bucket/
    ├── github_actions_identity/
    └── postgresql/
```

## Prerequisites

- Google Cloud project already created
- GCS bucket already created for OpenTofu remote state
- Google Cloud credentials available locally
- `tofu` installed

Authenticate locally with Application Default Credentials:

```bash
gcloud auth application-default login
```

## Environment workflow

From the target environment directory:

```bash
cd discount-mate-infra/environments/test
cp backend.hcl.example backend.hcl
cp env.auto.tfvars.example env.auto.tfvars
```

Update:

| File | Purpose |
|---|---|
| `backend.hcl` | Remote state bucket and state prefix. |
| `env.auto.tfvars` | GCP project, region, labels, resource names, and environment-specific settings. |

Initialize, review, and apply:

```bash
tofu init -backend-config=backend.hcl
tofu plan
tofu apply
```

## Managed resources

| Environment | Resources |
|---|---|
| `test` | GCS data bucket `test-discount-mate-data`. |
| `prod` | GCS data bucket, Docker Artifact Registry, GitHub Actions service account and key, backend Cloud Run service, ingestion Cloud Run jobs, Cloud Scheduler triggers, Secret Manager secrets, and Cloud SQL PostgreSQL. |

Production currently enables these Google Cloud APIs:

- Artifact Registry
- Cloud Scheduler
- IAM
- Cloud Run
- Secret Manager
- Cloud SQL Admin

## Production ingestion jobs

Production deploys four Cloud Run jobs with the same ingestion container image. Each job passes a different `--source` argument:

| Job | Arguments | Schedule |
|---|---|---|
| `discount-mate-ingestion-ww` | `--source ww --runner products` | Saturday 06:00 Australia/Melbourne |
| `discount-mate-ingestion-iga` | `--source iga --runner products` | Saturday 07:00 Australia/Melbourne |
| `discount-mate-ingestion-aldi` | `--source aldi --runner products` | Saturday 08:00 Australia/Melbourne |
| `discount-mate-ingestion-coles` | `--source coles --runner products` | Saturday 09:00 Australia/Melbourne |

All jobs write CSV output to the production data bucket through `APP_DESTINATIONS=gcs`. Source-specific cookies, ScraperAPI keys, and IGA store settings are supplied through `environments/prod/env.auto.tfvars`.

## Production backend service

The backend runs on Cloud Run as `webdev-backend`.

Key settings:

| Setting | Value |
|---|---|
| Container port | `8080` |
| Ingress | Public unauthenticated HTTPS |
| Runtime identity | GitHub Actions service account managed by this infrastructure project |
| Secrets | Mongo URI and JWT secret values are provided through Terraform inputs |

The current Terraform creates Secret Manager secrets and initial secret versions, but the backend module also receives `MONGO_URI` and `JWT_SECRET` as environment variables. Secret values supplied through Terraform inputs are stored in Terraform state.

When `BASE_URL` needs to match the generated Cloud Run URL, use a two-step apply:

1. Apply with `base_url = null`.
2. Read the `backend_service_url` output.
3. Set `base_url` to that URL and apply again.

## Production PostgreSQL

Production PostgreSQL is provisioned with Cloud SQL.

| Setting | Value |
|---|---|
| Instance | `discount-mate-prod-postgres` |
| Version | PostgreSQL 16 |
| Database | `discount_mate` |
| Application user | `discount_mate_app` |
| Connectivity | Public IPv4 with authorized networks |

Authorized networks are manually maintained CIDR ranges. Cloud SQL does not provide a native country-based allow rule, so Australian-only access must be represented with explicit CIDR entries.

## GitHub Actions identity

The infrastructure provisions a production service account and JSON key for GitHub Actions.

Set these outputs as GitHub repository variables or secrets in `DataBytes-Organisation/DiscountMate_new`:

| Name | Store as | Notes |
|---|---|---|
| `GCP_SERVICE_ACCOUNT_EMAIL` | Variable | Service account email. |
| `GCP_SERVICE_ACCOUNT_KEY` | Secret | JSON credentials key from the sensitive Terraform output. |
| `GCP_PROJECT_ID` | Variable | Target GCP project. |
| `GCP_REGION` | Variable | Target deployment region. |
| `GCP_ARTIFACT_REGISTRY_REPOSITORY` | Variable | Docker repository path. |
| `GCP_CLOUD_RUN_SERVICE` | Variable | Backend Cloud Run service name. |

This key-based approach is less secure than workload identity federation because the generated private key exists in Terraform state and GitHub secrets.

## Module responsibilities

| Module | Purpose |
|---|---|
| `gcs_bucket` | Creates data buckets with labels, location, storage class, and versioning settings. |
| `artifact_registry` | Creates Docker Artifact Registry repositories and cleanup policies. |
| `github_actions_identity` | Creates the service account and key used by CI/CD. |
| `cloud_run` | Deploys backend-style Cloud Run services. |
| `cloud_run_job` | Deploys Cloud Run jobs and Cloud Scheduler triggers. |
| `postgresql` | Provisions Cloud SQL PostgreSQL instances, databases, and users. |

## Change checklist

- Run `tofu fmt` before committing infrastructure changes.
- Run `tofu plan` in the affected environment.
- Review changes to secrets carefully because Terraform state stores secret input values.
- Keep provider lockfiles committed per environment.
- Do not reuse state paths across environments.
