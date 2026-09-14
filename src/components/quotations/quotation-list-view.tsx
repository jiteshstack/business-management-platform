import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listQuotations, type QuotationSortKey } from "@/lib/energy/quotations/queries";
import { canManageQuotations } from "@/lib/core/permissions";
import {
  QUOTATION_TYPES,
  QUOTATION_TYPE_LABELS,
  QUOTATION_STATUSES,
  QUOTATION_STATUS_LABELS,
  type QuotationType,
  type QuotationStatus,
} from "@/lib/energy/quotations/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { QuotationStatusBadge } from "./status-badge";

function isType(value: string | undefined): value is QuotationType {
  return (QUOTATION_TYPES as readonly string[]).includes(value ?? "");
}
function isStatus(value: string | undefined): value is QuotationStatus {
  return (QUOTATION_STATUSES as readonly string[]).includes(value ?? "");
}
function isSort(value: string | undefined): value is QuotationSortKey {
  return ["date_desc", "date_asc", "amount_desc", "amount_asc", "number_desc"].includes(value ?? "");
}

export async function QuotationListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const type = isType(typeof params.type === "string" ? params.type : undefined) ? (params.type as QuotationType) : "all";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined)
    ? (params.status as QuotationStatus)
    : "all";
  const sort = isSort(typeof params.sort === "string" ? params.sort : undefined) ? (params.sort as QuotationSortKey) : "date_desc";
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : "";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const canCreate = canManageQuotations(session.role);

  const { items, total, pageSize } = await listQuotations({
    companyId: session.companyId,
    q,
    type,
    status,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sort,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (type !== "all") qs.set("type", type);
    if (status !== "all") qs.set("status", status);
    if (sort !== "date_desc") qs.set("sort", sort);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/sales/quotations?${query}` : "/sales/quotations";
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Energy solution quotations for clients."
        actions={
          canCreate ? (
            <Link href="/sales/quotations/new">
              <Button>
                <Plus className="h-4 w-4" />
                New quotation
              </Button>
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Number, client, subject…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">
            Type
          </label>
          <Select id="type" name="type" defaultValue={type} className="w-40">
            <option value="all">All</option>
            {QUOTATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUOTATION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="w-36">
            <option value="all">All</option>
            {QUOTATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTATION_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="dateFrom" className="mb-1 block text-sm font-medium text-slate-700">
            From
          </label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} className="w-36" />
        </div>
        <div>
          <label htmlFor="dateTo" className="mb-1 block text-sm font-medium text-slate-700">
            To
          </label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} className="w-36" />
        </div>
        <div>
          <label htmlFor="sort" className="mb-1 block text-sm font-medium text-slate-700">
            Sort by
          </label>
          <Select id="sort" name="sort" defaultValue={sort} className="w-40">
            <option value="date_desc">Date (newest)</option>
            <option value="date_asc">Date (oldest)</option>
            <option value="amount_desc">Amount (high–low)</option>
            <option value="amount_asc">Amount (low–high)</option>
            <option value="number_desc">Quotation number</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={total === 0 && !q && status === "all" && type === "all" ? "No quotations yet" : "No matches"}
          description={
            total === 0 && !q && status === "all" && type === "all"
              ? "Create your first quotation to get started."
              : "Try a different search or filter."
          }
          action={
            canCreate && total === 0 && !q && status === "all" ? (
              <Link href="/sales/quotations/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New quotation
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Number</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Valid Until</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Rev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((quotation) => (
                <tr key={quotation.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/sales/quotations/${quotation.id}`}
                      className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {quotation.quotationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                    {quotation.quotationDate.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{quotation.client.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {QUOTATION_TYPE_LABELS[quotation.type as QuotationType] ?? quotation.type}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    ₹{quotation.grandTotal.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {quotation.validUntil ? quotation.validUntil.toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <QuotationStatusBadge status={quotation.status} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {quotation.revisionNumber > 0 ? `Rev ${quotation.revisionNumber}` : "-"}
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
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="secondary" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Link href={pageHref(page - 1)}>
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
              <Link href={pageHref(page + 1)}>
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
