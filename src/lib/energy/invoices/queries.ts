import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { InvoiceStatus } from "./types";

export const INVOICE_PAGE_SIZE = 20;

export type InvoiceSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type InvoiceListParams = {
  companyId: string;
  q?: string;
  clientId?: string;
  status?: InvoiceStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  sort?: InvoiceSortKey;
};

function sortToOrderBy(sort: InvoiceSortKey | undefined): Prisma.InvoiceOrderByWithRelationInput {
  switch (sort) {
    case "date_asc":
      return { invoiceDate: "asc" };
    case "amount_desc":
      return { grandTotal: "desc" };
    case "amount_asc":
      return { grandTotal: "asc" };
    case "number_desc":
      return { invoiceNumber: "desc" };
    case "date_desc":
    default:
      return { invoiceDate: "desc" };
  }
}

export async function listInvoices(params: InvoiceListParams) {
  const { companyId, q, clientId, status, dateFrom, dateTo, page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.InvoiceWhereInput = {
    companyId,
    ...(clientId ? { clientId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          invoiceDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
      include: { client: true, salesperson: true },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: INVOICE_PAGE_SIZE };
}

export async function getInvoiceById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      client: true,
      salesperson: true,
      salesOrder: true,
      quotation: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
    },
  });
}

export async function listInvoicesForParty(params: { companyId: string; clientId: string }) {
  const { companyId, clientId } = params;
  return prisma.invoice.findMany({
    where: { companyId, clientId },
    orderBy: { invoiceDate: "desc" },
  });
}

export async function listInvoicesForSalesOrder(params: { companyId: string; salesOrderId: string }) {
  const { companyId, salesOrderId } = params;
  return prisma.invoice.findMany({
    where: { companyId, salesOrderId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoiceDashboard(companyId: string) {
  const now = new Date();

  const [total, draft, issued, cancelled, totalInvoicedAgg, outstandingAgg, overdueCount, recent] =
    await Promise.all([
      prisma.invoice.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId, status: "DRAFT" } }),
      prisma.invoice.count({ where: { companyId, status: "ISSUED" } }),
      prisma.invoice.count({ where: { companyId, status: "CANCELLED" } }),
      prisma.invoice.aggregate({
        where: { companyId, status: { not: "CANCELLED" } },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.aggregate({
        where: { companyId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        _sum: { outstandingAmount: true },
      }),
      prisma.invoice.count({
        where: { companyId, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
      }),
      prisma.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { client: true },
      }),
    ]);

  return {
    total,
    draft,
    issued,
    cancelled,
    totalInvoiced: totalInvoicedAgg._sum.grandTotal ?? 0,
    outstanding: outstandingAgg._sum.outstandingAmount ?? 0,
    overdueCount,
    recent,
  };
}
