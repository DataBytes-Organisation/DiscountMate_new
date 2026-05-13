variable "project_id" {
  description = "The GCP project that owns the bucket."
  type        = string
}

variable "name" {
  description = "The globally unique bucket name."
  type        = string
}

variable "location" {
  description = "The bucket location, such as AU or australia-southeast1."
  type        = string
}

variable "storage_class" {
  description = "The GCS storage class for the bucket."
  type        = string
  default     = "STANDARD"
}

variable "labels" {
  description = "Labels applied to the bucket."
  type        = map(string)
  default     = {}
}

variable "versioning_enabled" {
  description = "Whether bucket object versioning is enabled."
  type        = bool
  default     = true
}

variable "force_destroy" {
  description = "Whether OpenTofu may delete non-empty buckets."
  type        = bool
  default     = false
}
