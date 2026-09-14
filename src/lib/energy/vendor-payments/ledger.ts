import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { round2 } from "@/lib/energy/shared/pricing";

export class VendorPaymentRuleError extends Error {}

type TxClient = Prisma.TransactionClient | PrismaClient;

// Mirrors src/lib/energy/payments/ledger.ts exactly, on the vendor side.
// The only two functions allowed to write VendorInvoice.paidAmount/
// outstandingAmount or VendorPayment.allocatedAmount/unallocatedAmount/
// status. Both always recompute from VendorPaymentAllocation rows (the
// source of truth) rather than incrementing/decrementing cached counters.

export async function recomputeVendorInvoicePaymentState(tx: TxClient, vendorInvoiceId: string): Promise<void> {
  const invoice = await tx.vendorInvoice.findUniqueOrThrow({ where: { id: vendorInvoiceId } });
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    return;
  }

  const agg = await tx.vendorPaymentAllocation.aggregate({
    where: { vendorInvoiceId, vendorPayment: { status: { not: "CANCELLED" } } },
    _sum: { amount: true },
  });
  const paidAmount = round2(agg._sum.amount ?? 0);
  const outstandingAmount = Math.max(0, round2(invoice.grandTotal - paidAmount));
  const status = paidAmount <= 0 ? "UNPAID" : outstandingAmount <= 0 ? "PAID" : "PARTIALLY_PAID";

  await tx.vendorInvoice.update({
    where: { id: vendorInvoiceId },
    data: { paidAmount, outstandingAmount, status },
  });
}

export async function recomputeVendorPaymentAllocationState(tx: TxClient, vendorPaymentId: string): Promise<void> {
  const payment = await tx.vendorPayment.findUniqueOrThrow({ where: { id: vendorPaymentId } });

  if (payment.status === "CANCELLED") {
    await tx.vendorPayment.update({
      where: { id: vendorPaymentId },
      data: { allocatedAmount: 0, unallocatedAmount: payment.amount },
    });
    return;
  }

  const agg = await tx.vendorPaymentAllocation.aggregate({
    where: { vendorPaymentId },
    _sum: { amount: true },
  });
  const allocatedAmount = round2(agg._sum.amount ?? 0);
  const unallocatedAmount = Math.max(0, round2(payment.amount - allocatedAmount));
  const status =
    allocatedAmount <= 0 ? "UNALLOCATED" : unallocatedAmount > 0 ? "PARTIALLY_ALLOCATED" : "ALLOCATED";

  await tx.vendorPayment.update({
    where: { id: vendorPaymentId },
    data: { allocatedAmount, unallocatedAmount, status },
  });
}

// Adds `amount` on top of whatever this payment already has allocated to
// this invoice. Validates against freshly-read balances inside the caller's
// transaction so two concurrent allocations can never together push a
// vendor invoice's outstanding negative or a payment's allocated total past
// its own amount.
export async function allocateVendorPayment(
  tx: TxClient,
  input: { companyId: string; vendorPaymentId: string; vendorInvoiceId: string; amount: number }
): Promise<void> {
  const { companyId, vendorPaymentId, vendorInvoiceId, amount } = input;
  if (amount <= 0) {
    throw new VendorPaymentRuleError("Allocation amount must be greater than zero.");
  }

  const payment = await tx.vendorPayment.findFirst({ where: { id: vendorPaymentId, companyId } });
  if (!payment) throw new VendorPaymentRuleError("This payment no longer exists.");
  if (payment.status === "CANCELLED") {
    throw new VendorPaymentRuleError("This payment has been cancelled and can no longer be allocated.");
  }

  const invoice = await tx.vendorInvoice.findFirst({ where: { id: vendorInvoiceId, companyId } });
  if (!invoice) throw new VendorPaymentRuleError("This vendor invoice no longer exists.");
  if (invoice.vendorId !== payment.vendorId) {
    throw new VendorPaymentRuleError("This payment and invoice belong to different vendors.");
  }
  if (invoice.status !== "UNPAID" && invoice.status !== "PARTIALLY_PAID") {
    throw new VendorPaymentRuleError("Only unpaid vendor invoices with an outstanding balance can receive a payment.");
  }

  const paymentAgg = await tx.vendorPaymentAllocation.aggregate({
    where: { vendorPaymentId },
    _sum: { amount: true },
  });
  const currentUnallocated = round2(payment.amount - (paymentAgg._sum.amount ?? 0));
  if (amount > currentUnallocated + 0.005) {
    throw new VendorPaymentRuleError(
      `Only ₹${currentUnallocated.toLocaleString("en-IN")} of this payment is unallocated - cannot allocate ₹${amount.toLocaleString("en-IN")}.`
    );
  }

  if (amount > invoice.outstandingAmount + 0.005) {
    throw new VendorPaymentRuleError(
      `Only ₹${invoice.outstandingAmount.toLocaleString("en-IN")} is outstanding on this invoice - cannot allocate ₹${amount.toLocaleString("en-IN")}.`
    );
  }

  const existing = await tx.vendorPaymentAllocation.findUnique({
    where: { vendorPaymentId_vendorInvoiceId: { vendorPaymentId, vendorInvoiceId } },
  });
  const newAmount = round2((existing?.amount ?? 0) + amount);

  await tx.vendorPaymentAllocation.upsert({
    where: { vendorPaymentId_vendorInvoiceId: { vendorPaymentId, vendorInvoiceId } },
    create: { vendorPaymentId, vendorInvoiceId, amount: newAmount },
    update: { amount: newAmount },
  });

  await recomputeVendorInvoicePaymentState(tx, vendorInvoiceId);
  await recomputeVendorPaymentAllocationState(tx, vendorPaymentId);
}
