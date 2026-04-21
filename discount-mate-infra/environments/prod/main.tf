locals {
  environment     = "prod"
  repo_root       = "../.."
  bucket_location = var.bucket_location == null ? var.region : var.bucket_location
  enabled_apis = toset([
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
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

  project_id                   = var.project_id
  service_account_id           = var.github_actions_service_account_id
  service_account_display_name = "GitHub Actions Prod CI/CD"
  service_account_description  = "Service account and key used by GitHub Actions for prod image publishing and Cloud Run deployment."

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret" "backend_mongo_uri" {
  project   = var.project_id
  secret_id = var.backend_mongo_secret_name
  labels    = local.common_labels

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "backend_mongo_uri" {
  secret      = google_secret_manager_secret.backend_mongo_uri.name
  secret_data = var.mongo_uri
}

resource "google_secret_manager_secret" "backend_jwt_secret" {
  project   = var.project_id
  secret_id = var.backend_jwt_secret_name
  labels    = local.common_labels

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "backend_jwt_secret" {
  secret      = google_secret_manager_secret.backend_jwt_secret.name
  secret_data = var.jwt_secret
}

# resource "google_secret_manager_secret_iam_member" "backend_mongo_uri_accessor" {
#   secret_id = google_secret_manager_secret.backend_mongo_uri.id
#   role      = "roles/secretmanager.secretAccessor"
#   member    = "serviceAccount:${module.github_actions_identity.github_actions_service_account_email}"
# }

# resource "google_secret_manager_secret_iam_member" "backend_jwt_secret_accessor" {
#   secret_id = google_secret_manager_secret.backend_jwt_secret.id
#   role      = "roles/secretmanager.secretAccessor"
#   member    = "serviceAccount:${module.github_actions_identity.github_actions_service_account_email}"
# }

module "backend_service" {
  source = "${local.repo_root}/modules/cloud_run"

  project_id            = var.project_id
  region                = var.region
  service_name          = var.backend_service_name
  container_image       = var.backend_container_image
  service_account_email = module.github_actions_identity.github_actions_service_account_email
  container_port        = 8080
  env_vars = {
    GOOGLE_CLOUD_PROJECT = var.project_id
    MONGO_URI            = var.mongo_uri
    JWT_SECRET           = var.jwt_secret
  }
  base_url           = var.base_url
  min_instance_count = var.backend_min_instance_count
  max_instance_count = var.backend_max_instance_count
  ingress            = "INGRESS_TRAFFIC_ALL"

  depends_on = [
    google_project_service.enabled_apis,
    google_secret_manager_secret_version.backend_mongo_uri,
    google_secret_manager_secret_version.backend_jwt_secret,
    # google_secret_manager_secret_iam_member.backend_mongo_uri_accessor,
    # google_secret_manager_secret_iam_member.backend_jwt_secret_accessor,
  ]
}

module "postgresql" {
  source = "${local.repo_root}/modules/postgresql"

  project_id          = var.project_id
  region              = var.region
  instance_name       = var.postgres_instance_name
  database_version    = var.postgres_database_version
  tier                = var.postgres_tier
  disk_size_gb        = var.postgres_disk_size_gb
  deletion_protection = false
  ipv4_enabled        = true
  authorized_networks = var.postgres_authorized_networks
  database_name       = var.postgres_database_name
  user_name           = var.postgres_user_name
  user_password       = var.postgres_user_password

  depends_on = [google_project_service.enabled_apis]
}
