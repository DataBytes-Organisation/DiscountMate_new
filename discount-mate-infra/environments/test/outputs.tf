output "data_bucket_name" {
  description = "The test data bucket name."
  value       = module.data_bucket.name
}

output "data_bucket_url" {
  description = "The test data bucket URL."
  value       = module.data_bucket.url
}
