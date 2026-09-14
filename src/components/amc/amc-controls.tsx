"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { setAmcStatusAction, linkInvoiceToAmcAction } from "@/lib/energy/amc/actions";

export function AmcStatusButton({ id, target, label, danger }: { id: string; target: "ACTIVE" | "CANCELLED" | "COMPLETED"; label: string; danger?: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={danger ? "danger" : "secondary"}
      disabled={isPending}
      onClick={() => startTransition(() => setAmcStatusAction(id, target))}
    >
      {isPending ? "Saving…" : label}
    </Button>
  );
}

export function LinkInvoiceForm({ amcId, invoices }: { amcId: string; invoices: { id: string; invoiceNumber: string; grandTotal: number }[] }) {
  const [invoiceId, setInvoiceId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (invoices.length === 0) {
    return <p className="text-sm text-slate-400">No unlinked invoices for this customer.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="w-56">
        <option value="">Select an invoice…</option>
        {invoices.map((inv) => (
          <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - ₹{inv.grandTotal.toLocaleString("en-IN")}</option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isPending || !invoiceId}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await linkInvoiceToAmcAction(amcId, invoiceId);
              setInvoiceId("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not link invoice.");
            }
          });
        }}
      >
        {isPending ? "Linking…" : "Link Invoice"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
