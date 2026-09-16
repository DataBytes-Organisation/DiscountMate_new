resource "google_logging_metric" "scraper_rows" {
  project     = var.project_id
  name        = "scraper_rows"
  description = "Rows scraped per run, extracted from structured scrape_run_finished log entries."
  filter      = "resource.type=\"cloud_run_job\" AND jsonPayload.event=\"scrape_run_finished\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "1"
    labels {
      key         = "scraper"
      value_type  = "STRING"
      description = "The scraper that produced this run."
    }
  }

  value_extractor = "EXTRACT(jsonPayload.rows_scraped)"
  label_extractors = {
    scraper = "EXTRACT(jsonPayload.scraper)"
  }

  bucket_options {
    exponential_buckets {
      num_finite_buckets = 64
      growth_factor       = 2
      scale                = 1
    }
  }
}

resource "google_logging_metric" "scraper_run_failed" {
  project     = var.project_id
  name        = "scraper_run_failed"
  description = "Counts scraper runs that logged a scrape_run_failed event or an ERROR+ severity log."
  filter      = "resource.type=\"cloud_run_job\" AND (jsonPayload.event=\"scrape_run_failed\" OR severity>=\"ERROR\")"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "scraper"
      value_type  = "STRING"
      description = "The scraper that failed."
    }
  }

  label_extractors = {
    scraper = "EXTRACT(jsonPayload.scraper)"
  }
}

resource "google_logging_metric" "scraper_http_errors" {
  project     = var.project_id
  name        = "scraper_http_errors"
  description = "Counts individual HTTP responses with status >= 400 encountered by scrapers."
  filter      = "resource.type=\"cloud_run_job\" AND jsonPayload.http_status>=400"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "scraper"
      value_type  = "STRING"
      description = "The scraper that received the error response."
    }
    labels {
      key         = "http_status"
      value_type  = "STRING"
      description = "The HTTP status code returned."
    }
  }

  label_extractors = {
    scraper     = "EXTRACT(jsonPayload.scraper)"
    http_status = "EXTRACT(jsonPayload.http_status)"
  }
}

resource "google_logging_metric" "scraper_block" {
  project     = var.project_id
  name        = "scraper_block"
  description = "Counts detected soft blocks / selector misses reported by scrapers."
  filter      = "resource.type=\"cloud_run_job\" AND jsonPayload.event=\"scrape_block\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "scraper"
      value_type  = "STRING"
      description = "The scraper that reported the block."
    }
    labels {
      key         = "reason"
      value_type  = "STRING"
      description = "The reason the block/selector-miss was detected."
    }
  }

  label_extractors = {
    scraper = "EXTRACT(jsonPayload.scraper)"
    reason  = "EXTRACT(jsonPayload.reason)"
  }
}

resource "google_monitoring_notification_channel" "slack_scrapers" {
  count        = var.slack_auth_token != null ? 1 : 0
  project      = var.project_id
  display_name = "Scraper alerts - Slack (#alerts-scrapers)"
  type         = "slack"

  labels = {
    channel_name = var.slack_channel_name
  }

  sensitive_labels {
    auth_token = var.slack_auth_token
  }
}

resource "google_monitoring_notification_channel" "email_scrapers" {
  project      = var.project_id
  display_name = "Scraper alerts - Email (redundant channel)"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

locals {
  notification_channels = compact(concat(
    google_monitoring_notification_channel.slack_scrapers[*].id,
    [google_monitoring_notification_channel.email_scrapers.id],
  ))
}

resource "google_monitoring_alert_policy" "scraper_job_failed" {
  project      = var.project_id
  display_name = "Scraper job failed"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run Job task attempt failed"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_job\" AND metric.type=\"run.googleapis.com/job/completed_task_attempt_count\" AND metric.labels.result=\"failed\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_COUNT"
      }
    }
  }

  notification_channels = local.notification_channels

  documentation {
    content   = "A scraper Cloud Run Job task attempt failed. Check Cloud Logging for the run_id and error details."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "scraper_zero_rows" {
  for_each     = var.scraper_row_floor
  project      = var.project_id
  display_name = "Scraper ${each.key} returned zero/near-zero rows"
  combiner     = "OR"

  conditions {
    display_name = "${each.key} rows below floor or missing"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_job\" AND metric.type=\"logging.googleapis.com/user/scraper_rows\" AND metric.labels.scraper=\"${each.key}\""
      comparison               = "COMPARISON_LT"
      threshold_value          = each.value
      duration                 = var.missing_data_retest_window
      evaluation_missing_data  = "EVALUATION_MISSING_DATA_ACTIVE"
      aggregations {
        alignment_period   = "3600s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.notification_channels

  documentation {
    content   = "Scraper ${each.key} returned fewer than ${each.value} rows, or logged nothing at all (treated as a violation). Check for selector breakage, soft blocks, or a crash before the summary log was written."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "scraper_http_error_rate" {
  project      = var.project_id
  display_name = "Scraper HTTP error-rate spike"
  combiner     = "OR"

  conditions {
    display_name = "Non-200 responses spike"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_job\" AND metric.type=\"logging.googleapis.com/user/scraper_http_errors\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.http_error_threshold
      duration        = var.http_error_window
      aggregations {
        alignment_period      = var.http_error_window
        per_series_aligner    = "ALIGN_SUM"
        cross_series_reducer  = "REDUCE_SUM"
        group_by_fields       = ["metric.labels.scraper"]
      }
    }
  }

  notification_channels = local.notification_channels

  documentation {
    content   = "A scraper's non-200 HTTP response count exceeded the threshold within the rolling window. Often precedes a full block (403/429 spike)."
    mime_type = "text/markdown"
  }
}