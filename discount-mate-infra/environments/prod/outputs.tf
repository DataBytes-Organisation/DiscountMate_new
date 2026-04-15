output "data_bucket_name" {
  description = "The production data bucket name."
  value       = module.data_bucket.name
}

output "data_bucket_url" {
  description = "The production data bucket URL."
  value       = module.data_bucket.url
}

output "artifact_registry_repository_id" {
  description = "The production Artifact Registry repository ID."
  value       = module.artifact_registry.repository_id
}

output "artifact_registry_docker_repository" {
  description = "The production Docker repository path."
  value       = module.artifact_registry.docker_repository
}
