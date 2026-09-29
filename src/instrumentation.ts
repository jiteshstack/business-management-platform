// Fetches DATABASE_URL/SESSION_SECRET from Secrets Manager at server
// startup, on AWS, when they aren't already present in process.env.
//
// This exists because AWS Amplify Hosting's WEB_COMPUTE (SSR) runtime does
// not expose custom app/branch "Environment Variables" to the deployed
// compute at request time - confirmed live: DATABASE_URL and SESSION_SECRET
// were correctly set at both the app and branch level, correctly visible
// during the build (prisma migrate deploy succeeded), yet a diagnostic dump
// of process.env at runtime showed neither present (only Lambda/AWS's own
// infrastructure variables were). This is the officially documented hook
// for exactly this situation - Next.js calls and awaits `register()` once,
// before the server handles its first request - so it sidesteps the issue
// entirely rather than depending on Amplify's env var propagation at all.
//
// Locally, and on any host where these ARE already set, this does nothing.
//
// register() runs at the very start of the Lambda's "prepare server" phase -
// earlier than Amplify's own credential-listener mechanism (visible as
// AWS_AMPLIFY_CREDENTIAL_LISTENER_* in process.env) has finished populating
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN. A first attempt
// here reliably threw CredentialsProviderError ("Could not load credentials
// from any providers"), yet those same credentials were confirmed present
// moments later during actual request handling - hence the short retry loop
// below, rather than abandoning this hook for a request-time one.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DATABASE_URL && process.env.SESSION_SECRET) return;

  // The secret's ARN is not sensitive (it's an address, not a credential) -
  // access is controlled by the compute role's IAM policy, which grants
  // secretsmanager:GetSecretValue scoped to only this one ARN (see
  // infra/terraform/amplify.tf). APP_SECRET_ARN lets this be overridden if
  // Amplify's env var propagation is ever fixed/changes; the literal below
  // is the fallback that's guaranteed to work today.
  const secretArn =
    process.env.APP_SECRET_ARN ??
    "arn:aws:secretsmanager:ap-south-1:396913718632:secret:shanvi-bmp/prod/app-20260929155230935500000002-RaLcfs";

  const { SecretsManagerClient, GetSecretValueCommand } = await import("@aws-sdk/client-secrets-manager");

  const maxAttempts = 8;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = new SecretsManagerClient({});
      const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      const secret = JSON.parse(result.SecretString ?? "{}") as { DATABASE_URL?: string; SESSION_SECRET?: string };

      if (secret.DATABASE_URL) process.env.DATABASE_URL = secret.DATABASE_URL;
      if (secret.SESSION_SECRET) process.env.SESSION_SECRET = secret.SESSION_SECRET;
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  console.error(`Failed to load secrets from Secrets Manager after ${maxAttempts} attempts:`, lastError);
}
