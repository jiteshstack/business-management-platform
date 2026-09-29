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
  name = "${var.project_name}-${var.environment}"

  # AWS retired API-based (personal access token) repository connections for
  # NEW Amplify apps - it now requires the GitHub App OAuth handshake, which
  # only happens through the console's "Connect branch" wizard. Confirmed by
  # a live 400 (BadRequestException: "You should at least provide one valid
  # token") from both a `repo`-scoped and a `repo`+`admin:repo_hook`-scoped
  # classic PAT. So: connect the repo once, by hand, in the console - see
  # infra/README.md - and `repository` is left unmanaged here so a later
  # `terraform apply` never tries to null it back out.
  platform             = "WEB_COMPUTE"
  iam_service_role_arn = aws_iam_role.amplify_compute.arn

  # Distinct from iam_service_role_arn (the BUILD role): this is what the
  # deployed SSR runtime itself assumes. Without it, the running compute
  # never received DATABASE_URL/SESSION_SECRET/S3_BUCKET_NAME at all, even
  # though they were correctly set on both the app and the branch and were
  # correctly visible during the build - confirmed live, three redeploys in.
  compute_role_arn = aws_iam_role.amplify_compute.arn

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
    # Amplify rejects any env var name starting with the reserved "AWS"
    # prefix, so the bucket name is passed as S3_BUCKET_NAME instead of
    # AWS_S3_BUCKET - see src/lib/core/storage/s3.ts and index.ts.
    # AWS_REGION itself is reserved by the Amplify runtime and set automatically.
    S3_BUCKET_NAME = aws_s3_bucket.documents.bucket
    NODE_OPTIONS = "--max-old-space-size=4096"
  }

  lifecycle {
    ignore_changes = [repository, access_token]
  }
}

# No aws_amplify_branch resource here on purpose: connecting a repository in
# the console creates the "main" branch itself as part of that flow, and a
# branch Terraform created first (with no repository attached - a "manually
# deployed" branch) blocks that same console connection with "Cannot connect
# your app to repository while manually deployed branch still exists." Once
# connected by hand, bring the branch under management with:
#   terraform import aws_amplify_branch.main <app_id>/<branch_name>
# and un-comment a resource block for it at that point.
