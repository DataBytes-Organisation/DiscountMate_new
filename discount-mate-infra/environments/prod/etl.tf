locals {
  etl_jobs = {
    ww    = "products_woolworths"
    iga   = "products_iga"
    aldi  = "products_aldi"
    coles = "products_coles"
  }

  etl_job_env_vars = {
    APP_MODE                   = "cloud"
    APP_CONFIG_PATH            = "config/deploy.yaml.example"
    BRONZE_ROOT                = "${module.data_bucket.url}/discount-mate"
    POSTGRES_UNIX_SOCKET       = "/cloudsql/${module.postgresql.connection_name}"
    POSTGRES_PORT              = "5432"
    POSTGRES_DATABASE          = module.postgresql.database_name
    POSTGRES_USER              = module.postgresql.user_name
    POSTGRES_PASSWORD          = var.postgres_user_password
    POSTGRES_SCHEMA            = "silver"
    DUCKDB_HOME_DIRECTORY      = "/tmp/discountmate-duckdb/home"
    DUCKDB_EXTENSION_DIRECTORY = "/tmp/discountmate-duckdb/extensions"
    GCS_KEY_ID                 = google_storage_hmac_key.etl.access_id
    GCS_SECRET                 = google_storage_hmac_key.etl.secret
  }
}

resource "google_storage_hmac_key" "etl" {
  project               = var.project_id
  service_account_email = module.github_actions_identity.github_actions_service_account_email
}

resource "google_storage_bucket_iam_member" "etl_reader" {
  bucket = module.data_bucket.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${module.github_actions_identity.github_actions_service_account_email}"
}

# resource "google_project_iam_member" "etl_cloud_sql" {
#   project = var.project_id
#   role    = "roles/cloudsql.client"
#   member  = "serviceAccount:${module.github_actions_identity.github_actions_service_account_email}"
# }

resource "google_cloud_run_v2_job" "etl" {
  for_each = local.etl_jobs

  project             = var.project_id
  name                = "discount-mate-etl-${each.key}"
  location            = var.region
  deletion_protection = false

  template {
    template {
      service_account = module.github_actions_identity.github_actions_service_account_email
      timeout         = "18000s"
      max_retries     = 0

      containers {
        image = var.etl_job_image
        args  = ["--model", each.value]

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }

        dynamic "env" {
          for_each = nonsensitive(toset(keys(local.etl_job_env_vars)))
          content {
            name  = env.value
            value = local.etl_job_env_vars[env.value]
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [module.postgresql.connection_name]
        }
      }
    }
  }

  depends_on = [
    google_project_service.enabled_apis,
    # google_project_iam_member.etl_cloud_sql,
    # google_storage_bucket_iam_member.etl_reader,
  ]
}

# resource "google_cloud_run_v2_job_iam_member" "etl_invoker" {
#   for_each = local.etl_jobs

#   project  = var.project_id
#   location = var.region
#   name     = google_cloud_run_v2_job.etl[each.key].name
#   role     = "roles/run.invoker"
#   member   = "serviceAccount:${module.github_actions_identity.github_actions_service_account_email}"
# }

resource "google_cloud_scheduler_job" "etl" {
  for_each = local.etl_jobs

  project          = var.project_id
  region           = var.region
  name             = "discount-mate-etl-${each.key}-sat"
  description      = "Trigger Cloud Run job ${google_cloud_run_v2_job.etl[each.key].name} on a schedule."
  schedule         = "0 12 * * 6"
  time_zone        = var.etl_scheduler_time_zone
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.etl[each.key].name}:run"
    body        = base64encode("{}")

    headers = {
      "Content-Type" = "application/json"
    }

    oauth_token {
      service_account_email = module.github_actions_identity.github_actions_service_account_email
    }
  }

  # depends_on = [google_cloud_run_v2_job_iam_member.etl_invoker]
}
