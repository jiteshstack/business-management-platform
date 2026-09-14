import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/energy/shared/pricing";
import { ageingBucketForDueDate, type AgeingBucket, type VendorLedgerEntryType, type VendorPaymentStatus } from "./types";

export const VENDOR_PAYMENT_PAGE_SIZE = 20;
export const PAYABLES_PAGE_SIZE = 20;

// Vendor invoice statuses that represent a real, still-open payable. DRAFT
// was never finalized and CANCELLED is void — neither should ever appear in
// payables, ageing, dashboards, or the vendor ledger.
const OPEN_VENDOR_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID"] as const;
const PAYABLE_VENDOR_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;

export type VendorPaymentSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "number_desc";

export type VendorPaymentListParams = {
  companyId: string;
  q?: string;
  vendorId?: string;
  mode?: string | "all";
  status?: VendorPaymentStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  sort?: VendorPaymentSortKey;
};

function sortToOrderBy(sort: VendorPaymentSortKey | undefined): Prisma.VendorPaymentOrderByWithRelationInput {
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

export async function listVendorPayments(params: VendorPaymentListParams) {
  const { companyId, q, vendorId, mode, status, dateFrom, dateTo, page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.VendorPaymentWhereInput = {
    companyId,
    ...(vendorId ? { vendorId } : {}),
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
            { vendor: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vendorPayment.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * VENDOR_PAYMENT_PAGE_SIZE,
      take: VENDOR_PAYMENT_PAGE_SIZE,
      include: { vendor: true },
    }),
    prisma.vendorPayment.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: VENDOR_PAYMENT_PAGE_SIZE };
}

export async function getVendorPaymentById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.vendorPayment.findFirst({
    where: { id, companyId },
    include: {
      vendor: true,
      allocations: { orderBy: { createdAt: "asc" }, include: { vendorInvoice: true } },
    },
  });
}

export async function listVendorPaymentsForParty(params: { companyId: string; vendorId: string }) {
  const { companyId, vendorId } = params;
  return prisma.vendorPayment.findMany({
    where: { companyId, vendorId },
    orderBy: { paymentDate: "desc" },
  });
}

export async function listAllocationsForVendorInvoice(params: { companyId: string; vendorInvoiceId: string }) {
  const { companyId, vendorInvoiceId } = params;
  return prisma.vendorPaymentAllocation.findMany({
    where: { vendorInvoiceId, vendorPayment: { companyId } },
    orderBy: { createdAt: "asc" },
    include: { vendorPayment: true },
  });
}

// Candidate invoices a payment can be allocated against for a given vendor —
// anything still open with a non-zero outstanding balance.
export async function listAllocatableVendorInvoicesForVendor(params: { companyId: string; vendorId: string }) {
  const { companyId, vendorId } = params;
  return prisma.vendorInvoice.findMany({
    where: { companyId, vendorId, status: { in: [...OPEN_VENDOR_INVOICE_STATUSES] }, outstandingAmount: { gt: 0 } },
    orderBy: { invoiceDate: "asc" },
  });
}

// ---- Vendor Payables ----

export type PayablesListParams = {
  companyId: string;
  vendorId?: string;
  bucket?: AgeingBucket | "all";
  page?: number;
};

export async function listPayables(params: PayablesListParams) {
  const { companyId, vendorId, bucket, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.VendorInvoiceWhereInput = {
    companyId,
    status: { in: [...OPEN_VENDOR_INVOICE_STATUSES] },
    ...(vendorId ? { vendorId } : {}),
  };

  const all = await prisma.vendorInvoice.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { vendor: true },
  });

  const now = new Date();
  const withBucket = all.map((inv) => ({ ...inv, ageingBucket: ageingBucketForDueDate(inv.dueDate, now) }));
  const filtered = bucket && bucket !== "all" ? withBucket.filter((inv) => inv.ageingBucket === bucket) : withBucket;

  const total = filtered.length;
  const items = filtered.slice((safePage - 1) * PAYABLES_PAGE_SIZE, safePage * PAYABLES_PAGE_SIZE);

  return { items, total, page: safePage, pageSize: PAYABLES_PAGE_SIZE };
}

