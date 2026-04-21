# Planned PostgreSQL module

This directory is reserved for the future PostgreSQL module used by the OpenTofu environment roots.

Recommended implementation target:

- Google Cloud SQL for PostgreSQL

Recommended module responsibilities:

- Provision the PostgreSQL instance
- Configure backups and deletion protection
- Create logical databases and users
- Support private networking
- Expose connection metadata for Cloud Run integration

Recommended core inputs:

- `project_id`
- `region`
- `instance_name`
- `database_version`
- `tier`
- `disk_size_gb`
- `deletion_protection`
- `private_network`
- `databases`
- `users`

When added later, this module should be called from each environment root so test and prod stay independently managed.
