output "github_actions_service_account_email" {
  description = "Email address of the GitHub Actions CI/CD service account."
  value       = google_service_account.this.email
}

output "github_actions_service_account_private_key" {
  description = "Private key JSON for the GitHub Actions CI/CD service account."
  value       = base64decode(google_service_account_key.this.private_key)
  sensitive   = true
}
