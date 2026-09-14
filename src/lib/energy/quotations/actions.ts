"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageQuotations, canApproveQuotations } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { quotationFormSchema } from "./schema";
import type { LineItemFormValues } from "@/lib/energy/shared/form-fields";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/energy/shared/pricing";
import { QUOTATION_STATUS_TRANSITIONS, type QuotationStatus } from "./types";

const QUOTATIONS_PATH = "/sales/quotations";

function requireQuotationManager(role: Parameters<typeof canManageQuotations>[0]) {
  if (!canManageQuotations(role)) {
    throw new Error("You don't have permission to manage quotations.");
  }
}

function readQuotationForm(formData: FormData) {
  return {
    clientId: str(formData, "clientId"),
    siteAddressId: str(formData, "siteAddressId"),
    type: str(formData, "type"),
    quotationDate: str(formData, "quotationDate"),
    validUntil: str(formData, "validUntil"),
    salespersonId: str(formData, "salespersonId"),
    reference: str(formData, "reference"),
    subject: str(formData, "subject"),
    notes: str(formData, "notes"),
    paymentTerms: str(formData, "paymentTerms"),
    equipmentWarranty: str(formData, "equipmentWarranty"),
    installationWarranty: str(formData, "installationWarranty"),
    deliveryTimeline: str(formData, "deliveryTimeline"),
    installationTimeline: str(formData, "installationTimeline"),
    termsAndConditions: str(formData, "termsAndConditions"),
    discountPercent: str(formData, "discountPercent"),
    otherCharges: str(formData, "otherCharges"),
    technicalConfigJson: str(formData, "technicalConfigJson"),
    items: str(formData, "items") ?? "",
  };
}

async function buildLineItemRows(companyId: string, items: LineItemFormValues[]) {
  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    include: { unit: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return items.map((item, index) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("One of the selected products no longer exists.");
    }
    const totals = calculateLineItem(item);
    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      unitLabel: product.unit?.name ?? null,
      description: item.description || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent ?? null,
      discountAmount: totals.discountAmount,
      taxRate: item.taxRate ?? null,
      taxAmount: totals.taxAmount,
      lineSubtotal: totals.lineSubtotal,
      lineTotal: totals.lineTotal,
      sortOrder: index,
    };
  });
}

function defaultValidUntil(quotationDate: Date): Date {
  const d = new Date(quotationDate);
  d.setDate(d.getDate() + 30);
  return d;
}

