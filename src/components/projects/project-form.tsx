"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS, PROJECT_PRIORITIES, PROJECT_PRIORITY_LABELS } from "@/lib/energy/projects/types";

const initialState: FormActionState = {};

export type CustomerOption = { id: string; name: string; sites: { id: string; name: string }[] };

type ProjectFormDefaults = {
  customerId?: string;
  siteId?: string | null;
  name?: string;
  type?: string;
  priority?: string;
  description?: string | null;
  startDate?: string | null;
  expectedCompletionDate?: string | null;
  notes?: string | null;
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function ProjectForm({
  mode,
  action,
  customers,
  defaults,
  cancelHref,
  lockCustomer,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  customers: CustomerOption[];
  defaults?: ProjectFormDefaults;
  cancelHref: string;
  lockCustomer?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: string): string => state.values?.[name] ?? "";

  const [customerId, setCustomerId] = useState(defaults?.customerId ?? state.values?.customerId ?? "");
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer & Site</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="customerId" label="Customer *" error={fieldErrors.customerId}>
            {lockCustomer ? (
              <>
                <p className="mt-1 text-sm font-medium text-slate-900">{selectedCustomer?.name ?? "-"}</p>
                <input type="hidden" name="customerId" value={customerId} />
              </>
            ) : (
              <Select id="customerId" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="siteId" label="Site" error={fieldErrors.siteId}>
            <Select id="siteId" name="siteId" defaultValue={value("siteId") || defaults?.siteId || ""}>
              <option value="">No site yet</option>
              {selectedCustomer?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Project Name *" error={fieldErrors.name}>
            <Input id="name" name="name" defaultValue={value("name") || defaults?.name || ""} required />
          </Field>
          <Field id="type" label="Project Type *" error={fieldErrors.type}>
            <Select id="type" name="type" defaultValue={value("type") || defaults?.type || "SOLAR_INSTALLATION"}>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="startDate" label="Start Date" error={fieldErrors.startDate}>
            <Input id="startDate" name="startDate" type="date" defaultValue={value("startDate") || defaults?.startDate || ""} />
          </Field>
          <Field id="expectedCompletionDate" label="Expected Completion Date" error={fieldErrors.expectedCompletionDate}>
            <Input
              id="expectedCompletionDate"
              name="expectedCompletionDate"
              type="date"
              defaultValue={value("expectedCompletionDate") || defaults?.expectedCompletionDate || ""}
            />
          </Field>
          <Field id="priority" label="Priority" error={fieldErrors.priority}>
            <Select id="priority" name="priority" defaultValue={value("priority") || defaults?.priority || "NORMAL"}>
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PROJECT_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="description" label="Description" error={fieldErrors.description}>
              <Textarea id="description" name="description" rows={2} defaultValue={value("description") || defaults?.description || ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="notes" label="Notes" error={fieldErrors.notes}>
              <Textarea id="notes" name="notes" rows={2} defaultValue={value("notes") || defaults?.notes || ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Project" : "Save changes"}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
