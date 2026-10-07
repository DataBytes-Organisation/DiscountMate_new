output "notification_channel_name" {
  description = "Resource name of the Silver ETL email notification channel."
  value       = google_monitoring_notification_channel.silver_email.name
}

output "alert_policy_names" {
  description = "Display names of all Silver ETL alert policies."
  value = concat(
    [for policy in google_monitoring_alert_policy.execution_failed : policy.display_name],
    [for policy in google_monitoring_alert_policy.no_data : policy.display_name],
  )
}
