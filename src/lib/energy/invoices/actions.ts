"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageInvoices, canCancelInvoices } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { invoiceFormSchema } from "./schema";
import type { LineItemFormValues } from "@/lib/energy/shared/form-fields";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/energy/shared/pricing";
import { INVOICE_STATUS_TRANSITIONS, type InvoiceStatus } from "./types";

const INVOICES_PATH = "/sales/invoices";

function requireInvoiceManager(role: Parameters<typeof canManageInvoices>[0]) {
  if (!canManageInvoices(role)) {
    throw new Error("You don't have permission to manage invoices.");
  }
}

function formatAddress(address: {
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}) {
  return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ");
}

function readInvoiceForm(formData: FormData) {
  return {
    clientId: str(formData, "clientId"),
    siteAddressId: str(formData, "siteAddressId"),
    billingAddressId: str(formData, "billingAddressId"),
    invoiceDate: str(formData, "invoiceDate"),
    dueDate: str(formData, "dueDate"),
    salespersonId: str(formData, "salespersonId"),
    paymentTerms: str(formData, "paymentTerms"),
    notes: str(formData, "notes"),
    discountPercent: str(formData, "discountPercent"),
    otherCharges: str(formData, "otherCharges"),
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

async function resolveBillingAddressText(clientId: string, billingAddressId: string | undefined) {
  if (billingAddressId) {
    const address = await prisma.partyAddress.findFirst({ where: { id: billingAddressId, partyId: clientId } });
    if (!address) throw new Error("Select a valid billing address.");
    return formatAddress(address);
  }
  const fallback = await prisma.partyAddress.findFirst({
    where: { partyId: clientId, type: "BILLING", isDefault: true },
  });
  return fallback ? formatAddress(fallback) : undefined;
}

async function resolveSiteAddressText(clientId: string, siteAddressId: string | undefined) {
  if (!siteAddressId) return undefined;
  const address = await prisma.partyAddress.findFirst({ where: { id: siteAddressId, partyId: clientId } });
  if (!address) throw new Error("Select a valid site address.");
  return formatAddress(address);
}

function defaultDueDate(invoiceDate: Date): Date {
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + 30);
  return d;
}

export async function createInvoiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInvoiceManager(session.role);

  const parsed = invoiceFormSchema.safeParse(readInvoiceForm(formData));
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

  let billingAddressText: string | undefined;
  let siteAddressText: string | undefined;
  try {
    billingAddressText = await resolveBillingAddressText(client.id, values.billingAddressId);
    siteAddressText = await resolveSiteAddressText(client.id, values.siteAddressId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid address.",
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
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
  const invoiceDate = new Date(values.invoiceDate);
  const dueDate = values.dueDate ? new Date(values.dueDate) : defaultDueDate(invoiceDate);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, {
      companyId: session.companyId,
      series: "EINV",
      prefix: "EINV",
    });

    return tx.invoice.create({
      data: {
        companyId: session.companyId,
        invoiceNumber,
        status: "DRAFT",
        clientId: client.id,
        billingAddressText,
        siteAddressText,
        invoiceDate,
        dueDate,
        paymentTerms: values.paymentTerms,
        notes: values.notes,
        salespersonId: values.salespersonId ?? session.userId,
        discountPercent: values.discountPercent ?? null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        otherCharges: totals.otherCharges,
        grandTotal: totals.grandTotal,
        paidAmount: 0,
        outstandingAmount: totals.grandTotal,
        createdBy: session.userId,
        items: { create: lineRows },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INVOICE_CREATED",
    entityType: "Invoice",
    entityId: invoice.id,
    after: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
  });

  revalidatePath(INVOICES_PATH);
  redirect(`${INVOICES_PATH}/${invoice.id}`);
}

export async function updateInvoiceAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInvoiceManager(session.role);

  const existing = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This invoice no longer exists.", attempt: nextAttempt(_prevState) };
  }
  if (existing.status !== "DRAFT") {
    return { error: "Only draft invoices can be edited.", attempt: nextAttempt(_prevState) };
  }

  const parsed = invoiceFormSchema.safeParse(readInvoiceForm(formData));
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

  let billingAddressText: string | undefined;
  let siteAddressText: string | undefined;
  try {
    billingAddressText = await resolveBillingAddressText(client.id, values.billingAddressId);
    siteAddressText = await resolveSiteAddressText(client.id, values.siteAddressId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid address.",
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
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
  const invoiceDate = new Date(values.invoiceDate);
  const dueDate = values.dueDate ? new Date(values.dueDate) : defaultDueDate(invoiceDate);

  await prisma.$transaction(async (tx) => {
    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        clientId: client.id,
        billingAddressText,
        siteAddressText,
        invoiceDate,
        dueDate,
        salespersonId: values.salespersonId ?? undefined,
        paymentTerms: values.paymentTerms,
        notes: values.notes,
        discountPercent: values.discountPercent ?? null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        otherCharges: totals.otherCharges,
        grandTotal: totals.grandTotal,
        outstandingAmount: totals.grandTotal - existing.paidAmount,
        items: { create: lineRows },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INVOICE_UPDATED",
    entityType: "Invoice",
    entityId: id,
    after: { grandTotal: totals.grandTotal },
  });

  revalidatePath(INVOICES_PATH);
  revalidatePath(`${INVOICES_PATH}/${id}`);
  redirect(`${INVOICES_PATH}/${id}`);
}

// Creates an Invoice directly from a Sales Order, copying its line items as a
// snapshot so later sales order edits never retroactively change an
// already-issued invoice.
export async function createInvoiceFromSalesOrderAction(salesOrderId: string): Promise<void> {
  const session = await requireSession();
  requireInvoiceManager(session.role);

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, companyId: session.companyId },
    include: { items: true },
  });
  if (!salesOrder) throw new Error("This sales order no longer exists.");
  if (!["CONFIRMED", "PARTIALLY_FULFILLED", "COMPLETED"].includes(salesOrder.status)) {
    throw new Error("Only a confirmed sales order can be invoiced.");
  }

  const billingAddressText = await resolveBillingAddressText(salesOrder.clientId, undefined);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, {
      companyId: session.companyId,
      series: "EINV",
      prefix: "EINV",
    });

    return tx.invoice.create({
      data: {
        companyId: session.companyId,
        invoiceNumber,
        status: "DRAFT",
        clientId: salesOrder.clientId,
        billingAddressText,
        siteAddressText: salesOrder.siteAddressText,
        salesOrderId: salesOrder.id,
        quotationId: salesOrder.quotationId,
        invoiceDate: new Date(),
        dueDate: defaultDueDate(new Date()),
        paymentTerms: salesOrder.paymentTerms,
        salespersonId: salesOrder.salespersonId,
        discountPercent: salesOrder.discountPercent,
        subtotal: salesOrder.subtotal,
        discountAmount: salesOrder.discountAmount,
        taxableAmount: salesOrder.taxableAmount,
        taxAmount: salesOrder.taxAmount,
        otherCharges: salesOrder.otherCharges,
        grandTotal: salesOrder.grandTotal,
        paidAmount: 0,
        outstandingAmount: salesOrder.grandTotal,
        createdBy: session.userId,
        items: {
          create: salesOrder.items.map((item, index) => ({
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
            sortOrder: index,
          })),
        },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INVOICE_CREATED_FROM_SALES_ORDER",
    entityType: "Invoice",
    entityId: invoice.id,
    before: { soNumber: salesOrder.soNumber },
    after: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath(INVOICES_PATH);
  revalidatePath(`/sales/sales-orders/${salesOrder.id}`);
  redirect(`${INVOICES_PATH}/${invoice.id}`);
}

export async function setInvoiceStatusAction(id: string, newStatus: InvoiceStatus): Promise<void> {
  const session = await requireSession();
  const invoice = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!invoice) return;

  if (newStatus === "CANCELLED") {
    if (!canCancelInvoices(session.role)) {
      throw new Error("Only Owner/Admin can cancel an invoice.");
    }
  } else {
    requireInvoiceManager(session.role);
  }

  const allowed = INVOICE_STATUS_TRANSITIONS[invoice.status as InvoiceStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${invoice.status} invoice to ${newStatus}.`);
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      status: newStatus,
      outstandingAmount: newStatus === "CANCELLED" ? 0 : invoice.grandTotal - invoice.paidAmount,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INVOICE_STATUS_CHANGED",
    entityType: "Invoice",
    entityId: id,
    before: { status: invoice.status },
    after: { status: newStatus },
  });

  revalidatePath(INVOICES_PATH);
  revalidatePath(`${INVOICES_PATH}/${id}`);
}
