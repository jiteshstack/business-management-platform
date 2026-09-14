"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageAmcs } from "@/lib/core/permissions";
import { type FormActionState, firstFieldErrors, rawValues, nextAttempt, str } from "@/lib/core/form-state";
import { amcFormSchema } from "./schema";

const AMCS_PATH = "/service/amc";

function requireManager(role: Parameters<typeof canManageAmcs>[0]) {
  if (!canManageAmcs(role)) {
    throw new Error("You don't have permission to manage AMCs.");
  }
}

function readForm(formData: FormData) {
  return {
    customerId: str(formData, "customerId"),
    siteId: str(formData, "siteId"),
    projectId: str(formData, "projectId"),
    startDate: str(formData, "startDate"),
    endDate: str(formData, "endDate"),
    contractValue: str(formData, "contractValue"),
    billingFrequency: str(formData, "billingFrequency"),
    numberOfVisits: str(formData, "numberOfVisits"),
    coverage: str(formData, "coverage"),
    exclusions: str(formData, "exclusions"),
    notes: str(formData, "notes"),
  };
}

export async function createAmcAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const parsed = amcFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const customer = await prisma.party.findFirst({ where: { id: values.customerId, companyId: session.companyId, type: "CLIENT" } });
  if (!customer) {
    return { error: "Select a valid customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const startDate = new Date(values.startDate);
  const endDate = new Date(values.endDate);
  if (endDate.getTime() <= startDate.getTime()) {
    return { error: "End date must be after the start date.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const amc = await prisma.$transaction(async (tx) => {
    const amcNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "AMC", prefix: "AMC" });
    return tx.aMC.create({
      data: {
        companyId: session.companyId,
        amcNumber,
        customerId: values.customerId,
        siteId: values.siteId,
        projectId: values.projectId,
        startDate,
        endDate,
        contractValue: values.contractValue ?? null,
        billingFrequency: values.billingFrequency ?? null,
        numberOfVisits: values.numberOfVisits,
        coverage: values.coverage,
        exclusions: values.exclusions,
        notes: values.notes,
        status: "DRAFT",
        createdBy: session.userId,
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "AMC_CREATED",
    entityType: "AMC",
    entityId: amc.id,
    after: { amcNumber: amc.amcNumber },
  });

  revalidatePath(AMCS_PATH);
  redirect(`${AMCS_PATH}/${amc.id}`);
}

export async function updateAmcAction(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const existing = await prisma.aMC.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) return { error: "This AMC no longer exists.", attempt: nextAttempt(_prevState) };

  const parsed = amcFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;
  const startDate = new Date(values.startDate);
  const endDate = new Date(values.endDate);
  if (endDate.getTime() <= startDate.getTime()) {
    return { error: "End date must be after the start date.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  await prisma.aMC.update({
    where: { id },
    data: {
      siteId: values.siteId,
      projectId: values.projectId,
      startDate,
      endDate,
      contractValue: values.contractValue ?? null,
      billingFrequency: values.billingFrequency ?? null,
      numberOfVisits: values.numberOfVisits,
      coverage: values.coverage,
      exclusions: values.exclusions,
      notes: values.notes,
    },
  });

  await recordAudit({ companyId: session.companyId, userId: session.userId, action: "AMC_UPDATED", entityType: "AMC", entityId: id });

  revalidatePath(AMCS_PATH);
  revalidatePath(`${AMCS_PATH}/${id}`);
  redirect(`${AMCS_PATH}/${id}`);
}

const AMC_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
};

export async function setAmcStatusAction(id: string, newStatus: "ACTIVE" | "CANCELLED" | "COMPLETED"): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const amc = await prisma.aMC.findFirst({ where: { id, companyId: session.companyId } });
  if (!amc) return;

  const allowed = AMC_STATUS_TRANSITIONS[amc.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${amc.status} AMC to ${newStatus}.`);
  }

  await prisma.aMC.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "AMC_STATUS_CHANGED",
    entityType: "AMC",
    entityId: id,
    before: { status: amc.status },
    after: { status: newStatus },
  });

  revalidatePath(AMCS_PATH);
  revalidatePath(`${AMCS_PATH}/${id}`);
}

// Links an existing Energy Invoice to this AMC for periodic billing — no
// new invoice is ever created here; reuses the invoice the user already
// created via the normal Invoices flow (spec section 15).
export async function linkInvoiceToAmcAction(amcId: string, invoiceId: string): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const amc = await prisma.aMC.findFirst({ where: { id: amcId, companyId: session.companyId } });
  if (!amc) throw new Error("This AMC no longer exists.");

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: session.companyId, clientId: amc.customerId } });
  if (!invoice) throw new Error("Select a valid invoice for this customer.");

  await prisma.invoice.update({ where: { id: invoiceId }, data: { amcId } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "AMC_INVOICE_LINKED",
    entityType: "AMC",
    entityId: amcId,
    after: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath(`${AMCS_PATH}/${amcId}`);
}
