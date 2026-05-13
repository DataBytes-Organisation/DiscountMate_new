variable "project_id" {
  description = "The GCP project that owns the Cloud Run job and scheduler trigger."
  type        = string
}

variable "region" {
  description = "The region where the Cloud Run job and scheduler trigger are created."
  type        = string
}

variable "job_name" {
  description = "The Cloud Run job name."
  type        = string
}

variable "container_image" {
  description = "The container image executed by the Cloud Run job."
  type        = string
}

variable "service_account_email" {
  description = "The service account email used as the Cloud Run job runtime identity."
  type        = string
}

variable "scheduler_service_account_email" {
  description = "The service account email used by Cloud Scheduler to invoke the Cloud Run job."
  type        = string
}

variable "scheduler_name" {
  description = "The Cloud Scheduler job name."
  type        = string
}

variable "schedule" {
  description = "The cron schedule for the scheduler trigger."
  type        = string
}

variable "time_zone" {
  description = "The IANA timezone used by the scheduler trigger."
  type        = string
}

variable "args" {
  description = "Arguments passed to the container entrypoint."
  type        = list(string)
  default     = []
}

variable "task_timeout" {
  description = "Maximum execution time allowed for each Cloud Run job task."
  type        = string
  default     = "10800s"
}

variable "env_vars" {
  description = "Plaintext environment variables for the Cloud Run job container."
  type        = map(string)
  default     = {}
}
