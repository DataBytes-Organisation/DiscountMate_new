output "job_name" {
  description = "The Cloud Run job name."
  value       = google_cloud_run_v2_job.this.name
}

output "scheduler_name" {
  description = "The Cloud Scheduler job name."
  value       = google_cloud_scheduler_job.this.name
}
