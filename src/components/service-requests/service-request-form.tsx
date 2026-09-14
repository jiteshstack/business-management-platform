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
import {
  SERVICE_REQUEST_SOURCES,
  SERVICE_REQUEST_SOURCE_LABELS,
  SERVICE_REQUEST_PRIORITIES,
  SERVICE_REQUEST_PRIORITY_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from "@/lib/energy/service-requests/types";

const initialState: FormActionState = {};

export type ServiceRequestCustomerOption = {
  id: string;
  name: string;
  sites: { id: string; name: string }[];
  projects: { id: string; projectNumber: string; name: string }[];
  equipment: { id: string; equipmentNumber: string; productName: string; serialNumberText: string | null }[];
};

export type UserOption = { id: string; name: string };

type Defaults = {
  customerId?: string;
  siteId?: string;
  projectId?: string;
  installedEquipmentId?: string;
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

export function ServiceRequestForm({
  action,
  customers,
  users,
  defaults,
  cancelHref,
  lockCustomer,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  customers: ServiceRequestCustomerOption[];
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
          <CardTitle>Customer & Equipment</CardTitle>
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
                <option key={e.id} value={e.id}>{e.equipmentNumber} - {e.productName}{e.serialNumberText ? ` (${e.serialNumberText})` : ""}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issue Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="source" label="Source *" error={fieldErrors.source}>
            <Select id="source" name="source" defaultValue={value("source") || "COMPLAINT"}>
              {SERVICE_REQUEST_SOURCES.map((s) => (
                <option key={s} value={s}>{SERVICE_REQUEST_SOURCE_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field id="requestDate" label="Request Date *" error={fieldErrors.requestDate}>
            <Input id="requestDate" name="requestDate" type="date" defaultValue={value("requestDate") || today} required />
          </Field>
          <Field id="priority" label="Priority *" error={fieldErrors.priority}>
            <Select id="priority" name="priority" defaultValue={value("priority") || "MEDIUM"}>
              {SERVICE_REQUEST_PRIORITIES.map((p) => (
                <option key={p} value={p}>{SERVICE_REQUEST_PRIORITY_LABELS[p]}</option>
              ))}
            </Select>
          </Field>
          <Field id="serviceType" label="Service Type *" error={fieldErrors.serviceType}>
            <Select id="serviceType" name="serviceType" defaultValue={value("serviceType") || "CHARGEABLE"}>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
          <Field id="assignedToId" label="Assign To" error={fieldErrors.assignedToId}>
            <Select id="assignedToId" name="assignedToId" defaultValue={value("assignedToId") || ""}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </Field>
          <Field id="expectedVisitDate" label="Expected Visit Date" error={fieldErrors.expectedVisitDate}>
            <Input id="expectedVisitDate" name="expectedVisitDate" type="date" defaultValue={value("expectedVisitDate") || ""} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="issue" label="Issue *" error={fieldErrors.issue}>
              <Input id="issue" name="issue" defaultValue={value("issue") || ""} placeholder="Short summary of the problem" required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="description" label="Description" error={fieldErrors.description}>
              <Textarea id="description" name="description" rows={3} defaultValue={value("description") || ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Create Service Request"}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
