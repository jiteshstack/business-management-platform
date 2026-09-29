output "app_url" {
  description = "Default Amplify URL once a branch is connected (see infra/README.md) - this is just its shape, e.g. https://main.<default_domain>."
  value       = "https://main.${aws_amplify_app.main.default_domain}"
}

output "amplify_app_id" {
  description = "Amplify app id (for the console and the AWS CLI)."
  value       = aws_amplify_app.main.id
}

output "database_endpoint" {
  description = "RDS endpoint host:port."
  value       = "${aws_db_instance.main.address}:${aws_db_instance.main.port}"
}

output "documents_bucket" {
  description = "S3 bucket holding uploaded documents."
  value       = aws_s3_bucket.documents.bucket
}

output "app_secret_arn" {
  description = "Secrets Manager secret holding DATABASE_URL and SESSION_SECRET."
  value       = aws_secretsmanager_secret.app.arn
}

# Deliberately not an output: the connection string and session secret. Read
# them when needed with
#   aws secretsmanager get-secret-value --secret-id <app_secret_arn> \
#     --query SecretString --output text
# so they never land in terraform output or CI logs.
