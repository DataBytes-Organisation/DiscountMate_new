locals {
  environment     = "test"
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
  name               = "test-discount-mate-data"
  location           = local.bucket_location
  storage_class      = var.bucket_storage_class
  labels             = local.common_labels
  versioning_enabled = true
}
