import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { validateAndNameFile, storageKey, type StoredFile } from "./shared";

export { UploadRejectedError } from "./shared";
export type { StoredFile } from "./shared";

// S3-backed document storage for production - see src/lib/core/storage/index.ts
// for how this is selected. Credentials come from the environment (IAM role
// on Amplify, or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY locally) - never
// passed explicitly here.
const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

function requireBucket(): string {
  // Named S3_BUCKET_NAME, not AWS_S3_BUCKET: Amplify rejects any env var
  // whose name starts with the reserved "AWS" prefix.
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error("S3_BUCKET_NAME is not configured.");
  return bucket;
}

export async function saveUploadedFile(params: {
  companyId: string;
  entityType: string;
  entityId: string;
  file: File;
}): Promise<StoredFile> {
  const { companyId, entityType, entityId, file } = params;
  const { storedName, extension } = validateAndNameFile(file);

  const key = storageKey(companyId, entityType, entityId, storedName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await client.send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: key,
      Body: bytes,
      ContentType: file.type || undefined,
    })
  );

  return {
    fileUrl: key,
    fileName: file.name || storedName,
    fileType: file.type || extension,
    fileSize: file.size,
  };
}

export async function readStoredFile(fileUrl: string): Promise<Buffer> {
  const result = await client.send(new GetObjectCommand({ Bucket: requireBucket(), Key: fileUrl }));
  const bytes = await result.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteStoredFile(fileUrl: string): Promise<void> {
  // DeleteObject is idempotent (no error on a missing key), matching
  // local-disk's ENOENT swallow.
  await client.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: fileUrl }));
}
