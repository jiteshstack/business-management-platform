import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/energy/shared/pricing";
import { ageingBucketForDueDate, type AgeingBucket, type LedgerEntryType, type PaymentStatus } from "./types";

export const PAYMENT_PAGE_SIZE = 20;
export const RECEIVABLES_PAGE_SIZE = 20;

// Invoice statuses that represent a real, still-open receivable. DRAFT was
// never issued and CANCELLED is void — neither should ever appear in
// receivables, ageing, dashboards, or the customer ledger.
const OPEN_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID"] as const;
const RECEIVABLE_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;

export type PaymentSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type PaymentListParams = {
  companyId: string;
  q?: string;
  clientId?: string;
  mode?: string | "all";
  status?: PaymentStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  sort?: PaymentSortKey;
};

function sortToOrderBy(sort: PaymentSortKey | undefined): Prisma.PaymentOrderByWithRelationInput {
  switch (sort) {
    case "date_asc":
      return { paymentDate: "asc" };
    case "amount_desc":
      return { amount: "desc" };
    case "amount_asc":
      return { amount: "asc" };
    case "number_desc":
      return { paymentNumber: "desc" };
    case "date_desc":
    default:
      return { paymentDate: "desc" };
  }
}

export async function listPayments(params: PaymentListParams) {
  const { companyId, q, clientId, mode, status, dateFrom, dateTo, page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.PaymentWhereInput = {
    companyId,
    ...(clientId ? { clientId } : {}),
    ...(mode && mode !== "all" ? { mode } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          paymentDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { paymentNumber: { contains: q } },
            { referenceNumber: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * PAYMENT_PAGE_SIZE,
      take: PAYMENT_PAGE_SIZE,
      include: { client: true },
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: PAYMENT_PAGE_SIZE };
}

export async function getPaymentById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.payment.findFirst({
    where: { id, companyId },
    include: {
      client: true,
      allocations: { orderBy: { createdAt: "asc" }, include: { invoice: true } },
    },
  });
}

export async function listPaymentsForParty(params: { companyId: string; clientId: string }) {
  const { companyId, clientId } = params;
  return prisma.payment.findMany({
    where: { companyId, clientId },
    orderBy: { paymentDate: "desc" },
  });
}

export async function listAllocationsForInvoice(params: { companyId: string; invoiceId: string }) {
  const { companyId, invoiceId } = params;
  return prisma.paymentAllocation.findMany({
    where: { invoiceId, payment: { companyId } },
    orderBy: { createdAt: "asc" },
    include: { payment: true },
  });
}

// Candidate invoices a payment can be allocated against for a given client —
// anything still open with a non-zero outstanding balance.
export async function listAllocatableInvoicesForClient(params: { companyId: string; clientId: string }) {
  const { companyId, clientId } = params;
  return prisma.invoice.findMany({
    where: { companyId, clientId, status: { in: [...OPEN_INVOICE_STATUSES] }, outstandingAmount: { gt: 0 } },
    orderBy: { invoiceDate: "asc" },
  });
}

// ---- Receivables ----

export type ReceivablesListParams = {
  companyId: string;
  clientId?: string;
  bucket?: AgeingBucket | "all";
  page?: number;
};

export async function listReceivables(params: ReceivablesListParams) {
  const { companyId, clientId, bucket, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.InvoiceWhereInput = {
    companyId,
    status: { in: [...OPEN_INVOICE_STATUSES] },
    ...(clientId ? { clientId } : {}),
  };

  const all = await prisma.invoice.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { client: true },
  });

  const now = new Date();
  const withBucket = all.map((inv) => ({ ...inv, ageingBucket: ageingBucketForDueDate(inv.dueDate, now) }));
  const filtered = bucket && bucket !== "all" ? withBucket.filter((inv) => inv.ageingBucket === bucket) : withBucket;

  const total = filtered.length;
  const items = filtered.slice((safePage - 1) * RECEIVABLES_PAGE_SIZE, safePage * RECEIVABLES_PAGE_SIZE);

  return { items, total, page: safePage, pageSize: RECEIVABLES_PAGE_SIZE };
}

export async function getReceivablesSummary(companyId: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const baseWhere: Prisma.InvoiceWhereInput = { companyId, status: { in: [...OPEN_INVOICE_STATUSES] } };

  const [totalAgg, dueTodayAgg, dueThisWeekAgg, overdueAgg, partiallyPaidCount, unpaidCount] = await Promise.all([
    prisma.invoice.aggregate({ where: baseWhere, _sum: { outstandingAmount: true } }),
    prisma.invoice.aggregate({
      where: { ...baseWhere, dueDate: { gte: startOfToday, lt: endOfToday } },
      _sum: { outstandingAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { ...baseWhere, dueDate: { gte: startOfToday, lt: endOfWeek } },
      _sum: { outstandingAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { ...baseWhere, dueDate: { lt: startOfToday } },
      _sum: { outstandingAmount: true },
    }),
    prisma.invoice.count({ where: { ...baseWhere, paidAmount: { gt: 0 } } }),
    prisma.invoice.count({ where: { ...baseWhere, paidAmount: 0 } }),
  ]);

  return {
    totalReceivables: totalAgg._sum.outstandingAmount ?? 0,
    dueToday: dueTodayAgg._sum.outstandingAmount ?? 0,
    dueThisWeek: dueThisWeekAgg._sum.outstandingAmount ?? 0,
    overdue: overdueAgg._sum.outstandingAmount ?? 0,
    partiallyPaidCount,
    unpaidCount,
  };
}

export async function getAgeingBuckets(companyId: string, clientId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: { companyId, status: { in: [...OPEN_INVOICE_STATUSES] }, ...(clientId ? { clientId } : {}) },
    select: { outstandingAmount: true, dueDate: true },
  });

  const now = new Date();
  const buckets: Record<AgeingBucket, number> = {
    CURRENT: 0,
    DAYS_1_30: 0,
    DAYS_31_60: 0,
    DAYS_61_90: 0,
    DAYS_90_PLUS: 0,
  };
  for (const inv of invoices) {
    const bucket = ageingBucketForDueDate(inv.dueDate, now);
    buckets[bucket] = round2(buckets[bucket] + inv.outstandingAmount);
  }
  return buckets;
}

export async function getCustomerOutstandingSummary(companyId: string, clientId: string) {
  const buckets = await getAgeingBuckets(companyId, clientId);
  const totalOutstanding = round2(Object.values(buckets).reduce((sum, v) => sum + v, 0));
  return { totalOutstanding, buckets };
}

// Client 360 "Financial Summary" — total invoiced/paid/outstanding/overdue
// for one client, all derived from actual invoice rows (never a separate
// editable balance field).
export async function getClientFinancialSummary(companyId: string, clientId: string) {
  const [invoicedAgg, paidAgg, outstandingSummary] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, clientId, status: { in: [...RECEIVABLE_INVOICE_STATUSES] } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId, clientId, status: { in: [...RECEIVABLE_INVOICE_STATUSES] } },
      _sum: { paidAmount: true },
    }),
    getCustomerOutstandingSummary(companyId, clientId),
  ]);

  const overdue = round2(
    outstandingSummary.buckets.DAYS_1_30 +
      outstandingSummary.buckets.DAYS_31_60 +
      outstandingSummary.buckets.DAYS_61_90 +
      outstandingSummary.buckets.DAYS_90_PLUS
  );

  return {
    totalInvoiced: invoicedAgg._sum.grandTotal ?? 0,
    totalPaid: paidAgg._sum.paidAmount ?? 0,
    totalOutstanding: outstandingSummary.totalOutstanding,
    overdue,
  };
}

