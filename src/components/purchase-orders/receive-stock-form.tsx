"use client";

import { useActionState, useState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: FormActionState = {};

export type PendingLineItem = {
  id: string;
  productName: string;
  productCode: string | null;
  unitLabel: string | null;
  pendingQuantity: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReceiveStockForm({
  action,
  locations,
  pendingItems,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  locations: { id: string; name: string; isDefault: boolean }[];
  pendingItems: PendingLineItem[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(pendingItems.map((item) => [item.id, String(item.pendingQuantity)]))
  );

  const itemsJson = JSON.stringify(
    pendingItems.map((item) => ({
      purchaseOrderLineItemId: item.id,
      quantity: Number(quantities[item.id]) || 0,
    }))
  );

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-4">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <input type="hidden" name="items" value={itemsJson} readOnly />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="locationId">Location *</Label>
          <Select id="locationId" name="locationId" defaultValue={locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? ""} required>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
          {fieldErrors.locationId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.locationId}</p> : null}
        </div>
        <div>
          <Label htmlFor="receiptDate">Receipt Date *</Label>
          <Input id="receiptDate" name="receiptDate" type="date" defaultValue={todayIso()} required />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2 w-28">Pending</th>
              <th className="px-3 py-2 w-32">Receive Now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendingItems.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2">
                  {item.productCode ? `${item.productCode} - ` : ""}
                  {item.productName}
                  {item.unitLabel ? <span className="text-slate-400"> ({item.unitLabel})</span> : null}
                </td>
                <td className="px-3 py-2 text-slate-500">{item.pendingQuantity}</td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    max={item.pendingQuantity}
                    step="any"
                    value={quantities[item.id] ?? ""}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fieldErrors.items ? <p className="text-xs text-red-600">{fieldErrors.items}</p> : null}

      <div>
        <Label htmlFor="receipt-notes">Notes</Label>
        <Textarea id="receipt-notes" name="notes" rows={2} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Receiving…" : "Receive Stock"}
      </Button>
    </form>
  );
}
