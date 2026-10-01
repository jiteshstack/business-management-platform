import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { listProjectSites } from "@/lib/energy/project-sites/queries";
import { canManageSites } from "@/lib/core/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function ProjectSiteListView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const canCreate = canManageSites(session.role);
  const { items, total, pageSize } = await listProjectSites({ companyId: session.companyId, q, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Customer installation locations."
        actions={
          canCreate ? (
            <Link href="/projects/sites/new">
              <Button>
                <Plus className="h-4 w-4" />
                New site
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
            <Input id="q" name="q" defaultValue={q} placeholder="Site name, city, customer…" className="pl-8" />
          </div>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No sites yet"
          description="Add a customer's installation location to get started."
          action={
            canCreate ? (
              <Link href="/projects/sites/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New site
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Site</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">City</th>
                <th className="px-4 py-2.5">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((site) => (
                <tr key={site.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/sites/${site.id}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{site.customer.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{site.city ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{site.contactPerson ?? "-"}</td>
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
              <Link href={`/projects/sites?q=${q}&page=${page - 1}`}>
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
              <Link href={`/projects/sites?q=${q}&page=${page + 1}`}>
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
