import Link from "next/link";
import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { canViewProfitability } from "@/lib/core/permissions";
import {
  getSalesSummary,
  getCollectionsSummary,
  getPurchaseSummary,
  getVendorPaymentsSummary,
  getExpenseSummaryForRange,
  getSalesByCustomer,
  getVendorPurchases,
  getExpenseByCategoryReport,
  getExpenseByProjectReport,
  getServiceSummaryReport,
  getMaintenanceActivityReport,
} from "@/lib/energy/reporting/queries";
import { resolvePeriodRange, isReportPeriod, type ReportPeriod } from "@/lib/energy/reporting/period";
import { getInvoiceDashboard } from "@/lib/energy/invoices/queries";
import { getReceivablesSummary } from "@/lib/energy/payments/queries";
import { getPayablesSummary } from "@/lib/energy/vendor-payments/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodFilterFields } from "@/components/shared/period-filter-fields";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "sales", label: "Sales" },
  { key: "collections", label: "Collections" },
  { key: "purchases", label: "Purchases" },
  { key: "projects", label: "Projects" },
  { key: "service", label: "Service" },
  { key: "expenses", label: "Expenses" },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]["key"];

function isCategory(value: string | undefined): value is CategoryKey {
  return (CATEGORIES.map((c) => c.key) as string[]).includes(value ?? "");
}

