variable "project_id" {
  description = "The GCP project that owns the monitoring resources."
  type        = string
}

variable "scraper_row_floor" {
  description = "Per-scraper minimum expected row count per run. A run below this (or a missing data point entirely) triggers the zero-rows alert."
  type        = map(number)
  default = {
    ww    = 500
    iga   = 200
    aldi  = 200
    coles = 500
  }
}

variable "http_error_threshold" {
  description = "Non-200 response count within the rolling window that triggers the HTTP error-rate alert."
  type        = number
  default     = 20
}

variable "http_error_window" {
  description = "Rolling window for the HTTP error-rate alert. Google recommends at least 10 minutes for log-based metrics."
  type        = string
  default     = "600s"
}

variable "missing_data_retest_window" {
  description = "Retest window for the zero-rows alert. Must be non-zero for evaluation_missing_data to take effect."
  type        = string
  default     = "1800s"
}

variable "slack_channel_name" {
  description = "The Slack channel name for scraper alerts."
  type        = string
  default     = "#alerts-scrapers"
}

variable "slack_auth_token" {
  description = "OAuth token for the Google Cloud Monitoring Slack app. Leave null to skip the Slack channel and use email only."
  type        = string
  default     = null
  sensitive   = true
}

variable "alert_email" {
  description = "Redundant email notification address for scraper alerts."
  type        = string
}