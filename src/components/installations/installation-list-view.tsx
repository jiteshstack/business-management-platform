import Link from "next/link";
import { Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listInstallations } from "@/lib/energy/installations/queries";
import { INSTALLATION_STATUSES, INSTALLATION_STATUS_LABELS, type InstallationStatus } from "@/lib/energy/installations/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InstallationStatusBadge } from "./status-badge";

function isStatus(value: string | undefined): value is InstallationStatus {
  return (INSTALLATION_STATUSES as readonly string[]).includes(value ?? "");
}

export async function InstallationListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as InstallationStatus) : "all";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const { items, total, pageSize } = await listInstallations({ companyId: session.companyId, q, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Installations" description="Equipment installation records." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="q" name="q" defaultValue={q} placeholder="Installation number, project, customer…" className="pl-8" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="w-44">
            <option value="all">All</option>
            {INSTALLATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INSTALLATION_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No installations yet" description="Create an installation from a project in progress." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Number</th>
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Technician</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/installations/${i.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                      {i.installationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${i.projectId}`} className="text-emerald-700 hover:underline">
                      {i.project.projectNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{i.project.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{i.site?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{i.installationDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-600">{i.technician?.name ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <InstallationStatusBadge status={i.status} />
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
              <Link href={`/projects/installations?q=${q}&status=${status}&page=${page - 1}`}>
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
              <Link href={`/projects/installations?q=${q}&status=${status}&page=${page + 1}`}>
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
