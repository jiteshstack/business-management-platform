import Link from "next/link";
import { TrendingUp, Landmark, CircleDollarSign, HardHat, LogIn, LogOut, FileText } from "lucide-react";
import { getSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getQuotationDashboard } from "@/lib/energy/quotations/queries";
import { getSalesOrderDashboard } from "@/lib/energy/sales-orders/queries";
import { getInvoiceDashboard } from "@/lib/energy/invoices/queries";
import { getFinanceDashboard } from "@/lib/energy/payments/queries";
import { getPurchaseOrderDashboard } from "@/lib/energy/purchase-orders/queries";
import { getVendorFinanceDashboard } from "@/lib/energy/vendor-payments/queries";
import { getProjectDashboard } from "@/lib/energy/projects/queries";
import { getServiceDashboardStats } from "@/lib/energy/service-requests/queries";
import { getAmcDashboardStats } from "@/lib/energy/amc/queries";
import { getWarrantyDashboardStats } from "@/lib/energy/warranties/queries";
import { getMaintenanceDashboardStats } from "@/lib/energy/maintenance-visits/queries";
import { getExpenseDashboardStats } from "@/lib/energy/expenses/queries";
import { getSalesSummary, getCollectionsSummary, getEstimatedGrossResult, getMonthlyTrend } from "@/lib/energy/reporting/queries";
import { resolvePeriodRange, isReportPeriod, type ReportPeriod } from "@/lib/energy/reporting/period";
import { canViewFinancialDashboard } from "@/lib/core/permissions";
import { SalesOrderStatusBadge } from "@/components/sales-orders/status-badge";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PeriodFilterFields } from "@/components/shared/period-filter-fields";
import { BUSINESS_TYPE_LABELS } from "@/lib/core/business-type";
import { cn } from "@/lib/utils";

const QUOTATION_STATS = [
  { key: "total", label: "Total Quotations" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "approved", label: "Approved" },
  { key: "expiringSoon", label: "Expiring Soon" },
] as const;

const SALES_ORDER_STATS = [
  { key: "total", label: "Total Sales Orders" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "partiallyFulfilled", label: "Partially Fulfilled" },
  { key: "completed", label: "Completed" },
] as const;

const INVOICE_STATS = [
  { key: "total", label: "Total Invoices" },
  { key: "draft", label: "Draft" },
  { key: "issued", label: "Issued" },
  { key: "overdueCount", label: "Overdue" },
] as const;

const PURCHASE_ORDER_STATS = [
  { key: "total", label: "Total Purchase Orders" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "partiallyReceived", label: "Partially Received" },
  { key: "pendingReceiptCount", label: "Awaiting Receipt" },
] as const;

