import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { PurchaseOrderStatus } from "./types";

export const PURCHASE_ORDER_PAGE_SIZE = 20;

export type PurchaseOrderSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type PurchaseOrderListParams = {
  companyId: string;
  q?: string;
  vendorId?: string;
  status?: PurchaseOrderStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  sort?: PurchaseOrderSortKey;
};

function sortToOrderBy(sort: PurchaseOrderSortKey | undefined): Prisma.PurchaseOrderOrderByWithRelationInput {
  switch (sort) {
    case "date_asc":
      return { poDate: "asc" };
    case "amount_desc":
      return { grandTotal: "desc" };
    case "amount_asc":
      return { grandTotal: "asc" };
    case "number_desc":
      return { poNumber: "desc" };
    case "date_desc":
    default:
      return { poDate: "desc" };
  }
}

export async function listPurchaseOrders(params: PurchaseOrderListParams) {
  const { companyId, q, vendorId, status, dateFrom, dateTo, page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.PurchaseOrderWhereInput = {
    companyId,
    ...(vendorId ? { vendorId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          poDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [{ poNumber: { contains: q } }, { vendor: { name: { contains: q } } }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * PURCHASE_ORDER_PAGE_SIZE,
      take: PURCHASE_ORDER_PAGE_SIZE,
      include: { vendor: true },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: PURCHASE_ORDER_PAGE_SIZE };
}

export async function getPurchaseOrderById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      vendor: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
      receipts: { orderBy: { receiptDate: "desc" }, include: { items: true, location: true } },
      vendorInvoices: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listPurchaseOrdersForParty(params: { companyId: string; vendorId: string }) {
  const { companyId, vendorId } = params;
  return prisma.purchaseOrder.findMany({
    where: { companyId, vendorId },
    orderBy: { poDate: "desc" },
  });
}

export async function getPurchaseOrderDashboard(companyId: string) {
  const [total, draft, sent, confirmed, partiallyReceived, pendingReceiptCount] = await Promise.all([
    prisma.purchaseOrder.count({ where: { companyId } }),
    prisma.purchaseOrder.count({ where: { companyId, status: "DRAFT" } }),
    prisma.purchaseOrder.count({ where: { companyId, status: "SENT" } }),
    prisma.purchaseOrder.count({ where: { companyId, status: "CONFIRMED" } }),
    prisma.purchaseOrder.count({ where: { companyId, status: "PARTIALLY_RECEIVED" } }),
    prisma.purchaseOrder.count({
      where: { companyId, status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] } },
    }),
  ]);

  return { total, draft, sent, confirmed, partiallyReceived, pendingReceiptCount };
}
