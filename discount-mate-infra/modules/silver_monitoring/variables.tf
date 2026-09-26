variable "project_id" {
  description = "The GCP project where Silver ETL monitoring resources are created."
  type        = string
}

variable "region" {
  description = "Region containing the Silver ETL Cloud Run Jobs."
  type        = string

  validation {
    condition     = trimspace(var.region) != ""
    error_message = "region must not be empty."
  }
}

variable "alert_email" {
  description = "Email address that receives Silver ETL alerts."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email must be a valid email address."
  }
}

variable "silver_etl_jobs" {
  description = "Silver ETL retailer names mapped to their Cloud Run Job names."
  type        = map(string)

  validation {
    condition = (
      length(var.silver_etl_jobs) > 0 &&
      alltrue([for job_name in values(var.silver_etl_jobs) : trimspace(job_name) != ""])
    )
    error_message = "silver_etl_jobs must contain at least one non-empty Cloud Run Job name."
  }
}
