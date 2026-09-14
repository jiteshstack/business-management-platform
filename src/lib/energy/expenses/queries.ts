import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ExpenseStatus, ExpensePaymentStatus } from "./types";

export const EXPENSE_PAGE_SIZE = 20;

// Expense statuses that represent a real, counted operating cost —
// deliberately excludes DRAFT (not yet confirmed) and CANCELLED (void).
// Reused by every reporting/dashboard aggregation so "Expenses" always
// means the same thing everywhere it's shown.
export const COUNTED_EXPENSE_STATUSES = ["APPROVED", "PAID"] as const;

export function listExpenseCategories(companyId: string, activeOnly = false) {
  return prisma.expenseCategory.findMany({
    where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
  });
}

export type ExpenseListParams = {
  companyId: string;
  q?: string;
  categoryId?: string;
  projectId?: string;
  status?: ExpenseStatus | "all";
  paymentStatus?: ExpensePaymentStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

function paymentStatusWhere(paymentStatus?: ExpensePaymentStatus | "all"): Prisma.ExpenseWhereInput {
  switch (paymentStatus) {
    case "UNPAID":
      return { paidAmount: 0 };
    case "PARTIALLY_PAID":
      return { paidAmount: { gt: 0 }, status: { not: "PAID" } };
    case "PAID":
      return { status: "PAID" };
    default:
      return {};
  }
}

export async function listExpenses(params: ExpenseListParams) {
  const { companyId, q, categoryId, projectId, status, paymentStatus, dateFrom, dateTo, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.ExpenseWhereInput = {
    companyId,
    ...(categoryId ? { categoryId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...paymentStatusWhere(paymentStatus),
    ...(dateFrom || dateTo
      ? {
          expenseDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { expenseNumber: { contains: q } },
            { description: { contains: q } },
            { referenceNumber: { contains: q } },
            { vendor: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      skip: (safePage - 1) * EXPENSE_PAGE_SIZE,
      take: EXPENSE_PAGE_SIZE,
      include: { category: true, vendor: true, project: true, site: true },
    }),
    prisma.expense.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: EXPENSE_PAGE_SIZE };
}

export async function getExpenseDocuments(params: { companyId: string; expenseId: string }) {
  const { companyId, expenseId } = params;
  return prisma.document.findMany({
    where: { companyId, entityType: "EXPENSE", entityId: expenseId },
    orderBy: { createdAt: "desc" },
    include: { uploader: true },
  });
}

export async function getExpenseById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.expense.findFirst({
    where: { id, companyId },
    include: { category: true, vendor: true, project: true, site: true },
  });
}

export async function listExpensesForProject(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.expense.findMany({
    where: { companyId, projectId, status: { not: "CANCELLED" } },
    orderBy: { expenseDate: "desc" },
    include: { category: true },
  });
}

export async function listExpensesForSite(params: { companyId: string; siteId: string }) {
  const { companyId, siteId } = params;
  return prisma.expense.findMany({
    where: { companyId, siteId, status: { not: "CANCELLED" } },
    orderBy: { expenseDate: "desc" },
    include: { category: true },
  });
}

export async function listExpensesForVendor(params: { companyId: string; vendorId: string }) {
  const { companyId, vendorId } = params;
  return prisma.expense.findMany({ where: { companyId, vendorId }, orderBy: { expenseDate: "desc" }, include: { category: true } });
}

// Sum of counted (APPROVED/PAID) expense grandTotal for a project — the
// single source of "Project Expenses", never a manually entered total
// (spec section 9).
export async function getProjectExpenseTotal(params: { companyId: string; projectId: string }): Promise<number> {
  const { companyId, projectId } = params;
  const agg = await prisma.expense.aggregate({
    where: { companyId, projectId, status: { in: [...COUNTED_EXPENSE_STATUSES] } },
    _sum: { grandTotal: true },
  });
  return agg._sum.grandTotal ?? 0;
}

export async function getExpenseDashboardStats(companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [thisMonth, thisYear, unpaidCount, byCategoryRaw] = await Promise.all([
    prisma.expense.aggregate({
      where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, expenseDate: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, expenseDate: { gte: yearStart } },
      _sum: { grandTotal: true },
    }),
    prisma.expense.count({ where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, paidAmount: 0 } }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { companyId, status: { in: [...COUNTED_EXPENSE_STATUSES] }, expenseDate: { gte: monthStart } },
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: "desc" } },
      take: 5,
    }),
  ]);

  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: byCategoryRaw.map((r) => r.categoryId) } } });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const topCategories = byCategoryRaw.map((r) => ({
    categoryId: r.categoryId,
    categoryName: categoryNameById.get(r.categoryId) ?? "Unknown",
    total: r._sum.grandTotal ?? 0,
  }));

  return {
    thisMonth: thisMonth._sum.grandTotal ?? 0,
    thisYear: thisYear._sum.grandTotal ?? 0,
    unpaidCount,
    topCategories,
  };
}
