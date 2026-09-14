import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { VendorInvoiceStatus } from "./types";

export const VENDOR_INVOICE_PAGE_SIZE = 20;

export type VendorInvoiceSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type VendorInvoiceListParams = {
  companyId: string;
  q?: string;
  vendorId?: string;
  status?: VendorInvoiceStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  sort?: VendorInvoiceSortKey;
};

function sortToOrderBy(sort: VendorInvoiceSortKey | undefined): Prisma.VendorInvoiceOrderByWithRelationInput {
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

export async function listVendorInvoices(params: VendorInvoiceListParams) {
  const { companyId, q, vendorId, status, dateFrom, dateTo, page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.VendorInvoiceWhereInput = {
    companyId,
    ...(vendorId ? { vendorId } : {}),
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
            { vendorInvoiceNumber: { contains: q } },
            { vendor: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vendorInvoice.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * VENDOR_INVOICE_PAGE_SIZE,
      take: VENDOR_INVOICE_PAGE_SIZE,
      include: { vendor: true },
    }),
    prisma.vendorInvoice.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: VENDOR_INVOICE_PAGE_SIZE };
}

export async function getVendorInvoiceById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.vendorInvoice.findFirst({
    where: { id, companyId },
    include: {
      vendor: true,
      purchaseOrder: true,
      purchaseReceipt: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
    },
  });
}

export async function listVendorInvoicesForParty(params: { companyId: string; vendorId: string }) {
  const { companyId, vendorId } = params;
  return prisma.vendorInvoice.findMany({
    where: { companyId, vendorId },
    orderBy: { invoiceDate: "desc" },
  });
}

export async function listVendorInvoicesForPurchaseOrder(params: { companyId: string; purchaseOrderId: string }) {
  const { companyId, purchaseOrderId } = params;
  return prisma.vendorInvoice.findMany({
    where: { companyId, purchaseOrderId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVendorInvoiceDashboard(companyId: string) {
  const now = new Date();

  const [total, draft, unpaid, cancelled, totalInvoicedAgg, outstandingAgg, overdueCount] = await Promise.all([
    prisma.vendorInvoice.count({ where: { companyId } }),
    prisma.vendorInvoice.count({ where: { companyId, status: "DRAFT" } }),
    prisma.vendorInvoice.count({ where: { companyId, status: "UNPAID" } }),
    prisma.vendorInvoice.count({ where: { companyId, status: "CANCELLED" } }),
    prisma.vendorInvoice.aggregate({
      where: { companyId, status: { not: "CANCELLED" } },
      _sum: { grandTotal: true },
    }),
    prisma.vendorInvoice.aggregate({
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      _sum: { outstandingAmount: true },
    }),
    prisma.vendorInvoice.count({
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    }),
  ]);

  return {
    total,
    draft,
    unpaid,
    cancelled,
    totalInvoiced: totalInvoicedAgg._sum.grandTotal ?? 0,
    outstanding: outstandingAgg._sum.outstandingAmount ?? 0,
    overdueCount,
  };
}
