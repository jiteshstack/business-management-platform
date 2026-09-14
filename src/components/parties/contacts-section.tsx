"use client";

import { useActionState, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import type { PartyContact } from "@prisma/client";
import type { FormActionState } from "@/lib/core/parties/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";

const initialState: FormActionState = {};

export function ContactsSection({
  contacts,
  addAction,
  deleteAction,
}: {
  contacts: PartyContact[];
  addAction: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  deleteAction: (contactId: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(contacts.length === 0);
  const [state, formAction, isPending] = useActionState(addAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      {contacts.length === 0 && !showForm ? null : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                    {contact.name}
                    {contact.isPrimary ? (
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[contact.designation, contact.phone, contact.email].filter(Boolean).join(" · ") ||
                      "No additional details"}
                  </p>
                </div>
                <form
                  action={async () => {
                    await deleteAction(contact.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${contact.name}`}
                    onClick={(event) => {
                      if (!confirm(`Remove contact "${contact.name}"?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {contacts.length === 0 && !showForm ? (
        <EmptyState
          icon={Users}
          title="No contact persons yet"
          description="Add the people you deal with at this party."
          action={
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add contact
            </Button>
          }
        />
      ) : null}

      {showForm ? (
        <Card>
          <CardContent className="space-y-4 py-4">
            <form
              key={`${contacts.length}-${state.attempt ?? 0}`}
              action={formAction}
              className="space-y-4"
            >
              {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact-name">Name *</Label>
                  <Input id="contact-name" name="name" defaultValue={state.values?.name} required />
                  {fieldErrors.name ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="contact-designation">Designation</Label>
                  <Input id="contact-designation" name="designation" defaultValue={state.values?.designation} />
                </div>
                <div>
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input id="contact-phone" name="phone" defaultValue={state.values?.phone} />
                </div>
                <div>
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" name="email" type="email" defaultValue={state.values?.email} />
                  {fieldErrors.email ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="contact-primary"
                  name="isPrimary"
                  defaultChecked={state.values?.isPrimary === "on"}
                />
                <Label htmlFor="contact-primary" className="mb-0">
                  Primary contact
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Adding…" : "Add contact"}
                </Button>
                {contacts.length > 0 ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Add another contact
        </Button>
      )}
    </div>
  );
}
