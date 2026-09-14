import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { QuotationStatus, QuotationType } from "./types";

export const QUOTATION_PAGE_SIZE = 20;

export type QuotationSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type QuotationListParams = {
  companyId: string;
  q?: string;
  clientId?: string;
  type?: QuotationType | "all";
  status?: QuotationStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  sort?: QuotationSortKey;
};

function sortToOrderBy(sort: QuotationSortKey | undefined): Prisma.QuotationOrderByWithRelationInput {
  switch (sort) {
    case "date_asc":
      return { quotationDate: "asc" };
    case "amount_desc":
      return { grandTotal: "desc" };
    case "amount_asc":
      return { grandTotal: "asc" };
    case "number_desc":
      return { quotationNumber: "desc" };
    case "date_desc":
    default:
      return { quotationDate: "desc" };
  }
}

export async function listQuotations(params: QuotationListParams) {
  const {
    companyId,
    q,
    clientId,
    type,
    status,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    page = 1,
    sort,
  } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.QuotationWhereInput = {
    companyId,
    isLatestRevision: true,
    ...(clientId ? { clientId } : {}),
    ...(type && type !== "all" ? { type } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          quotationDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(minAmount != null || maxAmount != null
      ? {
          grandTotal: {
            ...(minAmount != null ? { gte: minAmount } : {}),
            ...(maxAmount != null ? { lte: maxAmount } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { quotationNumber: { contains: q } },
            { subject: { contains: q } },
            { reference: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * QUOTATION_PAGE_SIZE,
      take: QUOTATION_PAGE_SIZE,
      include: { client: true, salesperson: true },
    }),
    prisma.quotation.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: QUOTATION_PAGE_SIZE };
}

export async function getQuotationById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.quotation.findFirst({
    where: { id, companyId },
    include: {
      client: true,
      siteAddress: true,
      salesperson: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
    },
  });
}

export async function getQuotationRevisions(params: { companyId: string; quotation: { id: string; rootQuotationId: string | null } }) {
  const { companyId, quotation } = params;
  const rootId = quotation.rootQuotationId ?? quotation.id;
  return prisma.quotation.findMany({
    where: { companyId, OR: [{ id: rootId }, { rootQuotationId: rootId }] },
    orderBy: { revisionNumber: "asc" },
  });
}

export async function listQuotationsForParty(params: { companyId: string; clientId: string }) {
  const { companyId, clientId } = params;
  return prisma.quotation.findMany({
    where: { companyId, clientId, isLatestRevision: true },
    orderBy: { quotationDate: "desc" },
  });
}

export async function getQuotationDashboard(companyId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [total, draft, sent, approved, expiringSoon, valueAgg] = await Promise.all([
    prisma.quotation.count({ where: { companyId, isLatestRevision: true } }),
    prisma.quotation.count({ where: { companyId, isLatestRevision: true, status: "DRAFT" } }),
    prisma.quotation.count({ where: { companyId, isLatestRevision: true, status: "SENT" } }),
    prisma.quotation.count({ where: { companyId, isLatestRevision: true, status: "APPROVED" } }),
    prisma.quotation.count({
      where: {
        companyId,
        isLatestRevision: true,
        status: { in: ["SENT", "NEGOTIATION"] },
        validUntil: { gte: now, lte: soon },
      },
    }),
    prisma.quotation.aggregate({
      where: { companyId, isLatestRevision: true, status: { notIn: ["REJECTED", "CANCELLED"] } },
      _sum: { grandTotal: true },
    }),
  ]);

  return {
    total,
    draft,
    sent,
    approved,
    expiringSoon,
    totalValue: valueAgg._sum.grandTotal ?? 0,
  };
}
