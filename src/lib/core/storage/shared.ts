import "server-only";
import { randomUUID } from "node:crypto";

// Rules and key-naming shared by every storage backend (local-disk, S3, ...)
// so they enforce identical limits and lay objects out identically.

export class UploadRejectedError extends Error {}

export type StoredFile = {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

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

function sanitizeFileName(original: string): string {
  const base = original.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return cleaned.slice(-150) || "file";
}

function extensionOf(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function validateAndNameFile(file: File): { storedName: string; extension: string } {
  if (file.size === 0) {
    throw new UploadRejectedError("The selected file is empty.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new UploadRejectedError("File is larger than the 10MB limit.");
  }

  const safeName = sanitizeFileName(file.name || "file");
  const extension = extensionOf(safeName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new UploadRejectedError(`File type ".${extension || "unknown"}" isn't supported.`);
  }

  return { storedName: `${randomUUID()}_${safeName}`, extension };
}

// companyId/entitytype/entityId/uuid_name - identical layout regardless of
// backend, and scoped per company so a leaked key from one tenant can't be
// guessed for another.
export function storageKey(companyId: string, entityType: string, entityId: string, storedName: string): string {
  return [companyId, entityType.toLowerCase(), entityId, storedName].join("/");
}
