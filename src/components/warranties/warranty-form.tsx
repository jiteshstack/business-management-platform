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
import { WARRANTY_TYPES, WARRANTY_TYPE_LABELS } from "@/lib/energy/warranties/types";

const initialState: FormActionState = {};

export type WarrantyCustomerOption = {
  id: string;
  name: string;
  sites: { id: string; name: string }[];
  projects: { id: string; projectNumber: string; name: string }[];
  equipment: { id: string; equipmentNumber: string; productName: string; serialNumberText: string | null }[];
};

type WarrantyFormDefaults = {
  customerId?: string;
  siteId?: string;
  projectId?: string;
  installedEquipmentId?: string;
  warrantyType?: string;
  startDate?: string;
  endDate?: string;
  durationMonths?: number | null;
  terms?: string | null;
  coverage?: string | null;
  exclusions?: string | null;
  documentReference?: string | null;
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

export function WarrantyForm({
  mode,
  action,
  customers,
  defaults,
  cancelHref,
  lockCustomer,
}: {
  mode: "create" | "edit";
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  customers: WarrantyCustomerOption[];
  defaults?: WarrantyFormDefaults;
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
          <CardTitle>Coverage Scope</CardTitle>
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
          <Field id="installedEquipmentId" label="Installed Equipment (preferred when serialised)" error={fieldErrors.installedEquipmentId}>
            <Select id="installedEquipmentId" name="installedEquipmentId" defaultValue={value("installedEquipmentId") || defaults?.installedEquipmentId || ""}>
              <option value="">-</option>
              {selectedCustomer?.equipment.map((e) => (
                <option key={e.id} value={e.id}>{e.equipmentNumber} - {e.productName}{e.serialNumberText ? ` (${e.serialNumberText})` : ""}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warranty Terms</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="warrantyType" label="Warranty Type *" error={fieldErrors.warrantyType}>
            <Select id="warrantyType" name="warrantyType" defaultValue={value("warrantyType") || defaults?.warrantyType || "MANUFACTURER"}>
              {WARRANTY_TYPES.map((t) => (
                <option key={t} value={t}>{WARRANTY_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
          <Field id="durationMonths" label="Duration (months)" error={fieldErrors.durationMonths}>
            <Input id="durationMonths" name="durationMonths" type="number" min="0" defaultValue={value("durationMonths") || defaults?.durationMonths || ""} />
          </Field>
          <Field id="startDate" label="Start Date *" error={fieldErrors.startDate}>
            <Input id="startDate" name="startDate" type="date" defaultValue={value("startDate") || defaults?.startDate || ""} required />
          </Field>
          <Field id="endDate" label="End Date *" error={fieldErrors.endDate}>
            <Input id="endDate" name="endDate" type="date" defaultValue={value("endDate") || defaults?.endDate || ""} required />
          </Field>
          <Field id="documentReference" label="Document / Reference" error={fieldErrors.documentReference}>
            <Input id="documentReference" name="documentReference" defaultValue={value("documentReference") || defaults?.documentReference || ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="coverage" label="Coverage" error={fieldErrors.coverage}>
              <Textarea id="coverage" name="coverage" rows={2} placeholder="e.g. manufacturing defect, equipment failure, component replacement" defaultValue={value("coverage") || defaults?.coverage || ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="exclusions" label="Exclusions" error={fieldErrors.exclusions}>
              <Textarea id="exclusions" name="exclusions" rows={2} placeholder="e.g. physical damage, misuse, unauthorized modification" defaultValue={value("exclusions") || defaults?.exclusions || ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="terms" label="Terms" error={fieldErrors.terms}>
              <Textarea id="terms" name="terms" rows={2} defaultValue={value("terms") || defaults?.terms || ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Warranty" : "Save changes"}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
