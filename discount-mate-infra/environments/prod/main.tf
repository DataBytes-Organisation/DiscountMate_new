locals {
  environment     = "prod"
  repo_root       = "../.."
  bucket_location = var.bucket_location == null ? var.region : var.bucket_location

  common_labels = merge(var.default_labels, {
    application = "discount-mate"
    environment = local.environment
    managed_by  = "opentofu"
  })
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
}
