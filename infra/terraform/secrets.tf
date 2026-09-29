// Application secrets live in Secrets Manager, not in Amplify's plaintext
// environment variables and not in any file in this repo.

resource "random_password" "session_secret" {
  length  = 64
  special = false # base64-ish alphanumeric - avoids any env/quoting surprises
}

resource "aws_secretsmanager_secret" "app" {
  name_prefix = "${var.project_name}/${var.environment}/app-"
  description = "DATABASE_URL and SESSION_SECRET for ${var.project_name} ${var.environment}"

  # Allows a destroyed-and-recreated stack to reuse the same secret name
  # instead of colliding with a 30-day recovery window.
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    # sslmode=require is what actually makes the client negotiate TLS; the
    # database also refuses plaintext (rds.force_ssl), so this must stay.
    DATABASE_URL = format(
      "postgresql://%s:%s@%s:%d/%s?schema=public&sslmode=require",
      var.db_username,
      urlencode(random_password.db.result),
      aws_db_instance.main.address,
      aws_db_instance.main.port,
      var.db_name,
    )
    SESSION_SECRET = random_password.session_secret.result
  })
}
