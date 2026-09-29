"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageExpenses, canApproveExpenses, canCancelExpenses } from "@/lib/core/permissions";
import { saveUploadedFile, deleteStoredFile, UploadRejectedError } from "@/lib/core/storage";
import { type FormActionState, firstFieldErrors, rawValues, nextAttempt, str } from "@/lib/core/form-state";
import { round2 } from "@/lib/energy/shared/pricing";
import { expenseFormSchema, recordExpensePaymentFormSchema, expenseCategoryFormSchema } from "./schema";

const EXPENSES_PATH = "/finance/expenses";

function requireManager(role: Parameters<typeof canManageExpenses>[0]) {
  if (!canManageExpenses(role)) {
    throw new Error("You don't have permission to manage expenses.");
  }
}

function readForm(formData: FormData) {
  return {
    expenseDate: str(formData, "expenseDate"),
    categoryId: str(formData, "categoryId"),
    amount: str(formData, "amount"),
    taxRate: str(formData, "taxRate"),
    vendorId: str(formData, "vendorId"),
    projectId: str(formData, "projectId"),
    siteId: str(formData, "siteId"),
    description: str(formData, "description"),
    referenceNumber: str(formData, "referenceNumber"),
  };
}

function computeTotals(amount: number, taxRate?: number) {
  const taxAmount = taxRate ? round2(amount * (taxRate / 100)) : 0;
  const grandTotal = round2(amount + taxAmount);
  return { taxAmount, grandTotal };
}

