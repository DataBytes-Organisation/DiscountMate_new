output "log_metric_names" {
  description = "Names of the created log-based metrics."
  value = [
    google_logging_metric.scraper_rows.name,
    google_logging_metric.scraper_run_failed.name,
    google_logging_metric.scraper_http_errors.name,
    google_logging_metric.scraper_block.name,
  ]
}

output "alert_policy_names" {
  description = "Display names of the created alert policies."
  value = concat(
    [google_monitoring_alert_policy.scraper_job_failed.display_name],
    [for p in google_monitoring_alert_policy.scraper_zero_rows : p.display_name],
    [google_monitoring_alert_policy.scraper_http_error_rate.display_name],
  )
}

output "notification_channel_ids" {
  description = "IDs of the notification channels attached to scraper alert policies."
  value       = local.notification_channels
}