const STATS = [
  { label: "Total Sales", icon: TrendingUp },
  { label: "Receivables", icon: Landmark },
  { label: "Payables", icon: CircleDollarSign },
  { label: "Active Projects", icon: HardHat },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const period: ReportPeriod = isReportPeriod(typeof params.period === "string" ? params.period : undefined)
    ? (params.period as ReportPeriod)
    : "THIS_MONTH";
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const range = resolvePeriodRange(period, from, to);
  // Scoped strictly to the current company — this is the tenant-isolation
  // pattern every later query must follow.
  const recentActivity = session
    ? await prisma.auditLog.findMany({
        where: { companyId: session.companyId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: true },
      })
    : [];
  const quotationStats = session ? await getQuotationDashboard(session.companyId) : null;
  const salesOrderStats = session ? await getSalesOrderDashboard(session.companyId) : null;
  const invoiceStats = session ? await getInvoiceDashboard(session.companyId) : null;
  const financeStats = session ? await getFinanceDashboard(session.companyId) : null;
  const purchaseOrderStats = session ? await getPurchaseOrderDashboard(session.companyId) : null;
  const vendorFinanceStats = session ? await getVendorFinanceDashboard(session.companyId) : null;
  const projectStats = session ? await getProjectDashboard(session.companyId) : null;
  const serviceStats = session ? await getServiceDashboardStats(session.companyId) : null;
  const amcStats = session ? await getAmcDashboardStats(session.companyId) : null;
  const warrantyStats = session ? await getWarrantyDashboardStats(session.companyId) : null;
  const maintenanceStats = session ? await getMaintenanceDashboardStats(session.companyId) : null;
  const expenseStats = session ? await getExpenseDashboardStats(session.companyId) : null;

  const canViewFinancials = session ? canViewFinancialDashboard(session.role) : false;
  const salesThisPeriod = session ? await getSalesSummary(session.companyId, range) : null;
  const businessPerformance = session && canViewFinancials
    ? {
        ...(await getEstimatedGrossResult(session.companyId, range)),
        collections: (await getCollectionsSummary(session.companyId, range)).total,
      }
    : null;
  const monthlyTrend = session && canViewFinancials ? await getMonthlyTrend(session.companyId, 6) : null;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session?.name ?? ""}`}
        description={`${session?.companyName ?? ""} · ${BUSINESS_TYPE_LABELS.ENERGY_SOLUTIONS}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ label, icon: Icon }) => {
          const isTotalSales = label === "Total Sales" && salesThisPeriod;
          const isReceivables = label === "Receivables" && financeStats;
          const isPayables = label === "Payables" && vendorFinanceStats;
          const isActiveProjects = label === "Active Projects" && projectStats;
          return (
            <Card key={label}>
              <CardContent className="flex items-start justify-between py-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  {isTotalSales ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        ₹{salesThisPeriod.total.toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Invoiced - {range.label}</p>
                    </>
                  ) : isReceivables ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        ₹{financeStats.totalReceivables.toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Open invoices outstanding</p>
                    </>
                  ) : isPayables ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        ₹{vendorFinanceStats.totalPayable.toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Owed to vendors</p>
                    </>
                  ) : isActiveProjects ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{projectStats.active}</p>
                      <p className="mt-1 text-xs text-slate-400">Planned, in progress, or on hold</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-slate-300">-</p>
                      <p className="mt-1 text-xs text-slate-400">No data yet</p>
                    </>
                  )}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {canViewFinancials ? (
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <PeriodFilterFields period={period} from={from} to={to} />
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      ) : null}

      {businessPerformance ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Business Performance - {range.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sales</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{businessPerformance.sales.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Collections</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{businessPerformance.collections.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Purchases</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{businessPerformance.purchases.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Expenses</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{businessPerformance.expenses.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Estimated Gross Profit</p>
                <p className={cn("mt-1 text-xl font-semibold", businessPerformance.estimatedGrossResult >= 0 ? "text-emerald-700" : "text-red-600")}>
                  ₹{businessPerformance.estimatedGrossResult.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Estimated Gross Margin</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{businessPerformance.estimatedGrossMargin}%</p>
              </div>
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Estimated Gross Profit = Sales − Purchases − Expenses (operational estimate, not statutory accounting profit). See{" "}
              <Link href="/finance/profitability" className="text-emerald-700 hover:underline">Profitability</Link> for project/customer-level detail.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {monthlyTrend && monthlyTrend.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Purchase vs Sales - Last {monthlyTrend.length} Months</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Sales</th>
                    <th className="py-2 pr-4">Purchases</th>
                    <th className="py-2 pr-4">Expenses</th>
                    <th className="py-2">Estimated Gross Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyTrend.map((row) => (
                    <tr key={row.month}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{row.month}</td>
                      <td className="py-2 pr-4 text-slate-700">₹{row.sales.toLocaleString("en-IN")}</td>
                      <td className="py-2 pr-4 text-slate-700">₹{row.purchases.toLocaleString("en-IN")}</td>
                      <td className="py-2 pr-4 text-slate-700">₹{row.expenses.toLocaleString("en-IN")}</td>
                      <td className={cn("py-2 font-medium", row.estimatedGrossResult >= 0 ? "text-emerald-700" : "text-red-600")}>
                        ₹{row.estimatedGrossResult.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">Operational estimate - not a statutory Profit &amp; Loss statement.</p>
          </CardContent>
        </Card>
      ) : null}

      {expenseStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">This Month</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{expenseStats.thisMonth.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">This Year</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{expenseStats.thisYear.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Unpaid Expenses</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{expenseStats.unpaidCount}</p>
              </div>
            </div>
            {expenseStats.topCategories.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Expense Categories (This Month)</p>
                <ul className="divide-y divide-slate-100">
                  {expenseStats.topCategories.map((c) => (
                    <li key={c.categoryId} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">{c.categoryName}</span>
                      <span className="font-medium text-slate-900">₹{c.total.toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {quotationStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quotations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {QUOTATION_STATS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{quotationStats[key]}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
              <FileText className="h-4 w-4 text-emerald-600" />
              <p className="text-sm text-slate-600">
                Total quotation value:{" "}
                <span className="font-semibold text-slate-900">
                  ₹{quotationStats.totalValue.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {salesOrderStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sales Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {SALES_ORDER_STATS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{salesOrderStats[key]}</p>
                </div>
              ))}
            </div>
            {salesOrderStats.recent.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-2">
                {salesOrderStats.recent.map((so) => (
                  <li key={so.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link
                      href={`/sales/sales-orders/${so.id}`}
                      className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {so.soNumber}
                    </Link>
                    <span className="text-slate-500">{so.client.name}</span>
                    <span className="text-slate-700">₹{so.grandTotal.toLocaleString("en-IN")}</span>
                    <SalesOrderStatusBadge status={so.status} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {invoiceStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {INVOICE_STATS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{invoiceStats[key]}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <p className="text-sm text-slate-600">
                Total invoiced:{" "}
                <span className="font-semibold text-slate-900">
                  ₹{invoiceStats.totalInvoiced.toLocaleString("en-IN")}
                </span>
              </p>
              <p className="text-sm text-slate-600">
                Outstanding:{" "}
                <span className="font-semibold text-slate-900">
                  ₹{invoiceStats.outstanding.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
            {invoiceStats.recent.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-2">
                {invoiceStats.recent.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link
                      href={`/sales/invoices/${inv.id}`}
                      className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <span className="text-slate-500">{inv.client.name}</span>
                    <span className="text-slate-700">₹{inv.grandTotal.toLocaleString("en-IN")}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {financeStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Finance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Receivables</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{financeStats.totalReceivables.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Due Today</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{financeStats.dueToday.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Overdue</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{financeStats.overdue.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Partially Paid</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{financeStats.partiallyPaidCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Unpaid</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{financeStats.unpaidCount}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                Payments received this month:{" "}
                <span className="font-semibold text-slate-900">
                  ₹{financeStats.paymentsReceivedThisMonth.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
            {financeStats.topOutstandingCustomers.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Outstanding Customers</p>
                <ul className="divide-y divide-slate-100">
                  {financeStats.topOutstandingCustomers.map((c) => (
                    <li key={c.clientId} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/parties/clients/${c.clientId}`} className="text-slate-700 hover:text-emerald-700 hover:underline">
                        {c.clientName}
                      </Link>
                      <span className="font-medium text-slate-900">₹{c.outstanding.toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {purchaseOrderStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {PURCHASE_ORDER_STATS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{purchaseOrderStats[key]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {vendorFinanceStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Vendor Payables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Payable</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{vendorFinanceStats.totalPayable.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Overdue</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{vendorFinanceStats.overdue.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Upcoming (7 days)</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">₹{vendorFinanceStats.upcomingPayments.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Partially Paid</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{vendorFinanceStats.partiallyPaidCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Unpaid</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{vendorFinanceStats.unpaidCount}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">
                Vendor payments this month:{" "}
                <span className="font-semibold text-slate-900">
                  ₹{vendorFinanceStats.vendorPaymentsThisMonth.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
            {vendorFinanceStats.topPayableVendors.length > 0 ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Payable Vendors</p>
                <ul className="divide-y divide-slate-100">
                  {vendorFinanceStats.topPayableVendors.map((v) => (
                    <li key={v.vendorId} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/parties/vendors/${v.vendorId}`} className="text-slate-700 hover:text-emerald-700 hover:underline">
                        {v.vendorName}
                      </Link>
                      <span className="font-medium text-slate-900">₹{v.outstanding.toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {projectStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Projects & Installations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active Projects</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{projectStats.active}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Due Soon (14d)</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{projectStats.dueSoon}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Installations Scheduled</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{projectStats.scheduled}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Installations In Progress</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{projectStats.inProgress}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Projects Completed</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{projectStats.completed}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sites Under Execution</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{projectStats.sitesInExecution}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {serviceStats && amcStats && warrantyStats && maintenanceStats ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Warranty, AMC & Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Open Service Requests</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{serviceStats.open}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">High / Critical</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{serviceStats.highCritical}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Resolved This Month</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{serviceStats.resolvedThisMonth}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Maintenance Scheduled</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{maintenanceStats.scheduled}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Maintenance Overdue</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{maintenanceStats.overdue}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active AMCs</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{amcStats.active}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">AMCs Expiring Soon</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{amcStats.expiringSoon}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active Warranties</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{warrantyStats.active}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Warranties Expiring Soon</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{warrantyStats.expiringSoon}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Actions like logins and record changes will show up here as an audit trail."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentActivity.map((entry) => {
                const isLogin = entry.action === "LOGIN_SUCCESS";
                const isLogout = entry.action === "LOGOUT";
                const ActivityIcon = isLogout ? LogOut : LogIn;
                return (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          isLogin
                            ? "bg-emerald-50 text-emerald-600"
                            : isLogout
                              ? "bg-slate-100 text-slate-500"
                              : "bg-sky-50 text-sky-600"
                        )}
                      >
                        <ActivityIcon className="h-3.5 w-3.5" strokeWidth={2} />
                      </div>
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">{entry.user?.name ?? "System"}</span>{" "}
                        {entry.action.toLowerCase().replaceAll("_", " ")}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {entry.createdAt.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
