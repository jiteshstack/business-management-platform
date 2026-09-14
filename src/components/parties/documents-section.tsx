"use client";

import { useActionState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import type { Document, User } from "@prisma/client";
import type { FormActionState } from "@/lib/core/parties/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const initialState: FormActionState = {};

type DocumentWithUploader = Document & { uploader: User | null };

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsSection({
  documents,
  uploadAction,
  deleteAction,
}: {
  documents: DocumentWithUploader[];
  uploadAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  deleteAction: (documentId: string) => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState(uploadAction, initialState);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <form
            key={`${documents.length}-${state.attempt ?? 0}`}
            action={formAction}
            className="flex flex-wrap items-end gap-3"
          >
            {state.error ? (
              <p className="w-full text-sm text-red-600">{state.error}</p>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="file">
                Upload document
              </label>
              <input
                id="file"
                name="file"
                type="file"
                required
                className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              <Upload className="h-4 w-4" />
              {isPending ? "Uploading…" : "Upload"}
            </Button>
            <p className="w-full text-xs text-slate-400">
              PDF, images, Office docs, CSV or text - up to 10MB.
            </p>
          </form>
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <a
                href={`/api/parties/documents/${doc.id}`}
                className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900 hover:text-emerald-700 hover:underline"
              >
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{doc.fileName}</span>
              </a>
              <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                <span>{formatBytes(doc.fileSize)}</span>
                <span>{doc.uploader?.name ?? "Unknown"}</span>
                <span>{doc.createdAt.toLocaleDateString()}</span>
                <form
                  action={async () => {
                    await deleteAction(doc.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${doc.fileName}`}
                    onClick={(event) => {
                      if (!confirm(`Delete "${doc.fileName}"?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