// ---- Customer Ledger ----

export type LedgerEntry = {
  date: Date;
  type: LedgerEntryType;
  reference: string;
  refId: string;
  debit: number;
  credit: number;
  balance: number;
};

export async function getCustomerLedger(params: { companyId: string; clientId: string }): Promise<LedgerEntry[]> {
  const { companyId, clientId } = params;

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, clientId, status: { in: [...RECEIVABLE_INVOICE_STATUSES] } },
      orderBy: { invoiceDate: "asc" },
    }),
    prisma.payment.findMany({
      where: { companyId, clientId },
      orderBy: { paymentDate: "asc" },
    }),
  ]);

  const entries: Omit<LedgerEntry, "balance">[] = [];
  for (const inv of invoices) {
    entries.push({
      date: inv.invoiceDate,
      type: "INVOICE",
      reference: inv.invoiceNumber,
      refId: inv.id,
      debit: inv.grandTotal,
      credit: 0,
    });
  }
  for (const p of payments) {
    entries.push({
      date: p.paymentDate,
      type: "PAYMENT",
      reference: p.paymentNumber,
      refId: p.id,
      debit: 0,
      credit: p.amount,
    });
    if (p.status === "CANCELLED") {
      entries.push({
        date: p.updatedAt,
        type: "PAYMENT_CANCELLED",
        reference: p.paymentNumber,
        refId: p.id,
        debit: p.amount,
        credit: 0,
      });
    }
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  return entries.map((entry) => {
    balance = round2(balance + entry.debit - entry.credit);
    return { ...entry, balance };
  });
}

// ---- Dashboard ----

export async function getFinanceDashboard(companyId: string) {
  const summary = await getReceivablesSummary(companyId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [paymentsThisMonthAgg, topOutstandingRaw] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId, status: { not: "CANCELLED" }, paymentDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.invoice.groupBy({
      by: ["clientId"],
      where: { companyId, status: { in: [...OPEN_INVOICE_STATUSES] } },
      _sum: { outstandingAmount: true },
      orderBy: { _sum: { outstandingAmount: "desc" } },
      take: 5,
    }),
  ]);

  const clients = await prisma.party.findMany({
    where: { id: { in: topOutstandingRaw.map((r) => r.clientId) } },
    select: { id: true, name: true },
  });
  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const topOutstandingCustomers = topOutstandingRaw.map((r) => ({
    clientId: r.clientId,
    clientName: clientNameById.get(r.clientId) ?? "Unknown",
    outstanding: r._sum.outstandingAmount ?? 0,
  }));

  return {
    ...summary,
    paymentsReceivedThisMonth: paymentsThisMonthAgg._sum.amount ?? 0,
    topOutstandingCustomers,
  };
}
