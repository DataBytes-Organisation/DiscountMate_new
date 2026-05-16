output "instance_name" {
  description = "The Cloud SQL instance name."
  value       = google_sql_database_instance.this.name
}

output "connection_name" {
  description = "The Cloud SQL instance connection name."
  value       = google_sql_database_instance.this.connection_name
}

output "public_ip_address" {
  description = "The public IP address of the Cloud SQL instance."
  value       = google_sql_database_instance.this.public_ip_address
}

output "database_name" {
  description = "The PostgreSQL database name."
  value       = google_sql_database.this.name
}

output "user_name" {
  description = "The PostgreSQL application user name."
  value       = google_sql_user.this.name
}
