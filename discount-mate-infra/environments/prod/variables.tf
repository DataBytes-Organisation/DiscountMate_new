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
