import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listMaintenanceVisits, listMaintenanceSchedule } from "@/lib/energy/maintenance-visits/queries";
import { canManageMaintenanceVisits } from "@/lib/core/permissions";
import { VISIT_STATUSES, VISIT_STATUS_LABELS, type VisitStatus } from "@/lib/energy/maintenance-visits/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { VisitStatusBadge } from "./status-badge";

function isStatus(value: string | undefined): value is VisitStatus {
  return (VISIT_STATUSES as readonly string[]).includes(value ?? "");
}

export async function VisitListView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;

  const view = params.view === "all" ? "all" : "schedule";
  const canCreate = canManageMaintenanceVisits(session.role);

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Upcoming and completed maintenance visits - AMC preventive maintenance, warranty service, and breakdown calls."
        actions={
          canCreate ? (
            <Link href="/service/maintenance/new">
              <Button><Plus className="h-4 w-4" />Schedule Visit</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <Link href="/service/maintenance" className={cn("border-b-2 px-3 py-2 text-sm font-medium", view === "schedule" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-900")}>
          Upcoming & Due
        </Link>
        <Link href="/service/maintenance?view=all" className={cn("border-b-2 px-3 py-2 text-sm font-medium", view === "all" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-900")}>
          All Visits
        </Link>
      </div>

      {view === "schedule" ? <ScheduleTable companyId={session.companyId} /> : <AllVisitsTable companyId={session.companyId} params={params} />}
    </div>
  );
}

async function ScheduleTable({ companyId }: { companyId: string }) {
  const rows = await listMaintenanceSchedule({ companyId });
  if (rows.length === 0) {
    return <EmptyState title="Nothing scheduled" description="Upcoming and overdue maintenance visits will show up here." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Visit</th>
            <th className="px-4 py-2.5">Customer</th>
            <th className="px-4 py-2.5">Site</th>
            <th className="px-4 py-2.5">Date</th>
            <th className="px-4 py-2.5">Assigned</th>
            <th className="px-4 py-2.5">AMC / SR</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((v) => (
            <tr key={v.id} className={v.isOverdue ? "bg-red-50/50" : undefined}>
              <td className="px-4 py-2.5">
                <Link href={`/service/maintenance/${v.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{v.visitNumber}</Link>
              </td>
              <td className="px-4 py-2.5 text-slate-700">{v.customer.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{v.site?.name ?? "-"}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {v.visitDate.toLocaleDateString()} {v.isOverdue ? <Badge variant="danger" className="ml-1">Overdue</Badge> : null}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{v.technician?.name ?? "-"}</td>
              <td className="px-4 py-2.5 text-slate-600">{v.amc?.amcNumber ?? v.serviceRequest?.requestNumber ?? "-"}</td>
              <td className="px-4 py-2.5"><VisitStatusBadge status={v.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function AllVisitsTable({ companyId, params }: { companyId: string; params: Record<string, string | string[] | undefined> }) {
  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as VisitStatus) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const { items, total, pageSize } = await listMaintenanceVisits({ companyId, q, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams({ view: "all" });
    if (q) qs.set("q", q);
    if (status !== "all") qs.set("status", status);
    if (targetPage > 1) qs.set("page", String(targetPage));
    return `/service/maintenance?${qs.toString()}`;
  }

  return (
    <div>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value="all" />
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Visit number, customer…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <Select id="status" name="status" defaultValue={status} className="w-44">
            <option value="all">All</option>
            {VISIT_STATUSES.map((s) => (
              <option key={s} value={s}>{VISIT_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No maintenance visits yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Visit</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Technician</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/service/maintenance/${v.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{v.visitNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{v.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.visitDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-600">{v.technician?.name ?? "-"}</td>
                  <td className="px-4 py-2.5"><VisitStatusBadge status={v.status} /></td>
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
