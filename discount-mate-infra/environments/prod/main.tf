locals {
  environment     = "prod"
  repo_root       = "../.."
  bucket_location = var.bucket_location == null ? var.region : var.bucket_location
  enabled_apis = toset([
    "artifactregistry.googleapis.com",
    "cloudscheduler.googleapis.com",
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

  ingestion_job_env_vars = {
    APP_OUTPUT_DIR           = ".output"
    APP_DESTINATIONS         = "gcs"
    APP_LOG_LEVEL            = "INFO"
    APP_BRANDS_PATH          = "config/custom/optimal_brands.yml"
    OTEL_ENABLED             = "true"
    OTEL_SERVICE_NAME        = "discount-mate-ingestion"
    GCS_BUCKET               = module.data_bucket.name
    GCS_PREFIX               = "discount-mate"
    ALDI_SITEMAP_URL         = "https://www.aldi.com.au/sitemap_categories.xml"
    ALDI_API_URL             = "https://api.aldi.com.au/v3/product-search"
    ALDI_CURRENCY            = "AUD"
    ALDI_PAGE_SIZE           = "30"
    ALDI_TIMEOUT_SECONDS     = "25"
    ALDI_DELAY_SECONDS       = "1"
    COLES_HOMEPAGE_URL       = "https://www.coles.com.au"
    COLES_BUILD_ID           = ""
    COLES_API_BASE_TEMPLATE  = "https://www.coles.com.au/_next/data/{build_id}/en/search/products.json"
    COLES_PAGE_SIZE          = "48"
    COLES_MAX_PAGES          = "8"
    COLES_TIMEOUT_SECONDS    = "20"
    COLES_DELAY_SECONDS_MIN  = "20"
    COLES_DELAY_SECONDS_MAX  = "80"
    COLES_COOKIE_STRING      = var.ingestion_coles_cookie_string
    COLES_SCRAPERAPI_KEY     = var.ingestion_coles_scraperapi_key
    IGA_BASE_URL             = "https://www.igashop.com.au"
    IGA_STORE_ID             = var.ingestion_iga_store_id
    IGA_SHOPPING_MODE_COOKIE = "Pickup"
    IGA_PAGE_SIZE            = "50"
    IGA_TIMEOUT_SECONDS      = "20"
    IGA_DELAY_SECONDS        = "0.5"
    WW_API_URL               = "https://www.woolworths.com.au/apis/ui/Search/products"
    WW_PAGE_SIZE             = "36"
    WW_MAX_PAGES             = "5"
    WW_TIMEOUT_SECONDS       = "20"
    WW_DELAY_SECONDS         = "1"
    WW_COOKIE_STRING         = var.ingestion_ww_cookie_string
    WW_SCRAPERAPI_KEY        = var.ingestion_ww_scraperapi_key
  }

  ingestion_jobs = {
    ww = {
      job_name       = "discount-mate-ingestion-ww"
      scheduler_name = "discount-mate-ingestion-ww-sat"
      schedule       = "0 6 * * 6"
      source         = "ww"
    }
    iga = {
      job_name       = "discount-mate-ingestion-iga"
      scheduler_name = "discount-mate-ingestion-iga-sat"
      schedule       = "0 7 * * 6"
      source         = "iga"
    }
    aldi = {
      job_name       = "discount-mate-ingestion-aldi"
      scheduler_name = "discount-mate-ingestion-aldi-sat"
      schedule       = "0 8 * * 6"
      source         = "aldi"
    }
    coles = {
      job_name       = "discount-mate-ingestion-coles"
      scheduler_name = "discount-mate-ingestion-coles-sat"
      schedule       = "0 9 * * 6"
      source         = "coles"
    }
  }
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

module "ingestion_jobs" {
  for_each = local.ingestion_jobs

  source = "${local.repo_root}/modules/cloud_run_job"

  project_id                      = var.project_id
  region                          = var.region
  job_name                        = each.value.job_name
  container_image                 = var.ingestion_job_image
  service_account_email           = module.github_actions_identity.github_actions_service_account_email
  scheduler_service_account_email = module.github_actions_identity.github_actions_service_account_email
  scheduler_name                  = each.value.scheduler_name
  schedule                        = each.value.schedule
  time_zone                       = var.ingestion_scheduler_time_zone
  args                            = ["--source", each.value.source, "--runner", "products"]
  env_vars                        = local.ingestion_job_env_vars
  task_timeout                    = "18000s"

  depends_on = [google_project_service.enabled_apis]
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
