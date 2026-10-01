import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listProjects } from "@/lib/energy/projects/queries";
import { canManageProjects } from "@/lib/core/permissions";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectType, type ProjectStatus } from "@/lib/energy/projects/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProjectStatusBadge } from "./status-badge";

function isType(value: string | undefined): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value ?? "");
}
function isStatus(value: string | undefined): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value ?? "");
}

export async function ProjectListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const type = isType(typeof params.type === "string" ? params.type : undefined) ? (params.type as ProjectType) : "all";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as ProjectStatus) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const canCreate = canManageProjects(session.role);
  const { items, total, pageSize } = await listProjects({ companyId: session.companyId, q, type, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (type !== "all") qs.set("type", type);
    if (status !== "all") qs.set("status", status);
    if (targetPage > 1) qs.set("page", String(targetPage));
    const query = qs.toString();
    return query ? `/projects?${query}` : "/projects";
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Energy installation projects and execution tracking."
        actions={
          canCreate ? (
            <Link href="/projects/new">
              <Button>
                <Plus className="h-4 w-4" />
                New project
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
            <Input id="q" name="q" defaultValue={q} placeholder="Project number, name, customer…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">
            Type
          </label>
          <Select id="type" name="type" defaultValue={type} className="w-56">
            <option value="all">All</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="w-40">
            <option value="all">All</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={total === 0 && !q && status === "all" ? "No projects yet" : "No matches"}
          description={
            total === 0 && !q && status === "all"
              ? "Create a project from a confirmed Sales Order, or start one directly."
              : "Try a different search or filter."
          }
          action={
            canCreate && total === 0 && !q && status === "all" ? (
              <Link href="/projects/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New project
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
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Expected Completion</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${p.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                      {p.projectNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-700">{p.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.site?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{PROJECT_TYPE_LABELS[p.type as ProjectType] ?? p.type}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {p.expectedCompletionDate ? p.expectedCompletionDate.toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <ProjectStatusBadge status={p.status} />
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
