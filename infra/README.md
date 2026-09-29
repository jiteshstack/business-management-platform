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

export TF_VAR_github_access_token="ghp_..."    # repo-scoped PAT, not committed

terraform init
terraform plan -out=tfplan                     # review before applying
terraform apply tfplan
```

`terraform apply` creates the database, so the first run takes ~10 minutes.
When it finishes, `terraform output app_url` gives the live URL.

Amplify builds on every push to `main` once the GitHub token is supplied.
The build runs `prisma migrate deploy`, so committed migrations are applied
automatically as part of each deploy.

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
