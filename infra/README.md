# Deployment (AWS)

Terraform stack for running this app on AWS:

| Piece | Service |
|---|---|
| App (Next.js SSR + server actions) | Amplify Hosting (`WEB_COMPUTE`) |
| Database | RDS PostgreSQL 17 |
| Uploaded documents | S3 (private) |
| `DATABASE_URL`, `SESSION_SECRET` | Secrets Manager (generated, never hand-typed) |

## First deploy

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # adjust region/name if needed

terraform init
terraform plan -out=tfplan                     # review before applying
terraform apply tfplan
```

`terraform apply` creates the database, so the first run takes ~10 minutes.
When it finishes, `terraform output app_url` gives the app's URL — though it
won't serve the real app yet until the repo is connected (next step).

### Connecting the GitHub repository

**This has to be done by hand, in the console — it cannot be scripted.**
AWS retired API-based (personal access token) repository connections for new
Amplify apps; only the console's OAuth handshake with the "AWS Amplify"
GitHub App can create one now. A `terraform apply` that tries to set
`repository`/`access_token` directly fails with `BadRequestException: You
should at least provide one valid token`, regardless of the token's scopes —
confirmed live, not a guess.

1. AWS Console → Amplify → open the app (`terraform output amplify_app_id`)
2. It should show a "Connect a repository" / "Get started" prompt — if it
   instead insists a branch already exists, delete that branch first
   (`aws amplify list-branches` / delete in console); a branch created
   without a repository blocks the connection wizard with the same error.
3. Choose GitHub → authorize the "AWS Amplify" GitHub App for this repo →
   select `jiteshstack/business-management-platform`, branch `main`
4. It builds automatically from here on, on every push to `main`. The build
   runs `prisma migrate deploy`, so committed migrations apply automatically
   as part of each deploy.

Once connected, bring the branch under Terraform so future plans don't
conflict with it:

```bash
terraform import aws_amplify_branch.main <amplify_app_id>/main
```

(You'll need to re-add an `aws_amplify_branch.main` resource block to
`amplify.tf` first — see the comment left in its place.)

## Creating the first admin user

The seed script (`npm run db:seed`) **refuses to run against production** on
purpose — it creates eight accounts sharing one publicly-known password. The
first real Owner/Admin has to be created deliberately. Fetch the connection
string and insert one:

```bash
aws secretsmanager get-secret-value \
  --secret-id "$(terraform output -raw app_secret_arn)" \
  --query SecretString --output text
```

…then connect with `psql` and insert a `Company` + `User` row with a bcrypt
hash you generate yourself.

## Reading secrets

They are deliberately not Terraform outputs, so they never appear in
`terraform output` or CI logs:

```bash
aws secretsmanager get-secret-value \
  --secret-id "$(terraform output -raw app_secret_arn)" \
  --query SecretString --output text
```

## Environment variables don't reach the SSR runtime — by design, work around it

**Confirmed live, not a guess:** `DATABASE_URL`/`SESSION_SECRET`/`S3_BUCKET_NAME`
were correctly set on both the Amplify app and the branch, and were correctly
visible during the build (`prisma migrate deploy` ran successfully) — but a
diagnostic dump of `process.env` from the actual deployed compute, at request
time, showed neither present; only Lambda/AWS's own infrastructure variables
were. Neither `iam_service_role_arn` nor `compute_role_arn` changed this.

The app works around this itself, so no further action is needed for a fresh
deploy of this repo: `src/instrumentation.ts` fetches `DATABASE_URL` and
`SESSION_SECRET` from Secrets Manager at server startup (Next.js's
[`register()`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
hook, awaited before the server handles its first request) whenever they
aren't already in `process.env`, and `src/lib/core/storage/index.ts` falls
back to a hardcoded bucket name when running on Lambda
(`AWS_LAMBDA_FUNCTION_NAME` is set) with `S3_BUCKET_NAME` missing. Both
fallbacks hardcode this stack's actual ARN/bucket name as literals — safe,
since neither is sensitive on its own; access is controlled by the compute
role's IAM policy (scoped to only that one secret ARN and only that bucket),
not by keeping the identifier secret. Redeploying this Terraform stack to a
different AWS account/region needs those two literals updated to match.

## Things worth knowing

**The database has a public endpoint.** Amplify's SSR compute runs outside
any customer VPC and cannot reach a private-subnet database, so the database
is reachable from the internet and protected by TLS (`rds.force_ssl`), a
40-character generated password, and a security group that opens only 5432 —
not by network isolation. If that tradeoff ever stops being acceptable, the
fix is to move the app to ECS Fargate inside the VPC and flip
`publicly_accessible = false`.

**`deletion_protection` is on by default.** `terraform destroy` will fail on
the database until you set `db_deletion_protection = false` and apply. That
is intentional.

**Backups** are retained 7 days (`db_backup_retention_days`) and a final
snapshot is taken on deletion.

**Cost**, roughly, at idle: RDS `db.t4g.micro` ~$13–15/mo, storage ~$2–3/mo,
Amplify ~$1–3/mo plus build minutes, S3 a few cents. Call it **$20–30/month**
for light use — more under real traffic.
