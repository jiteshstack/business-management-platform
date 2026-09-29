import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAndNameFile, storageKey, type StoredFile } from "./shared";

export { UploadRejectedError } from "./shared";
export type { StoredFile } from "./shared";

// Local-disk document storage for dev. Lives outside /public so files are
// never served without going through the authenticated download route,
// which checks the requester's company against the document's. Swapped for
// S3 in production - see src/lib/core/storage/index.ts.
const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function saveUploadedFile(params: {
  companyId: string;
  entityType: string;
  entityId: string;
  file: File;
}): Promise<StoredFile> {
  const { companyId, entityType, entityId, file } = params;
  const { storedName, extension } = validateAndNameFile(file);

  const key = storageKey(companyId, entityType, entityId, storedName);
  const absolutePath = path.join(STORAGE_ROOT, key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    fileUrl: key,
    fileName: file.name || storedName,
    fileType: file.type || extension,
    fileSize: file.size,
  };
}

export async function readStoredFile(fileUrl: string): Promise<Buffer> {
  const absolutePath = path.join(STORAGE_ROOT, fileUrl);
  return readFile(absolutePath);
}

export async function deleteStoredFile(fileUrl: string): Promise<void> {
  const absolutePath = path.join(STORAGE_ROOT, fileUrl);
  try {
    await unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
