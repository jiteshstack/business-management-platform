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
import { BILLING_FREQUENCIES, BILLING_FREQUENCY_LABELS } from "@/lib/energy/amc/types";

const initialState: FormActionState = {};

export type AmcCustomerOption = {
  id: string;
  name: string;
  sites: { id: string; name: string }[];
  projects: { id: string; projectNumber: string; name: string }[];
};

type AmcFormDefaults = {
  customerId?: string;
  siteId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  contractValue?: number | null;
  billingFrequency?: string | null;
  numberOfVisits?: number;
  coverage?: string | null;
  exclusions?: string | null;
  notes?: string | null;
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

export function AmcForm({
  mode,
  action,
  customers,
  defaults,
  cancelHref,
  lockCustomer,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  customers: AmcCustomerOption[];
  defaults?: AmcFormDefaults;
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
          <CardTitle>Contract Scope</CardTitle>
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
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="siteId" label="Site" error={fieldErrors.siteId}>
            <Select id="siteId" name="siteId" defaultValue={value("siteId") || defaults?.siteId || ""}>
              <option value="">-</option>
              {selectedCustomer?.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field id="projectId" label="Project" error={fieldErrors.projectId}>
            <Select id="projectId" name="projectId" defaultValue={value("projectId") || defaults?.projectId || ""}>
              <option value="">-</option>
              {selectedCustomer?.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.projectNumber} - {p.name}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract Terms</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="startDate" label="Start Date *" error={fieldErrors.startDate}>
            <Input id="startDate" name="startDate" type="date" defaultValue={value("startDate") || defaults?.startDate || ""} required />
          </Field>
          <Field id="endDate" label="End Date *" error={fieldErrors.endDate}>
            <Input id="endDate" name="endDate" type="date" defaultValue={value("endDate") || defaults?.endDate || ""} required />
          </Field>
          <Field id="contractValue" label="Contract Value (₹)" error={fieldErrors.contractValue}>
            <Input id="contractValue" name="contractValue" type="number" min="0" step="any" defaultValue={value("contractValue") || defaults?.contractValue || ""} />
          </Field>
          <Field id="billingFrequency" label="Billing Frequency" error={fieldErrors.billingFrequency}>
            <Select id="billingFrequency" name="billingFrequency" defaultValue={value("billingFrequency") || defaults?.billingFrequency || ""}>
              <option value="">-</option>
              {BILLING_FREQUENCIES.map((f) => (
                <option key={f} value={f}>{BILLING_FREQUENCY_LABELS[f]}</option>
              ))}
            </Select>
          </Field>
          <Field id="numberOfVisits" label="Included Visits" error={fieldErrors.numberOfVisits}>
            <Input id="numberOfVisits" name="numberOfVisits" type="number" min="0" defaultValue={value("numberOfVisits") || String(defaults?.numberOfVisits ?? 0)} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="coverage" label="Coverage" error={fieldErrors.coverage}>
              <Textarea id="coverage" name="coverage" rows={2} placeholder="e.g. preventive maintenance, inspection, cleaning, electrical checks" defaultValue={value("coverage") || defaults?.coverage || ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="exclusions" label="Exclusions" error={fieldErrors.exclusions}>
              <Textarea id="exclusions" name="exclusions" rows={2} defaultValue={value("exclusions") || defaults?.exclusions || ""} />
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
          {isPending ? "Saving…" : mode === "create" ? "Create AMC" : "Save changes"}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
