"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManagePayments, canCancelPayments } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { paymentFormSchema, allocateFormSchema } from "./schema";
import { allocatePayment, recomputeInvoicePaymentState, recomputePaymentAllocationState, PaymentRuleError } from "./ledger";

const PAYMENTS_PATH = "/sales/payments-received";

function requirePaymentManager(role: Parameters<typeof canManagePayments>[0]) {
  if (!canManagePayments(role)) {
    throw new Error("You don't have permission to manage payments.");
  }
}

function readPaymentForm(formData: FormData) {
  return {
    clientId: str(formData, "clientId"),
    amount: str(formData, "amount"),
    paymentDate: str(formData, "paymentDate"),
    mode: str(formData, "mode"),
    referenceNumber: str(formData, "referenceNumber"),
    chequeNumber: str(formData, "chequeNumber"),
    chequeDate: str(formData, "chequeDate"),
    bankName: str(formData, "bankName"),
    notes: str(formData, "notes"),
    invoiceId: str(formData, "invoiceId"),
  };
}

export async function createPaymentAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requirePaymentManager(session.role);

  const parsed = paymentFormSchema.safeParse(readPaymentForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const client = await prisma.party.findFirst({
    where: { id: values.clientId, companyId: session.companyId, type: "CLIENT" },
  });
  if (!client) {
    return { error: "Select a valid client.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  let invoice: { id: string; clientId: string } | null = null;
  if (values.invoiceId) {
    invoice = await prisma.invoice.findFirst({
      where: { id: values.invoiceId, companyId: session.companyId, clientId: client.id },
    });
    if (!invoice) {
      return {
        error: "Selected invoice could not be found for this client.",
        values: rawValues(formData),
        attempt: nextAttempt(_prevState),
      };
    }
  }

  let paymentId: string;
  try {
    paymentId = await prisma.$transaction(async (tx) => {
      const paymentNumber = await nextDocumentNumber(tx, {
        companyId: session.companyId,
        series: "EPAY",
        prefix: "EPAY",
      });

      const payment = await tx.payment.create({
        data: {
          companyId: session.companyId,
          paymentNumber,
          status: "UNALLOCATED",
          clientId: client.id,
          amount: values.amount,
          // Correct from the start for the (common) no-allocation case;
          // allocatePayment() below recomputes it from real allocation rows
          // when an initial allocation is requested, so this can never be
          // stale either way.
          unallocatedAmount: values.amount,
          paymentDate: new Date(values.paymentDate),
          mode: values.mode,
          referenceNumber: values.referenceNumber,
          chequeNumber: values.chequeNumber,
          chequeDate: values.chequeDate ? new Date(values.chequeDate) : null,
          bankName: values.bankName,
          notes: values.notes,
          createdBy: session.userId,
        },
      });

      if (invoice) {
        await allocatePayment(tx, {
          companyId: session.companyId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: values.amount,
        });
      }

      return payment.id;
    });
  } catch (error) {
    if (error instanceof PaymentRuleError) {
      return { error: error.message, values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PAYMENT_CREATED",
    entityType: "Payment",
    entityId: paymentId,
    after: { amount: values.amount, invoiceId: invoice?.id ?? null },
  });

  revalidatePath(PAYMENTS_PATH);
  if (invoice) revalidatePath(`/sales/invoices/${invoice.id}`);
  redirect(`${PAYMENTS_PATH}/${paymentId}`);
}

export async function allocatePaymentAction(
  paymentId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requirePaymentManager(session.role);

  const parsed = allocateFormSchema.safeParse({
    invoiceId: str(formData, "invoiceId"),
    amount: str(formData, "amount"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      attempt: nextAttempt(_prevState),
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await allocatePayment(tx, {
        companyId: session.companyId,
        paymentId,
        invoiceId: parsed.data.invoiceId,
        amount: parsed.data.amount,
      });
    });
  } catch (error) {
    if (error instanceof PaymentRuleError) {
      return { error: error.message, attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PAYMENT_ALLOCATED",
    entityType: "Payment",
    entityId: paymentId,
    after: { invoiceId: parsed.data.invoiceId, amount: parsed.data.amount },
  });

  revalidatePath(`${PAYMENTS_PATH}/${paymentId}`);
  revalidatePath(`/sales/invoices/${parsed.data.invoiceId}`);
  return {};
}

export async function cancelPaymentAction(paymentId: string): Promise<void> {
  const session = await requireSession();
  if (!canCancelPayments(session.role)) {
    throw new Error("Only Owner/Admin can cancel a payment.");
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, companyId: session.companyId },
    include: { allocations: true },
  });
  if (!payment) throw new Error("This payment no longer exists.");
  if (payment.status === "CANCELLED") {
    throw new Error("This payment is already cancelled.");
  }

  const affectedInvoiceIds = [...new Set(payment.allocations.map((a) => a.invoiceId))];

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { status: "CANCELLED" } });
    for (const invoiceId of affectedInvoiceIds) {
      await recomputeInvoicePaymentState(tx, invoiceId);
    }
    await recomputePaymentAllocationState(tx, paymentId);
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PAYMENT_CANCELLED",
    entityType: "Payment",
    entityId: paymentId,
    before: { status: payment.status, allocatedAmount: payment.allocatedAmount },
  });

  revalidatePath(PAYMENTS_PATH);
  revalidatePath(`${PAYMENTS_PATH}/${paymentId}`);
  for (const invoiceId of affectedInvoiceIds) {
    revalidatePath(`/sales/invoices/${invoiceId}`);
  }
}
