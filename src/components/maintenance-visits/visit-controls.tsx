"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { setMaintenanceVisitStatusAction, updateVisitChecklistAction, completeMaintenanceVisitAction } from "@/lib/energy/maintenance-visits/actions";
import { MAINTENANCE_CHECKLIST_ITEMS } from "@/lib/energy/maintenance-visits/types";
import type { VisitStatus } from "@/lib/energy/maintenance-visits/types";

export function VisitStatusButton({ id, target, label, danger }: { id: string; target: VisitStatus; label: string; danger?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={danger ? "danger" : "secondary"}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setMaintenanceVisitStatusAction(id, target);
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

export function VisitChecklistForm({ visitId, initial }: { visitId: string; initial: Record<string, boolean> }) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {MAINTENANCE_CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!!checklist[item.key]} onChange={() => toggle(item.key)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            {item.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(async () => { await updateVisitChecklistAction(visitId, checklist); setSaved(true); })}
        >
          {isPending ? "Saving…" : "Save Checklist"}
        </Button>
        {saved ? <span className="text-xs text-emerald-700">Saved</span> : null}
      </div>
    </div>
  );
}

export type ProductOption = { id: string; name: string; code: string; stockTracked: boolean };
export type LocationOption = { id: string; name: string };

type PartRow = { productId: string; quantity: string; locationId: string };

const initialState: FormActionState = {};

export function CompleteVisitForm({
  visitId,
  products,
  locations,
  defaultLocationId,
}: {
  visitId: string;
  products: ProductOption[];
  locations: LocationOption[];
  defaultLocationId: string;
}) {
  const [state, formAction, isPending] = useActionState(completeMaintenanceVisitAction.bind(null, visitId), initialState);
  const [parts, setParts] = useState<PartRow[]>([]);

  function addPart() {
    setParts((prev) => [...prev, { productId: "", quantity: "1", locationId: defaultLocationId }]);
  }
  function updatePart(index: number, patch: Partial<PartRow>) {
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  const partsJson = JSON.stringify(
    parts.filter((p) => p.productId && p.quantity).map((p) => ({ productId: p.productId, quantity: Number(p.quantity), locationId: p.locationId }))
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Findings</label>
        <Textarea name="findings" rows={2} defaultValue={state.values?.findings ?? ""} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Work Performed *</label>
        <Textarea name="workPerformed" rows={2} defaultValue={state.values?.workPerformed ?? ""} required />
        {state.fieldErrors?.workPerformed ? <p className="mt-1 text-xs text-red-600">{state.fieldErrors.workPerformed}</p> : null}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Result</label>
        <Textarea name="result" rows={2} defaultValue={state.values?.result ?? ""} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Customer Remarks</label>
          <Textarea name="customerRemarks" rows={2} defaultValue={state.values?.customerRemarks ?? ""} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Technician Remarks</label>
          <Textarea name="technicianRemarks" rows={2} defaultValue={state.values?.technicianRemarks ?? ""} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Next Maintenance Date</label>
        <Input name="nextMaintenanceDate" type="date" defaultValue={state.values?.nextMaintenanceDate ?? ""} className="w-48" />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Parts Used</p>
          <Button type="button" size="sm" variant="secondary" onClick={addPart}>Add Part</Button>
        </div>
        {parts.length === 0 ? (
          <p className="text-sm text-slate-400">No parts consumed on this visit.</p>
        ) : (
          <div className="space-y-2">
            {parts.map((part, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select value={part.productId} onChange={(e) => updatePart(index, { productId: e.target.value })} className="flex-1">
                  <option value="">Select product…</option>
                  {products.filter((p) => p.stockTracked).map((p) => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </Select>
                <Input type="number" min="0.01" step="any" value={part.quantity} onChange={(e) => updatePart(index, { quantity: e.target.value })} className="w-24" />
                <Select value={part.locationId} onChange={(e) => updatePart(index, { locationId: e.target.value })} className="w-40">
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
                <Button type="button" size="sm" variant="secondary" onClick={() => removePart(index)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
        <input type="hidden" name="partsUsed" value={partsJson} />
      </div>

      <Button type="submit" disabled={isPending}>{isPending ? "Completing…" : "Complete Visit"}</Button>
    </form>
  );
}
