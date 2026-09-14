"use client";

import { useActionState } from "react";
import { StickyNote } from "lucide-react";
import type { PartyNote, User } from "@prisma/client";
import type { FormActionState } from "@/lib/core/parties/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

const initialState: FormActionState = {};

type NoteWithAuthor = PartyNote & { author: User | null };

export function NotesSection({
  notes,
  addAction,
}: {
  notes: NoteWithAuthor[];
  addAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const [state, formAction, isPending] = useActionState(addAction, initialState);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <form
            key={`${notes.length}-${state.attempt ?? 0}`}
            action={formAction}
            className="space-y-3"
          >
            {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
            <Textarea
              name="body"
              rows={3}
              placeholder="Add a note about this party…"
              defaultValue={state.values?.body}
              required
            />
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Adding…" : "Add note"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
              <p className="mt-2 text-xs text-slate-400">
                {note.author?.name ?? "Unknown"} · {note.createdAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
