"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { allocateVendorPaymentAction } from "@/lib/energy/vendor-payments/actions";

const initialState: FormActionState = {};

export function AllocateVendorPaymentForm({
  vendorPaymentId,
  unallocatedAmount,
  invoices,
}: {
  vendorPaymentId: string;
  unallocatedAmount: number;
  invoices: { id: string; invoiceNumber: string; outstandingAmount: number }[];
}) {
  const action = allocateVendorPaymentAction.bind(null, vendorPaymentId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  if (invoices.length === 0) {
    return <p className="text-sm text-slate-400">No outstanding invoices are available to allocate this payment to.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <p className="text-xs text-slate-500">Unallocated balance: ₹{unallocatedAmount.toLocaleString("en-IN")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="allocate-vendorInvoiceId">Invoice</Label>
          <Select id="allocate-vendorInvoiceId" name="vendorInvoiceId" required>
            <option value="">Select an invoice…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} - Outstanding ₹{inv.outstandingAmount.toLocaleString("en-IN")}
              </option>
            ))}
          </Select>
          {fieldErrors.vendorInvoiceId ? <p className="mt-1 text-xs text-red-600">{fieldErrors.vendorInvoiceId}</p> : null}
        </div>
        <div>
          <Label htmlFor="allocate-amount">Amount (₹)</Label>
          <Input id="allocate-amount" name="amount" type="number" min="0.01" step="any" defaultValue={String(unallocatedAmount)} required />
          {fieldErrors.amount ? <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p> : null}
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Allocating…" : "Allocate"}
          </Button>
        </div>
      </div>
    </form>
  );
}
