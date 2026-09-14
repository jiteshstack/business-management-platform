import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Local-disk document storage for V1. Lives outside /public so files are
// never served without going through the authenticated download route,
// which checks the requester's company against the document's. Swappable
// for S3-compatible storage later without touching callers.
const STORAGE_ROOT = path.join(process.cwd(), "storage");

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export class UploadRejectedError extends Error {}

function sanitizeFileName(original: string): string {
  const base = original.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-150) || "file";
}

function extensionOf(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export type StoredFile = {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export async function saveUploadedFile(params: {
  companyId: string;
  entityType: string;
  entityId: string;
  file: File;
}): Promise<StoredFile> {
  const { companyId, entityType, entityId, file } = params;

  if (file.size === 0) {
    throw new UploadRejectedError("The selected file is empty.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new UploadRejectedError("File is larger than the 10MB limit.");
  }

  const safeName = sanitizeFileName(file.name || "file");
  const extension = extensionOf(safeName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new UploadRejectedError(
      `File type ".${extension || "unknown"}" isn't supported.`
    );
  }

  const dir = path.join(
    STORAGE_ROOT,
    companyId,
    entityType.toLowerCase(),
    entityId
  );
  await mkdir(dir, { recursive: true });

  const storedName = `${randomUUID()}_${safeName}`;
  const absolutePath = path.join(dir, storedName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    fileUrl: path.relative(STORAGE_ROOT, absolutePath),
    fileName: file.name || safeName,
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
