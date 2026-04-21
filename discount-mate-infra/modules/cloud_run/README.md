# Planned Cloud Run module

This directory is reserved for the future Cloud Run module used by the OpenTofu environment roots.

Recommended module responsibilities:

- Create a Cloud Run service for the application
- Attach a dedicated service account
- Support environment variables and secret references
- Support ingress and scaling configuration
- Integrate with a VPC connector if private resources are required
- Expose service URL and service account outputs

Recommended core inputs:

- `project_id`
- `region`
- `service_name`
- `container_image`
- `service_account_email`
- `env_vars`
- `min_instance_count`
- `max_instance_count`
- `ingress`
- `vpc_connector`

Keep the module environment-agnostic and wire it from `environments/test` and `environments/prod` when the service is ready to deploy.
