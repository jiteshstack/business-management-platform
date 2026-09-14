import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listServiceRequests } from "@/lib/energy/service-requests/queries";
import { canManageServiceRequests } from "@/lib/core/permissions";
import {
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_PRIORITIES,
  SERVICE_REQUEST_PRIORITY_LABELS,
  type ServiceRequestStatus,
  type ServiceRequestPriority,
} from "@/lib/energy/service-requests/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ServiceRequestStatusBadge, ServiceRequestPriorityBadge } from "./status-badge";

function isStatus(value: string | undefined): value is ServiceRequestStatus {
  return (SERVICE_REQUEST_STATUSES as readonly string[]).includes(value ?? "");
}
function isPriority(value: string | undefined): value is ServiceRequestPriority {
  return (SERVICE_REQUEST_PRIORITIES as readonly string[]).includes(value ?? "");
}

export async function ServiceRequestListView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as ServiceRequestStatus) : "all";
  const priority = isPriority(typeof params.priority === "string" ? params.priority : undefined) ? (params.priority as ServiceRequestPriority) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const canCreate = canManageServiceRequests(session.role);
  const { items, total, pageSize } = await listServiceRequests({ companyId: session.companyId, q, status, priority, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status !== "all") qs.set("status", status);
    if (priority !== "all") qs.set("priority", priority);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/service/service-requests?${query}` : "/service/service-requests";
  }

  return (
    <div>
      <PageHeader
        title="Service Requests"
        description="Customer complaints, inspections, and post-installation support."
        actions={
          canCreate ? (
            <Link href="/service/service-requests/new">
              <Button><Plus className="h-4 w-4" />New Service Request</Button>
            </Link>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Request number, issue, customer, serial…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <Select id="status" name="status" defaultValue={status} className="w-48">
            <option value="all">All</option>
            {SERVICE_REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>{SERVICE_REQUEST_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="priority" className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
          <Select id="priority" name="priority" defaultValue={priority} className="w-40">
            <option value="all">All</option>
            {SERVICE_REQUEST_PRIORITIES.map((p) => (
              <option key={p} value={p}>{SERVICE_REQUEST_PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No service requests yet"
          description="Log a customer complaint or support request to get started."
          action={canCreate ? <Link href="/service/service-requests/new"><Button size="sm"><Plus className="h-4 w-4" />New Service Request</Button></Link> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Request</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Issue</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Assigned</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((sr) => (
                <tr key={sr.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/service/service-requests/${sr.id}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{sr.requestNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{sr.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{sr.issue}</td>
                  <td className="px-4 py-2.5"><ServiceRequestPriorityBadge priority={sr.priority} /></td>
                  <td className="px-4 py-2.5 text-slate-600">{sr.assignedTo?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{sr.requestDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5"><ServiceRequestStatusBadge status={sr.status} /></td>
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
