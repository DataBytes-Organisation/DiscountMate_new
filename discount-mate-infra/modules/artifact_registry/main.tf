resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.location
  repository_id = var.repository_id
  description   = var.description
  format        = "docker"

  labels                 = var.labels
  cleanup_policy_dry_run = var.cleanup_policy_dry_run

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = var.cleanup_delete_untagged_older_than
    }
  }
}
