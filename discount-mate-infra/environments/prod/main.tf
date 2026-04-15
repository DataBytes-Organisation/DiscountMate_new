locals {
  environment     = "prod"
  repo_root       = "../.."
  bucket_location = var.bucket_location == null ? var.region : var.bucket_location
  enabled_apis = toset([
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
  ])

  common_labels = merge(var.default_labels, {
    application = "discount-mate"
    environment = local.environment
    managed_by  = "opentofu"
  })
}

resource "google_project_service" "enabled_apis" {
  for_each = local.enabled_apis

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

module "data_bucket" {
  source = "${local.repo_root}/modules/gcs_bucket"

  project_id         = var.project_id
  name               = "discount-mate-data"
  location           = local.bucket_location
  storage_class      = var.bucket_storage_class
  labels             = local.common_labels
  versioning_enabled = true
}

module "artifact_registry" {
  source = "${local.repo_root}/modules/artifact_registry"

  project_id                         = var.project_id
  location                           = var.region
  repository_id                      = var.artifact_registry_repository_id
  description                        = "Production Docker images for Discount Mate."
  labels                             = local.common_labels
  cleanup_delete_untagged_older_than = var.artifact_registry_cleanup_delete_untagged_older_than
  cleanup_policy_dry_run             = var.artifact_registry_cleanup_dry_run

  depends_on = [google_project_service.enabled_apis]
}

module "github_actions_identity" {
  source = "${local.repo_root}/modules/github_actions_identity"

  project_id                        = var.project_id
  service_account_id                = var.github_actions_service_account_id
  service_account_display_name      = "GitHub Actions Prod CI/CD"
  service_account_description       = "Service account and key used by GitHub Actions for prod image publishing and Cloud Run deployment."

  depends_on = [google_project_service.enabled_apis]
}
