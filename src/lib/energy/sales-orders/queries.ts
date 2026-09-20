import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { SalesOrderStatus } from "./types";

export const SALES_ORDER_PAGE_SIZE = 20;

export type SalesOrderSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type SalesOrderListParams = {
  companyId: string;
  q?: string;
  clientId?: string;
  status?: SalesOrderStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  sort?: SalesOrderSortKey;
};

function sortToOrderBy(sort: SalesOrderSortKey | undefined): Prisma.SalesOrderOrderByWithRelationInput {
  switch (sort) {
    case "date_asc":
      return { orderDate: "asc" };
    case "amount_desc":
      return { grandTotal: "desc" };
    case "amount_asc":
      return { grandTotal: "asc" };
    case "number_desc":
      return { soNumber: "desc" };
    case "date_desc":
    default:
      return { orderDate: "desc" };
  }
}

export async function listSalesOrders(params: SalesOrderListParams) {
  const { companyId, q, clientId, status, dateFrom, dateTo, page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.SalesOrderWhereInput = {
    companyId,
    ...(clientId ? { clientId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          orderDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { soNumber: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * SALES_ORDER_PAGE_SIZE,
      take: SALES_ORDER_PAGE_SIZE,
      include: { client: true },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: SALES_ORDER_PAGE_SIZE };
}

export async function getSalesOrderById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.salesOrder.findFirst({
    where: { id, companyId },
    include: {
      client: true,
      siteAddress: true,
      quotation: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listSalesOrdersForParty(params: { companyId: string; clientId: string }) {
  const { companyId, clientId } = params;
  return prisma.salesOrder.findMany({
    where: { companyId, clientId },
    orderBy: { orderDate: "desc" },
  });
}

export async function listSalesOrdersForQuotation(params: { companyId: string; quotationId: string }) {
  const { companyId, quotationId } = params;
  return prisma.salesOrder.findMany({
    where: { companyId, quotationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSalesOrderDashboard(companyId: string) {
  const [total, draft, confirmed, partiallyFulfilled, completed, recent] = await Promise.all([
    prisma.salesOrder.count({ where: { companyId } }),
    prisma.salesOrder.count({ where: { companyId, status: "DRAFT" } }),
    prisma.salesOrder.count({ where: { companyId, status: "CONFIRMED" } }),
    prisma.salesOrder.count({ where: { companyId, status: "PARTIALLY_FULFILLED" } }),
    prisma.salesOrder.count({ where: { companyId, status: "COMPLETED" } }),
    prisma.salesOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: true },
    }),
  ]);

  return { total, draft, confirmed, partiallyFulfilled, completed, recent };
}
