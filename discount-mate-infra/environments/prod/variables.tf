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
