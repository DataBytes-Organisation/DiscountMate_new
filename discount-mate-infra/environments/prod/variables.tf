variable "project_id" {
  description = "The GCP project where the production resources are created."
  type        = string
}

variable "region" {
  description = "Default GCP region for the environment."
  type        = string
}

variable "bucket_location" {
  description = "Optional override for the GCS bucket location. Defaults to region when null."
  type        = string
  default     = null
}

variable "bucket_storage_class" {
  description = "Storage class for the environment bucket."
  type        = string
  default     = "STANDARD"
}

variable "default_labels" {
  description = "Additional labels applied to all resources in the environment."
  type        = map(string)
  default     = {}
}

variable "artifact_registry_repository_id" {
  description = "Artifact Registry repository ID for production container images."
  type        = string
  default     = "discount-mate-images"
}

variable "artifact_registry_cleanup_delete_untagged_older_than" {
  description = "Delete untagged production images older than this duration."
  type        = string
  default     = "30d"
}

variable "artifact_registry_cleanup_dry_run" {
  description = "Whether the production Artifact Registry cleanup policy runs in dry-run mode."
  type        = bool
  default     = false
}

variable "github_actions_service_account_id" {
  description = "Account ID for the production GitHub Actions CI/CD service account."
  type        = string
  default     = "github-actions-prod"
}

variable "backend_service_name" {
  description = "Cloud Run service name for the production backend."
  type        = string
  default     = "webdev-backend"
}

variable "backend_container_image" {
  description = "Container image deployed to the production backend Cloud Run service."
  type        = string
  default     = "australia-southeast1-docker.pkg.dev/sit-26t1-discountmate-935cb94/discount-mate-images/webdev-backend:latest"
}

variable "backend_min_instance_count" {
  description = "Minimum number of production backend Cloud Run instances."
  type        = number
  default     = 0
}

variable "backend_max_instance_count" {
  description = "Maximum number of production backend Cloud Run instances."
  type        = number
  default     = 2
}

variable "backend_mongo_secret_name" {
  description = "Secret Manager secret name for the backend Mongo connection string."
  type        = string
  default     = "webdev-backend-mongo-uri"
}

variable "backend_jwt_secret_name" {
  description = "Secret Manager secret name for the backend JWT signing secret."
  type        = string
  default     = "webdev-backend-jwt-secret"
}

variable "mongo_uri" {
  description = "Initial Mongo URI stored in Secret Manager for the production backend."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Initial JWT secret stored in Secret Manager for the production backend."
  type        = string
  sensitive   = true
}

variable "base_url" {
  description = "Optional BASE_URL env var populated in a second apply using the created Cloud Run service URL."
  type        = string
  default     = null
}

variable "postgres_instance_name" {
  description = "Cloud SQL instance name for the production PostgreSQL database."
  type        = string
  default     = "discount-mate-prod-postgres"
}

variable "postgres_database_version" {
  description = "Cloud SQL PostgreSQL engine version for production."
  type        = string
  default     = "POSTGRES_16"
}

variable "postgres_tier" {
  description = "Cloud SQL machine tier for production PostgreSQL."
  type        = string
  default     = "db-f1-micro"
}

variable "postgres_disk_size_gb" {
  description = "Initial disk size in GB for the production PostgreSQL instance."
  type        = number
  default     = 10
}

variable "postgres_database_name" {
  description = "Logical PostgreSQL database name for production."
  type        = string
  default     = "discount_mate"
}

variable "postgres_user_name" {
  description = "Application PostgreSQL user name for production."
  type        = string
  default     = "discount_mate_app"
}

variable "postgres_user_password" {
  description = "Application PostgreSQL user password for production."
  type        = string
  sensitive   = true
}

variable "postgres_authorized_networks" {
  description = "Named CIDR ranges allowed to connect to the public production PostgreSQL instance."
  type = list(object({
    name       = string
    cidr_block = string
  }))
  default = []
}