export async function ReportsView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession();
  const params = await searchParams;

  const category: CategoryKey = isCategory(typeof params.category === "string" ? params.category : undefined)
    ? (params.category as CategoryKey)
    : "sales";
  const period: ReportPeriod = isReportPeriod(typeof params.period === "string" ? params.period : undefined)
    ? (params.period as ReportPeriod)
    : "THIS_MONTH";
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const range = resolvePeriodRange(period, from, to);

  function tabHref(key: CategoryKey) {
    const qs = new URLSearchParams({ category: key, period });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return `/reports?${qs.toString()}`;
  }

  return (
    <div>
      <PageHeader title="Reports" description="Sales, collections, purchases, project, service, and expense reports - derived from existing transactions." />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={tabHref(c.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              category === c.key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="category" value={category} />
        <PeriodFilterFields period={period} from={from} to={to} />
        <Button type="submit" variant="secondary">Apply</Button>
      </form>

      {category === "sales" ? <SalesReports companyId={session.companyId} range={range} label={range.label} /> : null}
      {category === "collections" ? <CollectionsReports companyId={session.companyId} range={range} label={range.label} /> : null}
      {category === "purchases" ? <PurchaseReports companyId={session.companyId} range={range} label={range.label} /> : null}
      {category === "projects" ? <ProjectReports companyId={session.companyId} range={range} canProfitability={canViewProfitability(session.role)} /> : null}
      {category === "service" ? <ServiceReports companyId={session.companyId} range={range} /> : null}
      {category === "expenses" ? <ExpenseReports companyId={session.companyId} range={range} /> : null}
    </div>
  );
}

function ExportLink({ type, period, from, to }: { type: string; period: string; from?: string; to?: string }) {
  const qs = new URLSearchParams({ type, period });
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return (
    <Link href={`/api/reports/export?${qs.toString()}`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
      <Download className="h-3 w-3" /> Export CSV
    </Link>
  );
}

async function SalesReports({ companyId, range, label }: { companyId: string; range: { from: Date; to: Date }; label: string }) {
  const [salesSummary, invoiceDashboard, byCustomer] = await Promise.all([
    getSalesSummary(companyId, range),
    getInvoiceDashboard(companyId),
    getSalesByCustomer(companyId, range),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sales Summary - {label}</p>
            <ExportLink type="sales" period={label} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Invoices Issued" value={String(salesSummary.count)} />
            <Stat label="Sales Total" value={`₹${salesSummary.total.toLocaleString("en-IN")}`} />
            <Stat label="All-time Invoices" value={String(invoiceDashboard.total)} />
            <Stat label="All-time Outstanding" value={`₹${invoiceDashboard.outstanding.toLocaleString("en-IN")}`} />
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer Sales - {label}</p>
        {byCustomer.length === 0 ? (
          <EmptyState title="No sales in this period" />
        ) : (
          <ReportTable
            columns={["Customer", "Invoices", "Invoiced"]}
            rows={byCustomer.map((r) => [
              <Link key={r.clientId} href={`/parties/clients/${r.clientId}`} className="text-emerald-700 hover:underline">{r.clientName}</Link>,
              String(r.count),
              `₹${r.invoiced.toLocaleString("en-IN")}`,
            ])}
          />
        )}
      </div>
    </div>
  );
}

async function CollectionsReports({ companyId, range, label }: { companyId: string; range: { from: Date; to: Date }; label: string }) {
  const [collections, receivables] = await Promise.all([getCollectionsSummary(companyId, range), getReceivablesSummary(companyId)]);
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Collections - {label}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Payments Received" value={String(collections.count)} />
            <Stat label="Collected" value={`₹${collections.total.toLocaleString("en-IN")}`} />
            <Stat label="Total Receivables" value={`₹${receivables.totalReceivables.toLocaleString("en-IN")}`} />
            <Stat label="Overdue" value={`₹${receivables.overdue.toLocaleString("en-IN")}`} />
          </div>
          <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-sm">
            <Link href="/sales/payments-received" className="text-emerald-700 hover:underline">View Customer Collections →</Link>
            <Link href="/finance/receivables" className="text-emerald-700 hover:underline">View Receivables &amp; Ageing →</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function PurchaseReports({ companyId, range, label }: { companyId: string; range: { from: Date; to: Date }; label: string }) {
  const [purchases, vendorPayments, payables, byVendor] = await Promise.all([
    getPurchaseSummary(companyId, range),
    getVendorPaymentsSummary(companyId, range),
    getPayablesSummary(companyId),
    getVendorPurchases(companyId, range),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Purchase Summary - {label}</p>
            <ExportLink type="purchases" period={label} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Vendor Invoices" value={String(purchases.count)} />
            <Stat label="Purchases Total" value={`₹${purchases.total.toLocaleString("en-IN")}`} />
            <Stat label="Vendor Payments" value={`₹${vendorPayments.total.toLocaleString("en-IN")}`} />
            <Stat label="Total Payable" value={`₹${payables.totalPayable.toLocaleString("en-IN")}`} />
          </div>
          <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-sm">
            <Link href="/finance/payables" className="text-emerald-700 hover:underline">View Vendor Payables &amp; Ageing →</Link>
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Vendor Purchases - {label}</p>
        {byVendor.length === 0 ? (
          <EmptyState title="No purchases in this period" />
        ) : (
          <ReportTable
            columns={["Vendor", "Vendor Invoices", "Purchased"]}
            rows={byVendor.map((r) => [
              <Link key={r.vendorId} href={`/parties/vendors/${r.vendorId}`} className="text-emerald-700 hover:underline">{r.vendorName}</Link>,
              String(r.count),
              `₹${r.purchased.toLocaleString("en-IN")}`,
            ])}
          />
        )}
      </div>
    </div>
  );
}

async function ProjectReports({ companyId, range, canProfitability }: { companyId: string; range: { from: Date; to: Date }; canProfitability: boolean }) {
  const byProject = await getExpenseByProjectReport(companyId, range);
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4 text-sm">
          <Link href="/projects" className="text-emerald-700 hover:underline">View Project Summary →</Link>
          {canProfitability ? (
            <Link href="/finance/profitability" className="text-emerald-700 hover:underline">View Project Profitability →</Link>
          ) : null}
        </CardContent>
      </Card>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Project Expenses</p>
        {byProject.length === 0 ? (
          <EmptyState title="No project expenses in this period" />
        ) : (
          <ReportTable
            columns={["Project", "Expense Records", "Total"]}
            rows={byProject.map((r) => [
              <Link key={r.projectId} href={`/projects/${r.projectId}`} className="text-emerald-700 hover:underline">{r.projectNumber}</Link>,
              String(r.count),
              `₹${r.total.toLocaleString("en-IN")}`,
            ])}
          />
        )}
      </div>
    </div>
  );
}

async function ServiceReports({ companyId, range }: { companyId: string; range: { from: Date; to: Date } }) {
  const [service, maintenance] = await Promise.all([getServiceSummaryReport(companyId, range), getMaintenanceActivityReport(companyId, range)]);
  return (
    <Card>
      <CardContent className="py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Service &amp; Maintenance Activity</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Service Requests Logged" value={String(service.total)} />
          <Stat label="Resolved/Closed" value={String(service.resolved)} />
          <Stat label="Maintenance Visits" value={String(maintenance.scheduled)} />
          <Stat label="Visits Completed" value={String(maintenance.completed)} />
        </div>
        {service.byPriority.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">By Priority</p>
            <ul className="flex flex-wrap gap-4 text-sm">
              {service.byPriority.map((p) => (
                <li key={p.priority} className="text-slate-700">{p.priority}: <span className="font-medium">{p.count}</span></li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function ExpenseReports({ companyId, range }: { companyId: string; range: { from: Date; to: Date } }) {
  const [summary, byCategory, byProject] = await Promise.all([
    getExpenseSummaryForRange(companyId, range),
    getExpenseByCategoryReport(companyId, range),
    getExpenseByProjectReport(companyId, range),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expense Summary</p>
            <ExportLink type="expenses" period="all" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <Stat label="Expense Records" value={String(summary.count)} />
            <Stat label="Total" value={`₹${summary.total.toLocaleString("en-IN")}`} />
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <Link href="/finance/expenses" className="text-emerald-700 hover:underline">View all Expenses →</Link>
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Expense by Category</p>
        {byCategory.length === 0 ? (
          <EmptyState title="No expenses in this period" />
        ) : (
          <ReportTable columns={["Category", "Records", "Total"]} rows={byCategory.map((r) => [r.categoryName, String(r.count), `₹${r.total.toLocaleString("en-IN")}`])} />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Expense by Project</p>
        {byProject.length === 0 ? (
          <EmptyState title="No project expenses in this period" />
        ) : (
          <ReportTable
            columns={["Project", "Records", "Total"]}
            rows={byProject.map((r) => [
              <Link key={r.projectId} href={`/projects/${r.projectId}`} className="text-emerald-700 hover:underline">{r.projectNumber}</Link>,
              String(r.count),
              `₹${r.total.toLocaleString("en-IN")}`,
            ])}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReportTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c} className="px-4 py-2.5">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-slate-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
