"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignServiceRequestAction,
  setServiceRequestStatusAction,
  resolveServiceRequestAction,
  createInvoiceFromServiceRequestAction,
} from "@/lib/energy/service-requests/actions";
import type { ServiceRequestStatus } from "@/lib/energy/service-requests/types";

export function AssignServiceRequestForm({ id, users, currentAssignedToId }: { id: string; users: { id: string; name: string }[]; currentAssignedToId: string | null }) {
  const [value, setValue] = useState(currentAssignedToId ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (!next) return;
          setError(null);
          startTransition(async () => {
            try {
              await assignServiceRequestAction(id, next);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not assign.");
            }
          });
        }}
        className="w-48"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </Select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

export function ServiceRequestStatusButton({ id, target, label }: { id: string; target: ServiceRequestStatus; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={target === "CANCELLED" ? "danger" : "secondary"}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setServiceRequestStatusAction(id, target);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update status.");
            }
          });
        }}
      >
        {isPending ? "Saving…" : label}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

const resolveInitialState: FormActionState = {};

export function ResolveServiceRequestForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(resolveServiceRequestAction.bind(null, id), resolveInitialState);
  return (
    <form action={formAction} className="space-y-2">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <Textarea name="resolution" rows={2} placeholder="Resolution note (required)" required />
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Resolving…" : "Mark Resolved"}</Button>
    </form>
  );
}

export function CreateServiceInvoiceForm({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [serviceCharge, setServiceCharge] = useState("");

  return (
    <form
      className="flex items-end gap-2"
      action={() => {
        setError(null);
        startTransition(async () => {
          const formData = new FormData();
          formData.set("serviceCharge", serviceCharge);
          try {
            await createInvoiceFromServiceRequestAction(id, formData);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create invoice.");
          }
        });
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Service Charge (₹)</label>
        <Input type="number" min="0" step="any" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} className="w-32" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Creating…" : "Create Invoice"}</Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </form>
  );
}
