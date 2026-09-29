import "server-only";
import * as localDisk from "./local-disk";
import * as s3 from "./s3";

export { UploadRejectedError } from "./shared";
export type { StoredFile } from "./shared";

// Local disk in dev (zero setup); S3 once AWS_S3_BUCKET is set (production).
// Every caller imports from here, never from ./local-disk or ./s3 directly,
// so this is the only place that needs to know which backend is active.
const backend = process.env.AWS_S3_BUCKET ? s3 : localDisk;

export const saveUploadedFile = backend.saveUploadedFile;
export const readStoredFile = backend.readStoredFile;
export const deleteStoredFile = backend.deleteStoredFile;
