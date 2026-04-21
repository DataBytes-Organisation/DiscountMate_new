output "repository_id" {
  description = "The Artifact Registry repository ID."
  value       = var.repository_id
}

output "name" {
  description = "The fully qualified repository resource name."
  value       = google_artifact_registry_repository.this.name
}

output "location" {
  description = "The repository location."
  value       = google_artifact_registry_repository.this.location
}

output "docker_repository" {
  description = "The Docker repository path for pushes and deploy references."
  value       = "${var.location}-docker.pkg.dev/${var.project_id}/${var.repository_id}"
}
