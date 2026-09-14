import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { round2 } from "@/lib/energy/shared/pricing";

export class PaymentRuleError extends Error {}

type TxClient = Prisma.TransactionClient | PrismaClient;

// The only two functions allowed to write Invoice.paidAmount/outstandingAmount
// or Payment.allocatedAmount/unallocatedAmount/status. Both always recompute
// from the PaymentAllocation rows (the source of truth) rather than
// incrementing/decrementing cached counters, so the numbers can never drift
// from reality — mirrors src/lib/energy/inventory/ledger.ts for stock.

export async function recomputeInvoicePaymentState(tx: TxClient, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    // Payments should never reach a Draft/Cancelled invoice (blocked at
    // allocation time) — nothing to recompute.
    return;
  }

  const agg = await tx.paymentAllocation.aggregate({
    where: { invoiceId, payment: { status: { not: "CANCELLED" } } },
    _sum: { amount: true },
  });
  const paidAmount = round2(agg._sum.amount ?? 0);
  const outstandingAmount = Math.max(0, round2(invoice.grandTotal - paidAmount));
  const status = paidAmount <= 0 ? "ISSUED" : outstandingAmount <= 0 ? "PAID" : "PARTIALLY_PAID";

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, outstandingAmount, status },
  });
}

export async function recomputePaymentAllocationState(tx: TxClient, paymentId: string): Promise<void> {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

  if (payment.status === "CANCELLED") {
    await tx.payment.update({
      where: { id: paymentId },
      data: { allocatedAmount: 0, unallocatedAmount: payment.amount },
    });
    return;
  }

  const agg = await tx.paymentAllocation.aggregate({
    where: { paymentId },
    _sum: { amount: true },
  });
  const allocatedAmount = round2(agg._sum.amount ?? 0);
  const unallocatedAmount = Math.max(0, round2(payment.amount - allocatedAmount));
  const status =
    allocatedAmount <= 0 ? "UNALLOCATED" : unallocatedAmount > 0 ? "PARTIALLY_ALLOCATED" : "ALLOCATED";

  await tx.payment.update({
    where: { id: paymentId },
    data: { allocatedAmount, unallocatedAmount, status },
  });
}

// Adds `amount` on top of whatever this payment already has allocated to
// this invoice (an "allocate more" call, not "set to"). Validates against
// freshly-read balances inside the caller's transaction so two concurrent
// allocations can never together push an invoice's outstanding negative or a
// payment's allocated total past its own amount.
export async function allocatePayment(
  tx: TxClient,
  input: { companyId: string; paymentId: string; invoiceId: string; amount: number }
): Promise<void> {
  const { companyId, paymentId, invoiceId, amount } = input;
  if (amount <= 0) {
    throw new PaymentRuleError("Allocation amount must be greater than zero.");
  }

  const payment = await tx.payment.findFirst({ where: { id: paymentId, companyId } });
  if (!payment) throw new PaymentRuleError("This payment no longer exists.");
  if (payment.status === "CANCELLED") {
    throw new PaymentRuleError("This payment has been cancelled and can no longer be allocated.");
  }

  const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) throw new PaymentRuleError("This invoice no longer exists.");
  if (invoice.clientId !== payment.clientId) {
    throw new PaymentRuleError("This payment and invoice belong to different clients.");
  }
  if (invoice.status !== "ISSUED" && invoice.status !== "PARTIALLY_PAID") {
    throw new PaymentRuleError("Only issued invoices with an outstanding balance can receive a payment.");
  }

  const paymentAgg = await tx.paymentAllocation.aggregate({
    where: { paymentId },
    _sum: { amount: true },
  });
  const currentUnallocated = round2(payment.amount - (paymentAgg._sum.amount ?? 0));
  if (amount > currentUnallocated + 0.005) {
    throw new PaymentRuleError(
      `Only ₹${currentUnallocated.toLocaleString("en-IN")} of this payment is unallocated - cannot allocate ₹${amount.toLocaleString("en-IN")}.`
    );
  }

  if (amount > invoice.outstandingAmount + 0.005) {
    throw new PaymentRuleError(
      `Only ₹${invoice.outstandingAmount.toLocaleString("en-IN")} is outstanding on this invoice - cannot allocate ₹${amount.toLocaleString("en-IN")}.`
    );
  }

  const existing = await tx.paymentAllocation.findUnique({
    where: { paymentId_invoiceId: { paymentId, invoiceId } },
  });
  const newAmount = round2((existing?.amount ?? 0) + amount);

  await tx.paymentAllocation.upsert({
    where: { paymentId_invoiceId: { paymentId, invoiceId } },
    create: { paymentId, invoiceId, amount: newAmount },
    update: { amount: newAmount },
  });

  await recomputeInvoicePaymentState(tx, invoiceId);
  await recomputePaymentAllocationState(tx, paymentId);
}
