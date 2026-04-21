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

output "github_actions_service_account_email" {
  description = "The production GitHub Actions CI/CD service account email."
  value       = module.github_actions_identity.github_actions_service_account_email
}

output "github_actions_service_account_private_key" {
  description = "The production GitHub Actions CI/CD service account key JSON."
  value       = module.github_actions_identity.github_actions_service_account_private_key
  sensitive   = true
}

output "backend_service_name" {
  description = "The production backend Cloud Run service name."
  value       = module.backend_service.name
}

output "backend_service_url" {
  description = "The production backend Cloud Run service URL."
  value       = module.backend_service.url
}

output "backend_mongo_secret_name" {
  description = "The Secret Manager secret name for the production backend Mongo URI."
  value       = google_secret_manager_secret.backend_mongo_uri.secret_id
}

output "backend_jwt_secret_name" {
  description = "The Secret Manager secret name for the production backend JWT secret."
  value       = google_secret_manager_secret.backend_jwt_secret.secret_id
}

output "postgres_instance_connection_name" {
  description = "The production Cloud SQL PostgreSQL instance connection name."
  value       = module.postgresql.connection_name
}

output "postgres_public_ip_address" {
  description = "The public IP address of the production Cloud SQL PostgreSQL instance."
  value       = module.postgresql.public_ip_address
}

output "postgres_database_name" {
  description = "The production PostgreSQL database name."
  value       = module.postgresql.database_name
}

output "postgres_user_name" {
  description = "The production PostgreSQL application user name."
  value       = module.postgresql.user_name
}
