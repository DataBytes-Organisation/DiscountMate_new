output "name" {
  description = "The Cloud Run service name."
  value       = google_cloud_run_v2_service.this.name
}

output "url" {
  description = "The Cloud Run service URL."
  value       = google_cloud_run_v2_service.this.uri
}

output "service_account_email" {
  description = "The Cloud Run runtime service account email."
  value       = var.service_account_email
}
