resource "google_monitoring_notification_channel" "silver_email" {
  project      = var.project_id
  display_name = "Silver ETL alerts - Email"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

locals {
  notification_channels = [
    google_monitoring_notification_channel.silver_email.id,
  ]
}

resource "google_monitoring_alert_policy" "execution_failed" {
  for_each = var.silver_etl_jobs

  project      = var.project_id
  display_name = "Silver ETL ${each.key} execution failed"
  combiner     = "OR"
  enabled      = true
  severity     = "ERROR"

  conditions {
    display_name = "${each.key} Cloud Run execution failed"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_run_job\"",
        "resource.label.job_name=\"${each.value}\"",
        "resource.label.location=\"${var.region}\"",
        "metric.type=\"run.googleapis.com/job/completed_execution_count\"",
        "metric.label.result=\"failed\"",
      ])

      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      The Silver ETL job `${each.value}` failed.

      Category: `execution_failed`
      GCP project: `${var.project_id}`

      Possible causes include an unhandled Python exception, invalid GCS or
      PostgreSQL configuration, DuckDB failure, out-of-memory termination, or
      Cloud Run timeout.

      Logs:
      https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_job%22%0Aresource.labels.job_name%3D%22${each.value}%22%0Aresource.labels.location%3D%22${var.region}%22?project=${var.project_id}
    EOT
  }

  user_labels = {
    application = "discount-mate"
    layer       = "silver"
    pipeline    = "etl"
    retailer    = each.key
  }
}

resource "google_monitoring_alert_policy" "no_data" {
  for_each = var.silver_etl_jobs

  project      = var.project_id
  display_name = "Silver ETL ${each.key} produced no data"
  combiner     = "OR"
  enabled      = true
  severity     = "WARNING"

  conditions {
    display_name = "${each.key} empty input or output"

    condition_matched_log {
      filter = join("\n", [
        "resource.type=\"cloud_run_job\"",
        "resource.labels.job_name=\"${each.value}\"",
        "resource.labels.location=\"${var.region}\"",
        "jsonPayload.pipeline=\"silver\"",
        "jsonPayload.event=\"etl_run_finished\"",
        "(jsonPayload.status=\"empty_input\" OR jsonPayload.status=\"empty_output\")",
      ])

      label_extractors = {
        model  = "EXTRACT(jsonPayload.model)"
        status = "EXTRACT(jsonPayload.status)"
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }

    auto_close = "1800s"
  }

  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      The Silver ETL job `${each.value}` completed without usable data.

      Model: `$${log.extracted_label.model}`
      Category: `$${log.extracted_label.status}`
      GCP project: `${var.project_id}`

      `empty_input` means no Bronze file or raw rows were available.
      `empty_output` means Bronze rows existed but normalization produced zero rows.

      Logs:
      https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_job%22%0Aresource.labels.job_name%3D%22${each.value}%22%0Aresource.labels.location%3D%22${var.region}%22?project=${var.project_id}
    EOT
  }

  user_labels = {
    application = "discount-mate"
    layer       = "silver"
    pipeline    = "etl"
    retailer    = each.key
  }
}
