variable "project_id" {
  description = "The GCP project that owns the repository."
  type        = string
}

variable "location" {
  description = "The regional or multi-regional location for the repository."
  type        = string
}

variable "repository_id" {
  description = "The Artifact Registry repository ID."
  type        = string
}

variable "description" {
  description = "The repository description."
  type        = string
}

variable "labels" {
  description = "Labels applied to the repository."
  type        = map(string)
  default     = {}
}

variable "cleanup_delete_untagged_older_than" {
  description = "Delete untagged artifacts older than this duration, for example 30d."
  type        = string
  default     = "30d"
}

variable "cleanup_policy_dry_run" {
  description = "Whether cleanup policies run in dry-run mode."
  type        = bool
  default     = false
}