export async function getPayablesSummary(companyId: string) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const baseWhere: Prisma.VendorInvoiceWhereInput = { companyId, status: { in: [...OPEN_VENDOR_INVOICE_STATUSES] } };

  const [totalAgg, dueTodayAgg, dueThisWeekAgg, overdueAgg, partiallyPaidCount, unpaidCount] = await Promise.all([
    prisma.vendorInvoice.aggregate({ where: baseWhere, _sum: { outstandingAmount: true } }),
    prisma.vendorInvoice.aggregate({
      where: { ...baseWhere, dueDate: { gte: startOfToday, lt: endOfToday } },
      _sum: { outstandingAmount: true },
    }),
    prisma.vendorInvoice.aggregate({
      where: { ...baseWhere, dueDate: { gte: startOfToday, lt: endOfWeek } },
      _sum: { outstandingAmount: true },
    }),
    prisma.vendorInvoice.aggregate({
      where: { ...baseWhere, dueDate: { lt: startOfToday } },
      _sum: { outstandingAmount: true },
    }),
    prisma.vendorInvoice.count({ where: { ...baseWhere, paidAmount: { gt: 0 } } }),
    prisma.vendorInvoice.count({ where: { ...baseWhere, paidAmount: 0 } }),
  ]);

  return {
    totalPayable: totalAgg._sum.outstandingAmount ?? 0,
    dueToday: dueTodayAgg._sum.outstandingAmount ?? 0,
    dueThisWeek: dueThisWeekAgg._sum.outstandingAmount ?? 0,
    overdue: overdueAgg._sum.outstandingAmount ?? 0,
    partiallyPaidCount,
    unpaidCount,
  };
}