export async function createQuotationAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireQuotationManager(session.role);

  const parsed = quotationFormSchema.safeParse(readQuotationForm(formData));
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

  let siteAddressText: string | undefined;
  if (values.siteAddressId) {
    const address = await prisma.partyAddress.findFirst({
      where: { id: values.siteAddressId, partyId: client.id },
    });
    if (!address) {
      return { error: "Select a valid site address.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
    siteAddressText = [address.line1, address.line2, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(", ");
  }

  let lineRows;
  try {
    lineRows = await buildLineItemRows(session.companyId, values.items);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid line items.",
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  const totals = calculateDocumentTotals(values.items, values.discountPercent, values.otherCharges);
  const quotationDate = new Date(values.quotationDate);
  const validUntil = values.validUntil ? new Date(values.validUntil) : defaultValidUntil(quotationDate);

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  const termsAndConditions = values.termsAndConditions ?? company?.defaultQuotationTerms ?? undefined;

  const quotation = await prisma.$transaction(async (tx) => {
    const quotationNumber = await nextDocumentNumber(tx, {
      companyId: session.companyId,
      series: "QTN",
      prefix: "QTN",
    });

    return tx.quotation.create({
      data: {
        companyId: session.companyId,
        quotationNumber,
        revisionNumber: 0,
        clientId: client.id,
        siteAddressId: values.siteAddressId ?? null,
        siteAddressText,
        type: values.type,
        status: "DRAFT",
        quotationDate,
        validUntil,
        salespersonId: values.salespersonId ?? session.userId,
        reference: values.reference,
        subject: values.subject,
        notes: values.notes,
        technicalConfigJson: values.technicalConfigJson,
        paymentTerms: values.paymentTerms,
        equipmentWarranty: values.equipmentWarranty,
        installationWarranty: values.installationWarranty,
        deliveryTimeline: values.deliveryTimeline,
        installationTimeline: values.installationTimeline,
        termsAndConditions,
        discountPercent: values.discountPercent ?? null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        otherCharges: totals.otherCharges,
        grandTotal: totals.grandTotal,
        createdBy: session.userId,
        items: { create: lineRows },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "QUOTATION_CREATED",
    entityType: "Quotation",
    entityId: quotation.id,
    after: { quotationNumber: quotation.quotationNumber, grandTotal: quotation.grandTotal },
  });

  revalidatePath(QUOTATIONS_PATH);
  redirect(`${QUOTATIONS_PATH}/${quotation.id}`);
}

export async function updateQuotationAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireQuotationManager(session.role);

  const existing = await prisma.quotation.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This quotation no longer exists.", attempt: nextAttempt(_prevState) };
  }
  if (existing.status !== "DRAFT") {
    return {
      error: "Only draft quotations can be edited. Create a revision instead.",
      attempt: nextAttempt(_prevState),
    };
  }

  const parsed = quotationFormSchema.safeParse(readQuotationForm(formData));
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

  let siteAddressText: string | undefined;
  if (values.siteAddressId) {
    const address = await prisma.partyAddress.findFirst({
      where: { id: values.siteAddressId, partyId: client.id },
    });
    if (!address) {
      return { error: "Select a valid site address.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
    siteAddressText = [address.line1, address.line2, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(", ");
  }

  let lineRows;
  try {
    lineRows = await buildLineItemRows(session.companyId, values.items);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid line items.",
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  const totals = calculateDocumentTotals(values.items, values.discountPercent, values.otherCharges);
  const quotationDate = new Date(values.quotationDate);
  const validUntil = values.validUntil ? new Date(values.validUntil) : defaultValidUntil(quotationDate);

  await prisma.$transaction(async (tx) => {
    await tx.quotationLineItem.deleteMany({ where: { quotationId: id } });
    await tx.quotation.update({
      where: { id },
      data: {
        clientId: client.id,
        siteAddressId: values.siteAddressId ?? null,
        siteAddressText,
        type: values.type,
        quotationDate,
        validUntil,
        salespersonId: values.salespersonId ?? undefined,
        reference: values.reference,
        subject: values.subject,
        notes: values.notes,
        technicalConfigJson: values.technicalConfigJson,
        paymentTerms: values.paymentTerms,
        equipmentWarranty: values.equipmentWarranty,
        installationWarranty: values.installationWarranty,
        deliveryTimeline: values.deliveryTimeline,
        installationTimeline: values.installationTimeline,
        termsAndConditions: values.termsAndConditions,
        discountPercent: values.discountPercent ?? null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        otherCharges: totals.otherCharges,
        grandTotal: totals.grandTotal,
        items: { create: lineRows },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "QUOTATION_UPDATED",
    entityType: "Quotation",
    entityId: id,
    after: { grandTotal: totals.grandTotal },
  });

  revalidatePath(QUOTATIONS_PATH);
  revalidatePath(`${QUOTATIONS_PATH}/${id}`);
  redirect(`${QUOTATIONS_PATH}/${id}`);
}

export async function setQuotationStatusAction(id: string, newStatus: QuotationStatus): Promise<void> {
  const session = await requireSession();
  const quotation = await prisma.quotation.findFirst({ where: { id, companyId: session.companyId } });
  if (!quotation) return;

  if (newStatus === "APPROVED") {
    if (!canApproveQuotations(session.role)) {
      throw new Error("Only Owner/Admin can approve a quotation.");
    }
  } else {
    requireQuotationManager(session.role);
  }

  const allowed = QUOTATION_STATUS_TRANSITIONS[quotation.status as QuotationStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${quotation.status} quotation to ${newStatus}.`);
  }

  await prisma.quotation.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "QUOTATION_STATUS_CHANGED",
    entityType: "Quotation",
    entityId: id,
    before: { status: quotation.status },
    after: { status: newStatus },
  });

  revalidatePath(QUOTATIONS_PATH);
  revalidatePath(`${QUOTATIONS_PATH}/${id}`);
}

export async function createRevisionAction(id: string): Promise<void> {
  const session = await requireSession();
  requireQuotationManager(session.role);

  const source = await prisma.quotation.findFirst({
    where: { id, companyId: session.companyId },
    include: { items: true },
  });
  if (!source) throw new Error("This quotation no longer exists.");

  const rootId = source.rootQuotationId ?? source.id;
  const latestRevisionNumber = await prisma.quotation.aggregate({
    where: { companyId: session.companyId, OR: [{ id: rootId }, { rootQuotationId: rootId }] },
    _max: { revisionNumber: true },
  });
  const nextRevisionNumber = (latestRevisionNumber._max.revisionNumber ?? 0) + 1;

  const revision = await prisma.$transaction(async (tx) => {
    await tx.quotation.updateMany({
      where: { companyId: session.companyId, OR: [{ id: rootId }, { rootQuotationId: rootId }] },
      data: { isLatestRevision: false },
    });

    return tx.quotation.create({
      data: {
        companyId: session.companyId,
        quotationNumber: source.quotationNumber,
        revisionNumber: nextRevisionNumber,
        rootQuotationId: rootId,
        isLatestRevision: true,
        clientId: source.clientId,
        siteAddressId: source.siteAddressId,
        siteAddressText: source.siteAddressText,
        type: source.type,
        status: "DRAFT",
        quotationDate: new Date(),
        validUntil: source.validUntil,
        salespersonId: source.salespersonId,
        reference: source.reference,
        subject: source.subject,
        notes: source.notes,
        technicalConfigJson: source.technicalConfigJson,
        paymentTerms: source.paymentTerms,
        equipmentWarranty: source.equipmentWarranty,
        installationWarranty: source.installationWarranty,
        deliveryTimeline: source.deliveryTimeline,
        installationTimeline: source.installationTimeline,
        termsAndConditions: source.termsAndConditions,
        discountPercent: source.discountPercent,
        subtotal: source.subtotal,
        discountAmount: source.discountAmount,
        taxableAmount: source.taxableAmount,
        taxAmount: source.taxAmount,
        otherCharges: source.otherCharges,
        grandTotal: source.grandTotal,
        createdBy: session.userId,
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            unitLabel: item.unitLabel,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "QUOTATION_REVISED",
    entityType: "Quotation",
    entityId: revision.id,
    before: { quotationNumber: source.quotationNumber, revisionNumber: source.revisionNumber },
    after: { quotationNumber: revision.quotationNumber, revisionNumber: revision.revisionNumber },
  });

  revalidatePath(QUOTATIONS_PATH);
  revalidatePath(`${QUOTATIONS_PATH}/${source.id}`);
  redirect(`${QUOTATIONS_PATH}/${revision.id}`);
}

export async function duplicateQuotationAction(id: string): Promise<void> {
  const session = await requireSession();
  requireQuotationManager(session.role);

  const source = await prisma.quotation.findFirst({
    where: { id, companyId: session.companyId },
    include: { items: true },
  });
  if (!source) throw new Error("This quotation no longer exists.");

  const duplicate = await prisma.$transaction(async (tx) => {
    const quotationNumber = await nextDocumentNumber(tx, {
      companyId: session.companyId,
      series: "QTN",
      prefix: "QTN",
    });

    return tx.quotation.create({
      data: {
        companyId: session.companyId,
        quotationNumber,
        revisionNumber: 0,
        clientId: source.clientId,
        siteAddressId: source.siteAddressId,
        siteAddressText: source.siteAddressText,
        type: source.type,
        status: "DRAFT",
        quotationDate: new Date(),
        validUntil: defaultValidUntil(new Date()),
        salespersonId: source.salespersonId,
        reference: source.reference,
        subject: source.subject,
        notes: source.notes,
        technicalConfigJson: source.technicalConfigJson,
        paymentTerms: source.paymentTerms,
        equipmentWarranty: source.equipmentWarranty,
        installationWarranty: source.installationWarranty,
        deliveryTimeline: source.deliveryTimeline,
        installationTimeline: source.installationTimeline,
        termsAndConditions: source.termsAndConditions,
        discountPercent: source.discountPercent,
        subtotal: source.subtotal,
        discountAmount: source.discountAmount,
        taxableAmount: source.taxableAmount,
        taxAmount: source.taxAmount,
        otherCharges: source.otherCharges,
        grandTotal: source.grandTotal,
        createdBy: session.userId,
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            unitLabel: item.unitLabel,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "QUOTATION_DUPLICATED",
    entityType: "Quotation",
    entityId: duplicate.id,
    before: { quotationNumber: source.quotationNumber },
    after: { quotationNumber: duplicate.quotationNumber },
  });

  revalidatePath(QUOTATIONS_PATH);
  redirect(`${QUOTATIONS_PATH}/${duplicate.id}`);
}

export async function updateDefaultQuotationTermsAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  if (session.role !== "OWNER_ADMIN") {
    return { error: "Only Owner/Admin can change default terms." };
  }
  const terms = str(formData, "defaultQuotationTerms") ?? "";
  await prisma.company.update({
    where: { id: session.companyId },
    data: { defaultQuotationTerms: terms || null },
  });
  revalidatePath("/settings");
  return {};
}
