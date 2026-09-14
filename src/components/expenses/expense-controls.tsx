"use client";

import { useActionState, useTransition } from "react";
import type { FormActionState } from "@/lib/core/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { approveExpenseAction, cancelExpenseAction, recordExpensePaymentAction } from "@/lib/energy/expenses/actions";
import { PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@/lib/energy/payments/types";

export function ApproveExpenseButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => startTransition(() => approveExpenseAction(id))}>
      {isPending ? "Approving…" : "Approve"}
    </Button>
  );
}

export function CancelExpenseButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="danger"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Cancel this expense?")) return;
        startTransition(() => cancelExpenseAction(id));
      }}
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </Button>
  );
}

const initialState: FormActionState = {};

export function RecordExpensePaymentForm({ id, remaining }: { id: string; remaining: number }) {
  const [state, formAction, isPending] = useActionState(recordExpensePaymentAction.bind(null, id), initialState);
  const today = new Date().toISOString().slice(0, 10);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Amount (₹)</label>
          <Input name="amount" type="number" min="0.01" max={remaining} step="any" defaultValue={String(remaining)} required />
          {fieldErrors.amount ? <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Payment Date</label>
          <Input name="paymentDate" type="date" defaultValue={today} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Payment Mode</label>
          <Select name="paymentMode" defaultValue="BANK_TRANSFER">
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reference Number</label>
          <Input name="paymentReferenceNumber" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Record Payment"}</Button>
    </form>
  );
}
