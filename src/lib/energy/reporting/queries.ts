import "server-only";
import { prisma } from "@/lib/db/client";
import { round2 } from "@/lib/energy/shared/pricing";
import { COUNTED_EXPENSE_STATUSES } from "@/lib/energy/expenses/queries";

// Invoice/VendorInvoice statuses that represent a real, issued document —
// DRAFT was never sent and CANCELLED is void, so neither counts as Sales or
// Purchases anywhere in reporting (matches the existing Receivables/
// Payables convention from Phase 6/7).
const ISSUED_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;
const ISSUED_VENDOR_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;

export type DateRange = { from: Date; to: Date };

// ---- Company-wide summaries (all DB-aggregated, never loaded row-by-row) ----

export async function getSalesSummary(companyId: string, range: DateRange) {
  const agg = await prisma.invoice.aggregate({
    where: { companyId, status: { in: [...ISSUED_INVOICE_STATUSES] }, invoiceDate: { gte: range.from, lte: range.to } },
    _sum: { grandTotal: true },
    _count: true,
  });
  return { count: agg._count, total: agg._sum.grandTotal ?? 0 };
}

export async function getCollectionsSummary(companyId: string, range: DateRange) {
  const agg = await prisma.payment.aggregate({
    where: { companyId, status: { not: "CANCELLED" }, paymentDate: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
    _count: true,
  });
  return { count: agg._count, total: agg._sum.amount ?? 0 };
}

export async function getPurchaseSummary(companyId: string, range: DateRange) {
  const agg = await prisma.vendorInvoice.aggregate({
    where: { companyId, status: { in: [...ISSUED_VENDOR_INVOICE_STATUSES] }, invoiceDate: { gte: range.from, lte: range.to } },
    _sum: { grandTotal: true },
    _count: true,
  });
  return { count: agg._count, total: agg._sum.grandTotal ?? 0 };
}

export async function getVendorPaymentsSummary(companyId: string, range: DateRange) {
  const agg = await prisma.vendorPayment.aggregate({
    where: { companyId, status: { not: "CANCELLED" }, paymentDate: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
    _count: true,
  });
  return { count: agg._count, total: agg._sum.amount ?? 0 };
}

export async function getExpenseSummaryForRange(companyId: string, range: DateRange) {
  const agg = await prisma.expense.aggregate({
    where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, expenseDate: { gte: range.from, lte: range.to } },
    _sum: { grandTotal: true },
    _count: true,
  });
  return { count: agg._count, total: agg._sum.grandTotal ?? 0 };
}

// The one company-wide "Estimated Gross Profit" figure used on the
// Dashboard and the Purchase-vs-Sales report — Sales (invoiced) minus
// Purchases (vendor invoiced) minus Expenses. Deliberately NOT
// inventory-consumption-adjusted at this aggregate level (see
// project-profitability.ts for the finer, installed-quantity-based
// estimate) — labelled "Estimated" everywhere it's shown, never "Net
// Profit" (spec section 46).
export async function getEstimatedGrossResult(companyId: string, range: DateRange) {
  const [sales, purchases, expenses] = await Promise.all([
    getSalesSummary(companyId, range),
    getPurchaseSummary(companyId, range),
    getExpenseSummaryForRange(companyId, range),
  ]);
  const estimatedGrossResult = round2(sales.total - purchases.total - expenses.total);
  const estimatedGrossMargin = sales.total > 0 ? round2((estimatedGrossResult / sales.total) * 100) : 0;
  return { sales: sales.total, purchases: purchases.total, expenses: expenses.total, estimatedGrossResult, estimatedGrossMargin };
}

// One aggregate query per month, per metric — bounded by `months` (capped
// at 12) rather than scanning the full invoice/vendor-invoice/expense
// history, so this never loads more than a small, fixed number of summary
// rows (spec section 38/39).
export async function getMonthlyTrend(companyId: string, months = 6) {
  const now = new Date();
  const capped = Math.min(Math.max(months, 1), 12);
  const results: { month: string; sales: number; purchases: number; expenses: number; estimatedGrossResult: number }[] = [];

  for (let i = capped - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const { sales, purchases, expenses, estimatedGrossResult } = await getEstimatedGrossResult(companyId, { from, to });
    results.push({
      month: from.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      sales,
      purchases,
      expenses,
      estimatedGrossResult,
    });
  }
  return results;
}

export type SalesByCustomerRow = { clientId: string; clientName: string; invoiced: number; count: number };

export async function getSalesByCustomer(companyId: string, range: DateRange): Promise<SalesByCustomerRow[]> {
  const rows = await prisma.invoice.groupBy({
    by: ["clientId"],
    where: { companyId, status: { in: [...ISSUED_INVOICE_STATUSES] }, invoiceDate: { gte: range.from, lte: range.to } },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
    take: 50,
  });
  const clients = await prisma.party.findMany({ where: { id: { in: rows.map((r) => r.clientId) } }, select: { id: true, name: true } });
  const nameById = new Map(clients.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ clientId: r.clientId, clientName: nameById.get(r.clientId) ?? "Unknown", invoiced: r._sum.grandTotal ?? 0, count: r._count }));
}

