// Amplify Hosting runs the Next.js app (SSR + server actions) on the
// WEB_COMPUTE platform. Its compute role is what grants the running app
// access to S3 and Secrets Manager - the app itself never holds AWS keys.

data "aws_iam_policy_document" "amplify_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["amplify.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "amplify_compute" {
  name               = "${var.project_name}-${var.environment}-amplify-compute"
  assume_role_policy = data.aws_iam_policy_document.amplify_assume_role.json
}

data "aws_iam_policy_document" "amplify_compute" {
  statement {
    sid    = "DocumentStorage"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = ["${aws_s3_bucket.documents.arn}/*"]
  }

  statement {
    sid       = "ReadAppSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app.arn]
  }

  statement {
    sid    = "WriteLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]

    resources = ["arn:aws:logs:${var.aws_region}:*:log-group:/aws/amplify/*"]
  }
}

resource "aws_iam_role_policy" "amplify_compute" {
  name   = "${var.project_name}-${var.environment}-amplify-compute"
  role   = aws_iam_role.amplify_compute.id
  policy = data.aws_iam_policy_document.amplify_compute.json
}

resource "aws_amplify_app" "main" {
  name       = "${var.project_name}-${var.environment}"
  repository = var.github_access_token != "" ? var.github_repository_url : null

  # Only set when a token is supplied; otherwise the repo is connected in the
  # console and this must stay unset so Terraform does not clear it.
  access_token = var.github_access_token != "" ? var.github_access_token : null

  platform             = "WEB_COMPUTE"
  iam_service_role_arn = aws_iam_role.amplify_compute.arn

  # `prisma migrate deploy` is the non-interactive, production-safe variant -
  # it applies already-committed migrations and never generates or resets.
  build_spec = <<-YAML
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
            - npx prisma generate
            - npx prisma migrate deploy
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - .next/cache/**/*
          - node_modules/**/*
  YAML

  environment_variables = {
    DATABASE_URL   = jsondecode(aws_secretsmanager_secret_version.app.secret_string)["DATABASE_URL"]
    SESSION_SECRET = jsondecode(aws_secretsmanager_secret_version.app.secret_string)["SESSION_SECRET"]
    AWS_S3_BUCKET  = aws_s3_bucket.documents.bucket
    # AWS_REGION is reserved by the Amplify runtime and set automatically.
    NODE_OPTIONS = "--max-old-space-size=4096"
  }

  lifecycle {
    ignore_changes = [access_token]
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = var.github_branch

  framework = "Next.js - SSR"
  stage     = var.environment == "prod" ? "PRODUCTION" : "DEVELOPMENT"

  enable_auto_build = var.github_access_token != ""
}
