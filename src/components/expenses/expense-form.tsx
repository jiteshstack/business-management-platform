"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: FormActionState = {};

export type CategoryOption = { id: string; name: string };
export type VendorOption = { id: string; name: string };
export type ProjectOption = { id: string; projectNumber: string; name: string };
export type SiteOption = { id: string; name: string };

type ExpenseFormDefaults = {
  expenseDate?: string;
  categoryId?: string;
  amount?: number;
  taxRate?: number | null;
  vendorId?: string | null;
  projectId?: string | null;
  siteId?: string | null;
  description?: string | null;
  referenceNumber?: string | null;
};

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function ExpenseForm({
  mode,
  action,
  categories,
  vendors,
  projects,
  sites,
  defaults,
  cancelHref,
  lockProjectId,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  categories: CategoryOption[];
  vendors: VendorOption[];
  projects: ProjectOption[];
  sites: SiteOption[];
  defaults?: ExpenseFormDefaults;
  cancelHref: string;
  lockProjectId?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: string): string => state.values?.[name] ?? "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="expenseDate" label="Expense Date *" error={fieldErrors.expenseDate}>
            <Input id="expenseDate" name="expenseDate" type="date" defaultValue={value("expenseDate") || defaults?.expenseDate || today} required />
          </Field>
          <Field id="categoryId" label="Category *" error={fieldErrors.categoryId}>
            <Select id="categoryId" name="categoryId" defaultValue={value("categoryId") || defaults?.categoryId || ""} required>
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field id="amount" label="Amount (₹) *" error={fieldErrors.amount}>
            <Input id="amount" name="amount" type="number" min="0.01" step="any" defaultValue={value("amount") || defaults?.amount || ""} required />
          </Field>
          <Field id="taxRate" label="Tax Rate % (optional)" error={fieldErrors.taxRate}>
            <Input id="taxRate" name="taxRate" type="number" min="0" max="100" step="any" defaultValue={value("taxRate") || defaults?.taxRate || ""} />
          </Field>
          <Field id="vendorId" label="Vendor / Payee" error={fieldErrors.vendorId}>
            <Select id="vendorId" name="vendorId" defaultValue={value("vendorId") || defaults?.vendorId || ""}>
              <option value="">-</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </Field>
          <Field id="referenceNumber" label="Reference Number" error={fieldErrors.referenceNumber}>
            <Input id="referenceNumber" name="referenceNumber" defaultValue={value("referenceNumber") || defaults?.referenceNumber || ""} />
          </Field>
          <Field id="projectId" label="Project" error={fieldErrors.projectId}>
            {lockProjectId ? (
              <>
                <p className="mt-1 text-sm font-medium text-slate-900">{projects.find((p) => p.id === lockProjectId)?.projectNumber ?? "-"}</p>
                <input type="hidden" name="projectId" value={lockProjectId} />
              </>
            ) : (
              <Select id="projectId" name="projectId" defaultValue={value("projectId") || defaults?.projectId || ""}>
                <option value="">-</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectNumber} - {p.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="siteId" label="Site" error={fieldErrors.siteId}>
            <Select id="siteId" name="siteId" defaultValue={value("siteId") || defaults?.siteId || ""}>
              <option value="">-</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="description" label="Description" error={fieldErrors.description}>
              <Textarea id="description" name="description" rows={2} defaultValue={value("description") || defaults?.description || ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Expense" : "Save changes"}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
