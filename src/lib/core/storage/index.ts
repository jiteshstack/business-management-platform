import "server-only";
import * as localDisk from "./local-disk";
import * as s3 from "./s3";

export { UploadRejectedError } from "./shared";
export type { StoredFile } from "./shared";

// Local disk in dev (zero setup); S3 once S3_BUCKET_NAME is set (production).
// Every caller imports from here, never from ./local-disk or ./s3 directly,
// so this is the only place that needs to know which backend is active.
//
// AWS_LAMBDA_FUNCTION_NAME (always set by the Lambda runtime itself, unlike
// our own config) triggers a hardcoded fallback bucket name when
// S3_BUCKET_NAME is missing: AWS Amplify Hosting's WEB_COMPUTE runtime does
// not expose custom app/branch "Environment Variables" to the deployed
// compute at request time - confirmed live, same issue documented in
// src/instrumentation.ts for DATABASE_URL/SESSION_SECRET. Without this,
// uploads would silently fall back to local-disk storage on Lambda, which
// has no persistent filesystem.
if (!process.env.S3_BUCKET_NAME && process.env.AWS_LAMBDA_FUNCTION_NAME) {
  process.env.S3_BUCKET_NAME = "shanvi-bmp-prod-documents";
}

const backend = process.env.S3_BUCKET_NAME ? s3 : localDisk;

export const saveUploadedFile = backend.saveUploadedFile;
export const readStoredFile = backend.readStoredFile;
export const deleteStoredFile = backend.deleteStoredFile;
