import Link from "next/link";
import { Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listPurchaseReceipts } from "@/lib/energy/purchase-receipts/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function PurchaseReceiptListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const { items, total, pageSize } = await listPurchaseReceipts({ companyId: session.companyId, q, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Purchase Receipts" description="Stock received against purchase orders." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Receipt number, vendor, PO…" className="pl-8" />
          </div>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No purchase receipts yet"
          description="Receive stock against a confirmed purchase order to see it here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Receipt</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Purchase Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{r.receiptNumber}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.receiptDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.vendor.name}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/purchase/purchase-orders/${r.purchaseOrderId}?tab=receipts`}
                      className="text-emerald-700 hover:underline"
                    >
                      {r.purchaseOrder.poNumber}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>
            Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
          </p>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="secondary" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Link href={`/purchase/purchase-receipts?q=${q}&page=${page - 1}`}>
                <Button variant="secondary" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page >= totalPages ? (
              <Button variant="secondary" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Link href={`/purchase/purchase-receipts?q=${q}&page=${page + 1}`}>
                <Button variant="secondary" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