export async function getVendorAgeingBuckets(companyId: string, vendorId?: string) {
  const invoices = await prisma.vendorInvoice.findMany({
    where: { companyId, status: { in: [...OPEN_VENDOR_INVOICE_STATUSES] }, ...(vendorId ? { vendorId } : {}) },
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

export async function getVendorOutstandingSummary(companyId: string, vendorId: string) {
  const buckets = await getVendorAgeingBuckets(companyId, vendorId);
  const totalOutstanding = round2(Object.values(buckets).reduce((sum, v) => sum + v, 0));
  return { totalOutstanding, buckets };
}

// Vendor 360 "Vendor Summary" — total purchases/invoiced/paid/outstanding/
// overdue/advance for one vendor, all derived from actual transaction rows.
export async function getVendorFinancialSummary(companyId: string, vendorId: string) {
  const [purchasedAgg, invoicedAgg, paidAgg, outstandingSummary, advanceAgg] = await Promise.all([
    prisma.purchaseOrder.aggregate({
      where: { companyId, vendorId, status: { not: "CANCELLED" } },
      _sum: { grandTotal: true },
    }),
    prisma.vendorInvoice.aggregate({
      where: { companyId, vendorId, status: { in: [...PAYABLE_VENDOR_INVOICE_STATUSES] } },
      _sum: { grandTotal: true },
    }),
    prisma.vendorInvoice.aggregate({
      where: { companyId, vendorId, status: { in: [...PAYABLE_VENDOR_INVOICE_STATUSES] } },
      _sum: { paidAmount: true },
    }),
    getVendorOutstandingSummary(companyId, vendorId),
    prisma.vendorPayment.aggregate({
      where: { companyId, vendorId, status: { not: "CANCELLED" } },
      _sum: { unallocatedAmount: true },
    }),
  ]);

  const overdue = round2(
    outstandingSummary.buckets.DAYS_1_30 +
      outstandingSummary.buckets.DAYS_31_60 +
      outstandingSummary.buckets.DAYS_61_90 +
      outstandingSummary.buckets.DAYS_90_PLUS
  );

  return {
    totalPurchases: purchasedAgg._sum.grandTotal ?? 0,
    totalInvoiced: invoicedAgg._sum.grandTotal ?? 0,
    totalPaid: paidAgg._sum.paidAmount ?? 0,
    totalOutstanding: outstandingSummary.totalOutstanding,
    overdue,
    advanceBalance: advanceAgg._sum.unallocatedAmount ?? 0,
  };
}

// ---- Vendor Ledger ----

export type VendorLedgerEntry = {
  date: Date;
  type: VendorLedgerEntryType;
  reference: string;
  refId: string;
  debit: number;
  credit: number;
  balance: number;
};

// Vendor Invoice = Credit (increases the liability we owe); Vendor Payment =
// Debit (reduces it) — the opposite convention from the customer ledger,
// where Invoice = Debit and Payment = Credit, matching how each side's
// balance represents what's owed *to* vs *by* the company.
export async function getVendorLedger(params: { companyId: string; vendorId: string }): Promise<VendorLedgerEntry[]> {
  const { companyId, vendorId } = params;

  const [invoices, payments] = await Promise.all([
    prisma.vendorInvoice.findMany({
      where: { companyId, vendorId, status: { in: [...PAYABLE_VENDOR_INVOICE_STATUSES] } },
      orderBy: { invoiceDate: "asc" },
    }),
    prisma.vendorPayment.findMany({
      where: { companyId, vendorId },
      orderBy: { paymentDate: "asc" },
    }),
  ]);

  const entries: Omit<VendorLedgerEntry, "balance">[] = [];
  for (const inv of invoices) {
    entries.push({
      date: inv.invoiceDate,
      type: "VENDOR_INVOICE",
      reference: inv.invoiceNumber,
      refId: inv.id,
      debit: 0,
      credit: inv.grandTotal,
    });
  }
  for (const p of payments) {
    entries.push({
      date: p.paymentDate,
      type: "VENDOR_PAYMENT",
      reference: p.paymentNumber,
      refId: p.id,
      debit: p.amount,
      credit: 0,
    });
    if (p.status === "CANCELLED") {
      entries.push({
        date: p.updatedAt,
        type: "VENDOR_PAYMENT_CANCELLED",
        reference: p.paymentNumber,
        refId: p.id,
        debit: 0,
        credit: p.amount,
      });
    }
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  return entries.map((entry) => {
    balance = round2(balance + entry.credit - entry.debit);
    return { ...entry, balance };
  });
}

// ---- Dashboard ----

export async function getVendorFinanceDashboard(companyId: string) {
  const summary = await getPayablesSummary(companyId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [paymentsThisMonthAgg, upcomingAgg, topPayableRaw] = await Promise.all([
    prisma.vendorPayment.aggregate({
      where: { companyId, status: { not: "CANCELLED" }, paymentDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.vendorInvoice.aggregate({
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] }, dueDate: { gte: now, lte: weekEnd } },
      _sum: { outstandingAmount: true },
    }),
    prisma.vendorInvoice.groupBy({
      by: ["vendorId"],
      where: { companyId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      _sum: { outstandingAmount: true },
      orderBy: { _sum: { outstandingAmount: "desc" } },
      take: 5,
    }),
  ]);

  const vendors = await prisma.party.findMany({
    where: { id: { in: topPayableRaw.map((r) => r.vendorId) } },
    select: { id: true, name: true },
  });
  const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]));

  const topPayableVendors = topPayableRaw.map((r) => ({
    vendorId: r.vendorId,
    vendorName: vendorNameById.get(r.vendorId) ?? "Unknown",
    outstanding: r._sum.outstandingAmount ?? 0,
  }));

  return {
    ...summary,
    vendorPaymentsThisMonth: paymentsThisMonthAgg._sum.amount ?? 0,
    upcomingPayments: upcomingAgg._sum.outstandingAmount ?? 0,
    topPayableVendors,
  };
}
