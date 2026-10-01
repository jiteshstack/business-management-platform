import Link from "next/link";
import { getCustomerLedger } from "@/lib/energy/payments/queries";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import type { LedgerEntryType } from "@/lib/energy/payments/types";

const TYPE_LABELS: Record<LedgerEntryType, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  PAYMENT_CANCELLED: "Payment Reversed",
};

const TYPE_VARIANT: Record<LedgerEntryType, "neutral" | "success" | "warning" | "danger"> = {
  INVOICE: "neutral",
  PAYMENT: "success",
  PAYMENT_CANCELLED: "danger",
};

function hrefFor(entry: { type: LedgerEntryType; refId: string }): string {
  return entry.type === "INVOICE" ? `/sales/invoices/${entry.refId}` : `/sales/payments-received/${entry.refId}`;
}

export async function CustomerLedgerView({ companyId, clientId }: { companyId: string; clientId: string }) {
  const entries = await getCustomerLedger({ companyId, clientId });

  if (entries.length === 0) {
    return <EmptyState title="No ledger activity yet" description="Invoices and payments for this client will show up here." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Reference</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5 text-right">Debit</th>
            <th className="px-4 py-2.5 text-right">Credit</th>
            <th className="px-4 py-2.5 text-right">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry, index) => (
            <tr key={`${entry.type}-${entry.refId}-${index}`}>
              <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{entry.date.toLocaleDateString()}</td>
              <td className="px-4 py-2.5">
                <Link href={hrefFor(entry)} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                  {entry.reference}
                </Link>
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={TYPE_VARIANT[entry.type]}>{TYPE_LABELS[entry.type]}</Badge>
              </td>
              <td className="px-4 py-2.5 text-right text-slate-700">{entry.debit > 0 ? `₹${entry.debit.toLocaleString("en-IN")}` : "-"}</td>
              <td className="px-4 py-2.5 text-right text-slate-700">{entry.credit > 0 ? `₹${entry.credit.toLocaleString("en-IN")}` : "-"}</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">₹{entry.balance.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
