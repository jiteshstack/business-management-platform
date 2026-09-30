import Link from "next/link";
import { Lock, Download } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { canViewProfitability } from "@/lib/core/permissions";
import { listProjectProfitability, listCustomerProfitability } from "@/lib/energy/reporting/project-profitability";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/energy/projects/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "project", label: "By Project" },
  { key: "customer", label: "By Customer" },
] as const;

export async function ProfitabilityView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  if (!canViewProfitability(session.role)) {
    return (
      <div>
        <PageHeader title="Profitability" />
        <EmptyState icon={Lock} title="Access restricted" description="Only Owner/Admin and Accounts can view profitability." />
      </div>
    );
  }

  const params = await searchParams;
  const tab = params.tab === "customer" ? "customer" : "project";

  return (
    <div>
      <PageHeader
        title="Profitability"
        description="Estimated / operational profitability by project and customer - derived from invoiced revenue, installed material cost, service part cost, and project expenses. Not statutory accounting profit."
      />

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "project" ? "/finance/profitability" : "/finance/profitability?tab=customer"}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "project" ? <ProjectProfitabilityTable companyId={session.companyId} params={params} /> : <CustomerProfitabilityTable companyId={session.companyId} params={params} />}
    </div>
  );
}

function isStatus(value: string | undefined): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value ?? "");
}

async function ProjectProfitabilityTable({ companyId, params }: { companyId: string; params: Record<string, string | string[] | undefined> }) {
  const customerId = typeof params.customerId === "string" ? params.customerId : "";
  const status = isStatus(typeof params.status === "string" ? params.status : undefined) ? (params.status as ProjectStatus) : undefined;
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;

  const [customers, { items, total, pageSize }] = await Promise.all([
    prisma.party.findMany({ where: { companyId, type: "CLIENT", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listProjectProfitability({ companyId, customerId: customerId || undefined, status, page }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams({ tab: "project" });
    if (customerId) qs.set("customerId", customerId);
    if (status) qs.set("status", status);
    if (targetPage > 1) qs.set("page", String(targetPage));
    return `/finance/profitability?${qs.toString()}`;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {/* Plain <a>, not <Link>: this triggers a file download from a route
        handler, not a page navigation - Link would prefetch it as if it
        were a page, spamming the route with bad requests. */}
        <a href="/api/reports/export?type=project-profitability" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </div>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="project" />
        <div>
          <label htmlFor="customerId" className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
          <Select id="customerId" name="customerId" defaultValue={customerId} className="w-56">
            <option value="">All</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <Select id="status" name="status" defaultValue={status ?? ""} className="w-40">
            <option value="">All</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No projects match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Revenue</th>
                <th className="px-4 py-2.5">Direct Cost</th>
                <th className="px-4 py-2.5">Expenses</th>
                <th className="px-4 py-2.5">Estimated Profit</th>
                <th className="px-4 py-2.5">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.projectId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${p.projectId}?tab=profitability`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{p.projectNumber}</Link>
                    <p className="text-xs text-slate-500">{p.name}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{p.customerName}</td>
                  <td className="px-4 py-2.5 text-slate-700">₹{p.revenue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">₹{(p.materialCost + p.serviceCost).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">₹{p.expenseCost.toLocaleString("en-IN")}</td>
                  <td className={cn("px-4 py-2.5 font-medium", p.estimatedProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                    ₹{p.estimatedProfit.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.estimatedMargin}%</td>
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
      <p className="mt-3 text-xs text-slate-400">Estimated / operational figures - see the project&apos;s own Profitability tab for the full breakdown and methodology.</p>
    </div>
  );
}

async function CustomerProfitabilityTable({ companyId, params }: { companyId: string; params: Record<string, string | string[] | undefined> }) {
  const page = Number(typeof params.page === "string" ? params.page : "1") || 1;
  const { items, total, pageSize } = await listCustomerProfitability({ companyId, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState title="No customers yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Projects</th>
                <th className="px-4 py-2.5">Invoiced</th>
                <th className="px-4 py-2.5">Collected</th>
                <th className="px-4 py-2.5">Direct Cost</th>
                <th className="px-4 py-2.5">Estimated Profit</th>
                <th className="px-4 py-2.5">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.customerId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/parties/clients/${c.customerId}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">{c.customerName}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.projectCount}</td>
                  <td className="px-4 py-2.5 text-slate-700">₹{c.revenue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">₹{c.collected.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-slate-600">₹{c.totalCost.toLocaleString("en-IN")}</td>
                  <td className={cn("px-4 py-2.5 font-medium", c.estimatedProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                    ₹{c.estimatedProfit.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.estimatedMargin}%</td>
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
            {page <= 1 ? <Button variant="secondary" size="sm" disabled>Previous</Button> : <Link href={`/finance/profitability?tab=customer&page=${page - 1}`}><Button variant="secondary" size="sm">Previous</Button></Link>}
            {page >= totalPages ? <Button variant="secondary" size="sm" disabled>Next</Button> : <Link href={`/finance/profitability?tab=customer&page=${page + 1}`}><Button variant="secondary" size="sm">Next</Button></Link>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
