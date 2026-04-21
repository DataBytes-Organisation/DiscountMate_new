variable "project_id" {
  description = "The GCP project that owns the Cloud SQL instance."
  type        = string
}

variable "region" {
  description = "The region where the Cloud SQL instance is created."
  type        = string
}

variable "instance_name" {
  description = "The Cloud SQL instance name."
  type        = string
}

variable "database_version" {
  description = "The PostgreSQL database version."
  type        = string
  default     = "POSTGRES_16"
}

variable "tier" {
  description = "The Cloud SQL machine tier."
  type        = string
  default     = "db-f1-micro"
}

variable "disk_size_gb" {
  description = "The initial disk size in GB."
  type        = number
  default     = 10
}

variable "deletion_protection" {
  description = "Whether deletion protection is enabled on the Cloud SQL instance."
  type        = bool
  default     = false
}

variable "ipv4_enabled" {
  description = "Whether the Cloud SQL instance has a public IPv4 address."
  type        = bool
  default     = true
}

variable "authorized_networks" {
  description = "Named CIDR blocks allowed to connect to the public Cloud SQL instance."
  type = list(object({
    name       = string
    cidr_block = string
  }))
  default = []
}

variable "database_name" {
  description = "The logical PostgreSQL database name."
  type        = string
}

variable "user_name" {
  description = "The application PostgreSQL user name."
  type        = string
}

variable "user_password" {
  description = "The application PostgreSQL user password."
  type        = string
  sensitive   = true
}
