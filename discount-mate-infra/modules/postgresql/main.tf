resource "google_sql_database_instance" "this" {
  project             = var.project_id
  name                = var.instance_name
  region              = var.region
  database_version    = var.database_version
  deletion_protection = var.deletion_protection

  settings {
    tier            = var.tier
    disk_size       = var.disk_size_gb
    disk_autoresize = true
    edition         = "ENTERPRISE"

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = var.ipv4_enabled

      dynamic "authorized_networks" {
        for_each = var.authorized_networks
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.cidr_block
        }
      }
    }
  }
}

resource "google_sql_database" "this" {
  project  = var.project_id
  name     = var.database_name
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "this" {
  project  = var.project_id
  name     = var.user_name
  instance = google_sql_database_instance.this.name
  password = var.user_password
}