export async function createExpenseAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const parsed = expenseFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const category = await prisma.expenseCategory.findFirst({ where: { id: values.categoryId, companyId: session.companyId } });
  if (!category) {
    return { error: "Select a valid category.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const { taxAmount, grandTotal } = computeTotals(values.amount, values.taxRate);

  const expense = await prisma.$transaction(async (tx) => {
    const expenseNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "EXP", prefix: "EXP" });
    return tx.expense.create({
      data: {
        companyId: session.companyId,
        expenseNumber,
        expenseDate: new Date(values.expenseDate),
        categoryId: values.categoryId,
        amount: values.amount,
        taxRate: values.taxRate ?? null,
        taxAmount,
        grandTotal,
        vendorId: values.vendorId,
        projectId: values.projectId,
        siteId: values.siteId,
        description: values.description,
        referenceNumber: values.referenceNumber,
        status: "DRAFT",
        createdBy: session.userId,
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "EXPENSE_CREATED",
    entityType: "Expense",
    entityId: expense.id,
    after: { expenseNumber: expense.expenseNumber, grandTotal: expense.grandTotal },
  });

  revalidatePath(EXPENSES_PATH);
  redirect(`${EXPENSES_PATH}/${expense.id}`);
}

export async function updateExpenseAction(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const existing = await prisma.expense.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) return { error: "This expense no longer exists.", attempt: nextAttempt(_prevState) };
  if (existing.status !== "DRAFT") {
    return { error: "Only draft expenses can be edited.", attempt: nextAttempt(_prevState) };
  }

  const parsed = expenseFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const category = await prisma.expenseCategory.findFirst({ where: { id: values.categoryId, companyId: session.companyId } });
  if (!category) {
    return { error: "Select a valid category.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const { taxAmount, grandTotal } = computeTotals(values.amount, values.taxRate);

  await prisma.expense.update({
    where: { id },
    data: {
      expenseDate: new Date(values.expenseDate),
      categoryId: values.categoryId,
      amount: values.amount,
      taxRate: values.taxRate ?? null,
      taxAmount,
      grandTotal,
      vendorId: values.vendorId,
      projectId: values.projectId,
      siteId: values.siteId,
      description: values.description,
      referenceNumber: values.referenceNumber,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "EXPENSE_UPDATED",
    entityType: "Expense",
    entityId: id,
    after: { grandTotal },
  });

  revalidatePath(EXPENSES_PATH);
  revalidatePath(`${EXPENSES_PATH}/${id}`);
  redirect(`${EXPENSES_PATH}/${id}`);
}

export async function approveExpenseAction(id: string): Promise<void> {
  const session = await requireSession();
  if (!canApproveExpenses(session.role)) {
    throw new Error("Only Owner/Admin can approve an expense.");
  }

  const expense = await prisma.expense.findFirst({ where: { id, companyId: session.companyId } });
  if (!expense) return;
  if (expense.status !== "DRAFT") {
    throw new Error(`Cannot approve a ${expense.status.toLowerCase()} expense.`);
  }

  await prisma.expense.update({ where: { id }, data: { status: "APPROVED" } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "EXPENSE_APPROVED",
    entityType: "Expense",
    entityId: id,
  });

  revalidatePath(EXPENSES_PATH);
  revalidatePath(`${EXPENSES_PATH}/${id}`);
}

export async function cancelExpenseAction(id: string): Promise<void> {
  const session = await requireSession();
  if (!canCancelExpenses(session.role)) {
    throw new Error("Only Owner/Admin can cancel an expense.");
  }

  const expense = await prisma.expense.findFirst({ where: { id, companyId: session.companyId } });
  if (!expense) return;
  // PAID expenses are historical record — never silently cancelled/deleted
  // (spec section 13).
  if (expense.status === "PAID" || expense.status === "CANCELLED") {
    throw new Error(`Cannot cancel a ${expense.status.toLowerCase()} expense.`);
  }

  await prisma.expense.update({ where: { id }, data: { status: "CANCELLED" } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "EXPENSE_CANCELLED",
    entityType: "Expense",
    entityId: id,
    before: { status: expense.status },
  });

  revalidatePath(EXPENSES_PATH);
  revalidatePath(`${EXPENSES_PATH}/${id}`);
}

// Minimal payment tracking (spec section 8) — not a full allocation ledger.
// Only an APPROVED expense can be paid; status auto-advances to PAID once
// the cumulative paidAmount reaches grandTotal (gated, never a bare button).
export async function recordExpensePaymentAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const expense = await prisma.expense.findFirst({ where: { id, companyId: session.companyId } });
  if (!expense) return { error: "This expense no longer exists.", attempt: nextAttempt(_prevState) };
  if (expense.status !== "APPROVED") {
    return { error: "Approve this expense before recording a payment.", attempt: nextAttempt(_prevState) };
  }

  const parsed = recordExpensePaymentFormSchema.safeParse({
    amount: str(formData, "amount"),
    paymentDate: str(formData, "paymentDate"),
    paymentMode: str(formData, "paymentMode"),
    paymentReferenceNumber: str(formData, "paymentReferenceNumber"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const newPaidAmount = round2(expense.paidAmount + values.amount);
  if (newPaidAmount > expense.grandTotal + 0.005) {
    return {
      error: `This payment would exceed the expense total - only ₹${round2(expense.grandTotal - expense.paidAmount)} remains unpaid.`,
      attempt: nextAttempt(_prevState),
    };
  }

  await prisma.expense.update({
    where: { id },
    data: {
      paidAmount: newPaidAmount,
      paymentDate: new Date(values.paymentDate),
      paymentMode: values.paymentMode,
      paymentReferenceNumber: values.paymentReferenceNumber,
      status: newPaidAmount >= expense.grandTotal ? "PAID" : "APPROVED",
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "EXPENSE_PAYMENT_RECORDED",
    entityType: "Expense",
    entityId: id,
    after: { amount: values.amount, paidAmount: newPaidAmount },
  });

  revalidatePath(EXPENSES_PATH);
  revalidatePath(`${EXPENSES_PATH}/${id}`);
  return {};
}

export async function uploadExpenseDocumentAction(
  expenseId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, companyId: session.companyId } });
  if (!expense) return { error: "This expense no longer exists.", attempt: nextAttempt(_prevState) };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload.", attempt: nextAttempt(_prevState) };
  }

  try {
    const stored = await saveUploadedFile({ companyId: session.companyId, entityType: "EXPENSE", entityId: expenseId, file });

    const document = await prisma.document.create({
      data: {
        companyId: session.companyId,
        entityType: "EXPENSE",
        entityId: expenseId,
        fileName: stored.fileName,
        fileUrl: stored.fileUrl,
        fileType: stored.fileType,
        fileSize: stored.fileSize,
        uploadedBy: session.userId,
      },
    });

    await recordAudit({
      companyId: session.companyId,
      userId: session.userId,
      action: "DOCUMENT_UPLOADED",
      entityType: "Expense",
      entityId: expenseId,
      after: { fileName: document.fileName },
    });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return { error: error.message, attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  revalidatePath(`${EXPENSES_PATH}/${expenseId}`);
  return {};
}

export async function deleteExpenseDocumentAction(expenseId: string, documentId: string): Promise<void> {
  const session = await requireSession();
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId: session.companyId, entityType: "EXPENSE", entityId: expenseId },
  });
  if (!document) return;

  await prisma.document.delete({ where: { id: documentId } });
  await deleteStoredFile(document.fileUrl);

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "DOCUMENT_DELETED",
    entityType: "Expense",
    entityId: expenseId,
    before: { fileName: document.fileName },
  });

  revalidatePath(`${EXPENSES_PATH}/${expenseId}`);
}

export async function createExpenseCategoryAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = expenseCategoryFormSchema.safeParse({ name: str(formData, "name"), group: str(formData, "group") });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }
  const existing = await prisma.expenseCategory.findFirst({ where: { companyId: session.companyId, name: parsed.data.name } });
  if (existing) {
    return { error: "A category with this name already exists." };
  }
  await prisma.expenseCategory.create({ data: { companyId: session.companyId, ...parsed.data } });
  revalidatePath("/settings");
  return {};
}

export async function setExpenseCategoryActiveAction(categoryId: string, isActive: boolean): Promise<void> {
  const session = await requireSession();
  await prisma.expenseCategory.updateMany({ where: { id: categoryId, companyId: session.companyId }, data: { isActive } });
  revalidatePath("/settings");
}
