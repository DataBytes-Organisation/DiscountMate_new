resource "google_service_account" "this" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = var.service_account_display_name
  description  = var.service_account_description
}

resource "google_service_account_key" "this" {
  service_account_id = google_service_account.this.name
  private_key_type   = "TYPE_GOOGLE_CREDENTIALS_FILE"
}
