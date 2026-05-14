variable "project_id" {
  description = "The GCP project where the service account and key are created."
  type        = string
}

variable "service_account_id" {
  description = "Account ID for the GitHub Actions CI/CD service account."
  type        = string
}

variable "service_account_display_name" {
  description = "Display name for the GitHub Actions CI/CD service account."
  type        = string
}

variable "service_account_description" {
  description = "Description for the GitHub Actions CI/CD service account."
  type        = string
}
