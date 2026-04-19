variable "project_id" {
  description = "The GCP project that owns the Cloud Run service."
  type        = string
}

variable "region" {
  description = "The region where the Cloud Run service is deployed."
  type        = string
}

variable "service_name" {
  description = "The Cloud Run service name."
  type        = string
}

variable "container_image" {
  description = "The container image deployed to Cloud Run."
  type        = string
}

variable "service_account_email" {
  description = "The service account email used as the Cloud Run runtime identity."
  type        = string
}

variable "container_port" {
  description = "The container port exposed by the service."
  type        = number
  default     = 8080
}

variable "env_vars" {
  description = "Plaintext environment variables for the container."
  type        = map(string)
  default     = {}
}

variable "base_url" {
  description = "Optional BASE_URL environment variable for a follow-up apply after the service URL is known."
  type        = string
  default     = null
}

variable "secret_env_vars" {
  description = "Secret-backed environment variables keyed by env var name."
  type = map(object({
    secret  = string
    version = string
  }))
  default = {}
}

variable "min_instance_count" {
  description = "Minimum number of Cloud Run instances."
  type        = number
  default     = 0
}

variable "max_instance_count" {
  description = "Maximum number of Cloud Run instances."
  type        = number
  default     = 2
}

variable "ingress" {
  description = "Cloud Run ingress setting."
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"
}
