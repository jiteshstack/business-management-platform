import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listAmcs } from "@/lib/energy/amc/queries";
import { canManageAmcs } from "@/lib/core/permissions";
import { AMC_DISPLAY_STATUSES, AMC_DISPLAY_STATUS_LABELS, type AmcDisplayStatus } from "@/lib/energy/amc/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AmcStatusBadge } from "./status-badge";

function isStatus(value: string | undefined): value is AmcDisplayStatus {
  return (AMC_DISPLAY_STATUSES as readonly string[]).includes(value ?? "");
}

export async function AmcListView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as AmcDisplayStatus) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const canCreate = canManageAmcs(session.role);
  const { items, total, pageSize } = await listAmcs({ companyId: session.companyId, q, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status !== "all") qs.set("status", status);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/service/amc?${query}` : "/service/amc";
  }

  return (
    <div>
      <PageHeader
        title="AMC"
        description="Annual maintenance contracts and renewals."
        actions={
          canCreate ? (
            <Link href="/service/amc/new">
              <Button><Plus className="h-4 w-4" />New AMC</Button>
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="AMC number, customer…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <Select id="status" name="status" defaultValue={status} className="w-48">
            <option value="all">All</option>
            {AMC_DISPLAY_STATUSES.map((s) => (
              <option key={s} value={s}>{AMC_DISPLAY_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No AMCs yet"
          description="Create an annual maintenance contract for a customer."
          action={canCreate ? <Link href="/service/amc/new"><Button size="sm"><Plus className="h-4 w-4" />New AMC</Button></Link> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">AMC</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Contract Value</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/service/amc/${a.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">{a.amcNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{a.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.site?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.startDate.toLocaleDateString()} – {a.endDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-700">{a.contractValue ? `₹${a.contractValue.toLocaleString("en-IN")}` : "-"}</td>
                  <td className="px-4 py-2.5"><AmcStatusBadge amc={a} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</p>
          <div className="flex gap-2">
            {page <= 1 ? <Button variant="secondary" size="sm" disabled>Previous</Button> : <Link href={pageHref(page - 1)}><Button variant="secondary" size="sm">Previous</Button></Link>}
            {page >= totalPages ? <Button variant="secondary" size="sm" disabled>Next</Button> : <Link href={pageHref(page + 1)}><Button variant="secondary" size="sm">Next</Button></Link>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
