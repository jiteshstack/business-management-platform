// Postgres for the application. The master password is generated here and
// stored in Secrets Manager - it is never typed by a person, never written
// to a .tf file, and never printed by `terraform output` (see outputs.tf).

resource "random_password" "db" {
  length = 40
  # RDS forbids /, @, ", and space in the master password.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Forces every client connection to use TLS. Without this, `sslmode` is the
# client's choice - and a publicly reachable database must not accept
# plaintext connections.
resource "aws_db_parameter_group" "main" {
  name_prefix = "${var.project_name}-${var.environment}-pg17-"
  family      = "postgres17"
  description = "Require TLS for all connections"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
    # A static parameter - Postgres only picks it up after a reboot, so AWS
    # always reports it back this way regardless of what's requested here.
    # Declaring it explicitly stops every `plan` from showing a no-op diff.
    apply_method = "pending-reboot"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-db"

  engine         = "postgres"
  engine_version = "17.6"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = true
  parameter_group_name   = aws_db_parameter_group.main.name

  backup_retention_period    = var.db_backup_retention_days
  backup_window              = "18:00-19:00" # UTC - off-peak for IST business hours
  maintenance_window         = "Mon:19:30-Mon:20:30"
  auto_minor_version_upgrade = true

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-db-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  performance_insights_enabled = false # not available on t4g.micro

  lifecycle {
    # `final_snapshot_identifier` embeds a timestamp, which would otherwise
    # show as a diff on every plan.
    ignore_changes = [final_snapshot_identifier]
  }

  tags = { Name = "${var.project_name}-${var.environment}-db" }
}
