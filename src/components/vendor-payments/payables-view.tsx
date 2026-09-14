import Link from "next/link";
import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listPayables, getPayablesSummary } from "@/lib/energy/vendor-payments/queries";
import { AGEING_BUCKETS, AGEING_BUCKET_LABELS, ageingBucketForDueDate, type AgeingBucket } from "@/lib/energy/vendor-payments/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { VendorInvoiceStatusBadge } from "@/components/vendor-invoices/status-badge";

function isBucket(value: string | undefined): value is AgeingBucket {
  return (AGEING_BUCKETS as readonly string[]).includes(value ?? "");
}

export async function PayablesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const bucket = isBucket(typeof params.bucket === "string" ? params.bucket : undefined) ? (params.bucket as AgeingBucket) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const [summary, { items, total, pageSize }] = await Promise.all([
    getPayablesSummary(session.companyId),
    listPayables({ companyId: session.companyId, bucket, page }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const STAT_CARDS: { label: string; value: number }[] = [
    { label: "Total Payable", value: summary.totalPayable },
    { label: "Due Today", value: summary.dueToday },
    { label: "Due This Week", value: summary.dueThisWeek },
    { label: "Overdue", value: summary.overdue },
  ];

  return (
    <div>
      <PageHeader
        title="Vendor Payables"
        description="How much Shanvi Enterprises owes its vendors."
        actions={
          <Link href="/api/reports/export?type=payables" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
            <Download className="h-4 w-4" /> Export CSV
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">₹{s.value.toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Partially Paid: {summary.partiallyPaidCount}</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">Unpaid: {summary.unpaidCount}</span>
      </div>

      <form method="get" className="mt-6 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bucket" className="mb-1 block text-sm font-medium text-slate-700">
            Ageing bucket
          </label>
          <Select id="bucket" name="bucket" defaultValue={bucket} className="w-56">
            <option value="all">All</option>
            {AGEING_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {AGEING_BUCKET_LABELS[b]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="Nothing payable" description="No vendor invoices match this filter." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Invoice Date</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Paid</th>
                <th className="px-4 py-2.5">Outstanding</th>
                <th className="px-4 py-2.5">Ageing</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/parties/vendors/${inv.vendorId}`} className="text-slate-700 hover:text-emerald-700 hover:underline">
                      {inv.vendor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/purchase/vendor-invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{inv.invoiceDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{inv.dueDate ? inv.dueDate.toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-2.5 text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">₹{inv.paidAmount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">₹{inv.outstandingAmount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <Link href={`/finance/payables?bucket=${ageingBucketForDueDate(inv.dueDate)}`} className="hover:underline">
                      {AGEING_BUCKET_LABELS[ageingBucketForDueDate(inv.dueDate)]}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <VendorInvoiceStatusBadge status={inv.status} />
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
              <Link href={`/finance/payables?bucket=${bucket}&page=${page - 1}`}>
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
              <Link href={`/finance/payables?bucket=${bucket}&page=${page + 1}`}>
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
