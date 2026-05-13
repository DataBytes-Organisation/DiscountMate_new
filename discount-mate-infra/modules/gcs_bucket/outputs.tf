output "name" {
  description = "The bucket name."
  value       = google_storage_bucket.this.name
}

output "url" {
  description = "The bucket URL."
  value       = google_storage_bucket.this.url
}

output "self_link" {
  description = "The bucket self link."
  value       = google_storage_bucket.this.self_link
}
