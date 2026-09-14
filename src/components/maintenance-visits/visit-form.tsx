"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VISIT_TYPES, VISIT_TYPE_LABELS } from "@/lib/energy/maintenance-visits/types";

const initialState: FormActionState = {};

export type VisitCustomerOption = {
  id: string;
  name: string;
  sites: { id: string; name: string }[];
  projects: { id: string; projectNumber: string; name: string }[];
  equipment: { id: string; equipmentNumber: string; productName: string }[];
  serviceRequests: { id: string; requestNumber: string; issue: string }[];
  amcs: { id: string; amcNumber: string }[];
};

export type UserOption = { id: string; name: string };

type Defaults = {
  customerId?: string;
  siteId?: string;
  projectId?: string;
  installedEquipmentId?: string;
  serviceRequestId?: string;
  amcId?: string;
  visitType?: string;
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

export function VisitForm({
  action,
  customers,
  users,
  defaults,
  cancelHref,
  lockCustomer,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  customers: VisitCustomerOption[];
  users: UserOption[];
  defaults?: Defaults;
  cancelHref: string;
  lockCustomer?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: string): string => state.values?.[name] ?? "";

  const [customerId, setCustomerId] = useState(defaults?.customerId ?? state.values?.customerId ?? "");
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-6">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Visit Scope</CardTitle>
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
          <Field id="installedEquipmentId" label="Installed Equipment" error={fieldErrors.installedEquipmentId}>
            <Select id="installedEquipmentId" name="installedEquipmentId" defaultValue={value("installedEquipmentId") || defaults?.installedEquipmentId || ""}>
              <option value="">-</option>
              {selectedCustomer?.equipment.map((e) => (
                <option key={e.id} value={e.id}>{e.equipmentNumber} - {e.productName}</option>
              ))}
            </Select>
          </Field>
          <Field id="serviceRequestId" label="Service Request" error={fieldErrors.serviceRequestId}>
            <Select id="serviceRequestId" name="serviceRequestId" defaultValue={value("serviceRequestId") || defaults?.serviceRequestId || ""}>
              <option value="">-</option>
              {selectedCustomer?.serviceRequests.map((sr) => (
                <option key={sr.id} value={sr.id}>{sr.requestNumber} - {sr.issue}</option>
              ))}
            </Select>
          </Field>
          <Field id="amcId" label="AMC" error={fieldErrors.amcId}>
            <Select id="amcId" name="amcId" defaultValue={value("amcId") || defaults?.amcId || ""}>
              <option value="">-</option>
              {selectedCustomer?.amcs.map((a) => (
                <option key={a.id} value={a.id}>{a.amcNumber}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="visitType" label="Visit Type *" error={fieldErrors.visitType}>
            <Select id="visitType" name="visitType" defaultValue={value("visitType") || defaults?.visitType || "GENERAL_SERVICE"}>
              {VISIT_TYPES.map((t) => (
                <option key={t} value={t}>{VISIT_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
          <Field id="visitDate" label="Visit Date *" error={fieldErrors.visitDate}>
            <Input id="visitDate" name="visitDate" type="date" defaultValue={value("visitDate") || today} required />
          </Field>
          <Field id="technicianId" label="Technician" error={fieldErrors.technicianId}>
            <Select id="technicianId" name="technicianId" defaultValue={value("technicianId") || ""}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Schedule Visit"}</Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