export type VendorPurchaseRow = { vendorId: string; vendorName: string; purchased: number; count: number };

export async function getVendorPurchases(companyId: string, range: DateRange): Promise<VendorPurchaseRow[]> {
  const rows = await prisma.vendorInvoice.groupBy({
    by: ["vendorId"],
    where: { companyId, status: { in: [...ISSUED_VENDOR_INVOICE_STATUSES] }, invoiceDate: { gte: range.from, lte: range.to } },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
    take: 50,
  });
  const vendors = await prisma.party.findMany({ where: { id: { in: rows.map((r) => r.vendorId) } }, select: { id: true, name: true } });
  const nameById = new Map(vendors.map((v) => [v.id, v.name]));
  return rows.map((r) => ({ vendorId: r.vendorId, vendorName: nameById.get(r.vendorId) ?? "Unknown", purchased: r._sum.grandTotal ?? 0, count: r._count }));
}

export type ExpenseByCategoryRow = { categoryId: string; categoryName: string; total: number; count: number };

export async function getExpenseByCategoryReport(companyId: string, range: DateRange): Promise<ExpenseByCategoryRow[]> {
  const rows = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, expenseDate: { gte: range.from, lte: range.to } },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
  });
  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: rows.map((r) => r.categoryId) } } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ categoryId: r.categoryId, categoryName: nameById.get(r.categoryId) ?? "Unknown", total: r._sum.grandTotal ?? 0, count: r._count }));
}

export type ExpenseByProjectRow = { projectId: string; projectNumber: string; total: number; count: number };

export async function getExpenseByProjectReport(companyId: string, range: DateRange): Promise<ExpenseByProjectRow[]> {
  const rows = await prisma.expense.groupBy({
    by: ["projectId"],
    where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, expenseDate: { gte: range.from, lte: range.to }, projectId: { not: null } },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
  });
  const projectIds = rows.map((r) => r.projectId).filter((v): v is string => !!v);
  const projects = await prisma.energyProject.findMany({ where: { id: { in: projectIds } }, select: { id: true, projectNumber: true } });
  const numberById = new Map(projects.map((p) => [p.id, p.projectNumber]));
  return rows
    .filter((r) => r.projectId)
    .map((r) => ({ projectId: r.projectId as string, projectNumber: numberById.get(r.projectId as string) ?? "Unknown", total: r._sum.grandTotal ?? 0, count: r._count }));
}

export async function getServiceSummaryReport(companyId: string, range: DateRange) {
  const [total, resolved, byStatus] = await Promise.all([
    prisma.serviceRequest.count({ where: { companyId, requestDate: { gte: range.from, lte: range.to } } }),
    prisma.serviceRequest.count({ where: { companyId, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: range.from, lte: range.to } } }),
    prisma.serviceRequest.groupBy({ by: ["priority"], where: { companyId, requestDate: { gte: range.from, lte: range.to } }, _count: true }),
  ]);
  return { total, resolved, byPriority: byStatus.map((r) => ({ priority: r.priority, count: r._count })) };
}

export async function getMaintenanceActivityReport(companyId: string, range: DateRange) {
  const [scheduled, completed] = await Promise.all([
    prisma.maintenanceVisit.count({ where: { companyId, visitDate: { gte: range.from, lte: range.to } } }),
    prisma.maintenanceVisit.count({ where: { companyId, status: "COMPLETED", visitDate: { gte: range.from, lte: range.to } } }),
  ]);
  return { scheduled, completed };
}
