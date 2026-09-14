"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageVendorPayments, canCancelVendorPayments } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { vendorPaymentFormSchema, allocateVendorPaymentFormSchema } from "./schema";
import {
  allocateVendorPayment,
  recomputeVendorInvoicePaymentState,
  recomputeVendorPaymentAllocationState,
  VendorPaymentRuleError,
} from "./ledger";

const VENDOR_PAYMENTS_PATH = "/purchase/payments-made";

function requireVendorPaymentManager(role: Parameters<typeof canManageVendorPayments>[0]) {
  if (!canManageVendorPayments(role)) {
    throw new Error("You don't have permission to manage vendor payments.");
  }
}

function readVendorPaymentForm(formData: FormData) {
  return {
    vendorId: str(formData, "vendorId"),
    amount: str(formData, "amount"),
    paymentDate: str(formData, "paymentDate"),
    mode: str(formData, "mode"),
    referenceNumber: str(formData, "referenceNumber"),
    chequeNumber: str(formData, "chequeNumber"),
    chequeDate: str(formData, "chequeDate"),
    bankName: str(formData, "bankName"),
    notes: str(formData, "notes"),
    vendorInvoiceId: str(formData, "vendorInvoiceId"),
  };
}

export async function createVendorPaymentAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireVendorPaymentManager(session.role);

  const parsed = vendorPaymentFormSchema.safeParse(readVendorPaymentForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const vendor = await prisma.party.findFirst({
    where: { id: values.vendorId, companyId: session.companyId, type: "VENDOR" },
  });
  if (!vendor) {
    return { error: "Select a valid vendor.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  let vendorInvoice: { id: string; vendorId: string } | null = null;
  if (values.vendorInvoiceId) {
    vendorInvoice = await prisma.vendorInvoice.findFirst({
      where: { id: values.vendorInvoiceId, companyId: session.companyId, vendorId: vendor.id },
    });
    if (!vendorInvoice) {
      return {
        error: "Selected invoice could not be found for this vendor.",
        values: rawValues(formData),
        attempt: nextAttempt(_prevState),
      };
    }
  }

  let paymentId: string;
  try {
    paymentId = await prisma.$transaction(async (tx) => {
      const paymentNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "VPAY", prefix: "VPAY" });

      const payment = await tx.vendorPayment.create({
        data: {
          companyId: session.companyId,
          paymentNumber,
          status: "UNALLOCATED",
          vendorId: vendor.id,
          amount: values.amount,
          // Correct from the start for the (common) no-allocation case;
          // allocateVendorPayment() below recomputes it from real
          // allocation rows when an initial allocation is requested.
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

      if (vendorInvoice) {
        await allocateVendorPayment(tx, {
          companyId: session.companyId,
          vendorPaymentId: payment.id,
          vendorInvoiceId: vendorInvoice.id,
          amount: values.amount,
        });
      }

      return payment.id;
    });
  } catch (error) {
    if (error instanceof VendorPaymentRuleError) {
      return { error: error.message, values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "VENDOR_PAYMENT_CREATED",
    entityType: "VendorPayment",
    entityId: paymentId,
    after: { amount: values.amount, vendorInvoiceId: vendorInvoice?.id ?? null },
  });

  revalidatePath(VENDOR_PAYMENTS_PATH);
  if (vendorInvoice) revalidatePath(`/purchase/vendor-invoices/${vendorInvoice.id}`);
  redirect(`${VENDOR_PAYMENTS_PATH}/${paymentId}`);
}

export async function allocateVendorPaymentAction(
  vendorPaymentId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireVendorPaymentManager(session.role);

  const parsed = allocateVendorPaymentFormSchema.safeParse({
    vendorInvoiceId: str(formData, "vendorInvoiceId"),
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
      await allocateVendorPayment(tx, {
        companyId: session.companyId,
        vendorPaymentId,
        vendorInvoiceId: parsed.data.vendorInvoiceId,
        amount: parsed.data.amount,
      });
    });
  } catch (error) {
    if (error instanceof VendorPaymentRuleError) {
      return { error: error.message, attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "VENDOR_PAYMENT_ALLOCATED",
    entityType: "VendorPayment",
    entityId: vendorPaymentId,
    after: { vendorInvoiceId: parsed.data.vendorInvoiceId, amount: parsed.data.amount },
  });

  revalidatePath(`${VENDOR_PAYMENTS_PATH}/${vendorPaymentId}`);
  revalidatePath(`/purchase/vendor-invoices/${parsed.data.vendorInvoiceId}`);
  return {};
}

export async function cancelVendorPaymentAction(vendorPaymentId: string): Promise<void> {
  const session = await requireSession();
  if (!canCancelVendorPayments(session.role)) {
    throw new Error("Only Owner/Admin can cancel a vendor payment.");
  }

  const payment = await prisma.vendorPayment.findFirst({
    where: { id: vendorPaymentId, companyId: session.companyId },
    include: { allocations: true },
  });
  if (!payment) throw new Error("This payment no longer exists.");
  if (payment.status === "CANCELLED") {
    throw new Error("This payment is already cancelled.");
  }

  const affectedInvoiceIds = [...new Set(payment.allocations.map((a) => a.vendorInvoiceId))];

  await prisma.$transaction(async (tx) => {
    await tx.vendorPayment.update({ where: { id: vendorPaymentId }, data: { status: "CANCELLED" } });
    for (const vendorInvoiceId of affectedInvoiceIds) {
      await recomputeVendorInvoicePaymentState(tx, vendorInvoiceId);
    }
    await recomputeVendorPaymentAllocationState(tx, vendorPaymentId);
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "VENDOR_PAYMENT_CANCELLED",
    entityType: "VendorPayment",
    entityId: vendorPaymentId,
    before: { status: payment.status, allocatedAmount: payment.allocatedAmount },
  });

  revalidatePath(VENDOR_PAYMENTS_PATH);
  revalidatePath(`${VENDOR_PAYMENTS_PATH}/${vendorPaymentId}`);
  for (const vendorInvoiceId of affectedInvoiceIds) {
    revalidatePath(`/purchase/vendor-invoices/${vendorInvoiceId}`);
  }
}
