# discount-mate-infra

Infrastructure as code for Discount Mate using OpenTofu on Google Cloud.

This repository currently manages:

- Remote state stored in Google Cloud Storage
- One data bucket for `test`
- One data bucket for `prod`
- One Docker Artifact Registry repository for `prod`

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

This repository does not manage repo-specific push permissions. Any principal that already has sufficient Artifact Registry permissions through inherited GCP IAM can push images to it.

## OpenTofu notes

- Provider lockfiles are committed per environment and should be updated with OpenTofu
- Child modules resolve from the checked-out project root rather than `../` paths
