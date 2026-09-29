variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short name used to prefix every resource."
  type        = string
  default     = "shanvi-bmp"
}

variable "environment" {
  description = "Deployment environment (prod, staging, ...)."
  type        = string
  default     = "prod"
}

# ---- Database ----

variable "db_instance_class" {
  description = "RDS instance size. db.t4g.micro is the cheapest burstable option and is sufficient for this app's load."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial storage (GB). Autoscales up to db_max_allocated_storage."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Upper bound for RDS storage autoscaling (GB)."
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Initial database name created inside the Postgres instance."
  type        = string
  default     = "business_management_platform"
}

variable "db_username" {
  description = "Master username for the Postgres instance. The password is generated, never set by hand."
  type        = string
  default     = "bmp_admin"
}

variable "db_backup_retention_days" {
  description = "How many days of automated RDS backups to keep."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Block `terraform destroy` from deleting the database. Keep true for anything holding real data."
  type        = bool
  default     = true
}

# ---- App hosting ----
#
# No github_* variables here: AWS retired API-based (personal access token)
# repository connections for new Amplify apps - only the console's "Connect
# branch" wizard (GitHub App OAuth) can do it now. See amplify.tf and
# infra/README.md.
