"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageVendorInvoices, canCancelVendorInvoices } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { vendorInvoiceFormSchema } from "./schema";
import type { LineItemFormValues } from "@/lib/energy/shared/form-fields";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/energy/shared/pricing";
import { VENDOR_INVOICE_STATUS_TRANSITIONS, type VendorInvoiceStatus } from "./types";
import { INVOICEABLE_PO_STATUSES } from "@/lib/energy/purchase-orders/types";

const VENDOR_INVOICES_PATH = "/purchase/vendor-invoices";

function requireVendorInvoiceManager(role: Parameters<typeof canManageVendorInvoices>[0]) {
  if (!canManageVendorInvoices(role)) {
    throw new Error("You don't have permission to manage vendor invoices.");
  }
}

function readVendorInvoiceForm(formData: FormData) {
  return {
    vendorId: str(formData, "vendorId"),
    vendorInvoiceNumber: str(formData, "vendorInvoiceNumber"),
    invoiceDate: str(formData, "invoiceDate"),
    dueDate: str(formData, "dueDate"),
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

function defaultDueDate(invoiceDate: Date): Date {
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + 30);
  return d;
}

export async function createVendorInvoiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireVendorInvoiceManager(session.role);

  const parsed = vendorInvoiceFormSchema.safeParse(readVendorInvoiceForm(formData));
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
    const invoiceNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "VINV", prefix: "VINV" });

    return tx.vendorInvoice.create({
      data: {
        companyId: session.companyId,
        invoiceNumber,
        status: "DRAFT",
        vendorId: vendor.id,
        vendorInvoiceNumber: values.vendorInvoiceNumber,
        invoiceDate,
        dueDate,
        notes: values.notes,
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
    action: "VENDOR_INVOICE_CREATED",
    entityType: "VendorInvoice",
    entityId: invoice.id,
    after: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
  });

  revalidatePath(VENDOR_INVOICES_PATH);
  redirect(`${VENDOR_INVOICES_PATH}/${invoice.id}`);
}

export async function updateVendorInvoiceAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireVendorInvoiceManager(session.role);

  const existing = await prisma.vendorInvoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This vendor invoice no longer exists.", attempt: nextAttempt(_prevState) };
  }
  if (existing.status !== "DRAFT") {
    return { error: "Only draft vendor invoices can be edited.", attempt: nextAttempt(_prevState) };
  }

  const parsed = vendorInvoiceFormSchema.safeParse(readVendorInvoiceForm(formData));
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
    await tx.vendorInvoiceLineItem.deleteMany({ where: { vendorInvoiceId: id } });
    await tx.vendorInvoice.update({
      where: { id },
      data: {
        vendorId: vendor.id,
        vendorInvoiceNumber: values.vendorInvoiceNumber,
        invoiceDate,
        dueDate,
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
    action: "VENDOR_INVOICE_UPDATED",
    entityType: "VendorInvoice",
    entityId: id,
    after: { grandTotal: totals.grandTotal },
  });

  revalidatePath(VENDOR_INVOICES_PATH);
  revalidatePath(`${VENDOR_INVOICES_PATH}/${id}`);
  redirect(`${VENDOR_INVOICES_PATH}/${id}`);
}

// Creates a Vendor Invoice directly from a Purchase Order, copying its line
// items as a snapshot — later PO edits never retroactively change an
// already-created vendor invoice.
export async function createVendorInvoiceFromPurchaseOrderAction(purchaseOrderId: string): Promise<void> {
  const session = await requireSession();
  requireVendorInvoiceManager(session.role);

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, companyId: session.companyId },
    include: { items: true },
  });
  if (!po) throw new Error("This purchase order no longer exists.");
  if (!INVOICEABLE_PO_STATUSES.includes(po.status as (typeof INVOICEABLE_PO_STATUSES)[number])) {
    throw new Error("Only a confirmed purchase order can be billed.");
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "VINV", prefix: "VINV" });

    return tx.vendorInvoice.create({
      data: {
        companyId: session.companyId,
        invoiceNumber,
        status: "DRAFT",
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        invoiceDate: new Date(),
        dueDate: defaultDueDate(new Date()),
        discountPercent: po.discountPercent,
        subtotal: po.subtotal,
        discountAmount: po.discountAmount,
        taxableAmount: po.taxableAmount,
        taxAmount: po.taxAmount,
        otherCharges: po.otherCharges,
        grandTotal: po.grandTotal,
        paidAmount: 0,
        outstandingAmount: po.grandTotal,
        createdBy: session.userId,
        items: {
          create: po.items.map((item, index) => ({
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
    action: "VENDOR_INVOICE_CREATED_FROM_PO",
    entityType: "VendorInvoice",
    entityId: invoice.id,
    before: { poNumber: po.poNumber },
    after: { invoiceNumber: invoice.invoiceNumber },
  });

  revalidatePath(VENDOR_INVOICES_PATH);
  revalidatePath(`/purchase/purchase-orders/${po.id}`);
  redirect(`${VENDOR_INVOICES_PATH}/${invoice.id}`);
}

export async function setVendorInvoiceStatusAction(id: string, newStatus: VendorInvoiceStatus): Promise<void> {
  const session = await requireSession();
  const invoice = await prisma.vendorInvoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!invoice) return;

  if (newStatus === "CANCELLED") {
    if (!canCancelVendorInvoices(session.role)) {
      throw new Error("Only Owner/Admin can cancel a vendor invoice.");
    }
  } else {
    requireVendorInvoiceManager(session.role);
  }

  const allowed = VENDOR_INVOICE_STATUS_TRANSITIONS[invoice.status as VendorInvoiceStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${invoice.status} vendor invoice to ${newStatus}.`);
  }

  await prisma.vendorInvoice.update({
    where: { id },
    data: {
      status: newStatus,
      outstandingAmount: newStatus === "CANCELLED" ? 0 : invoice.grandTotal - invoice.paidAmount,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "VENDOR_INVOICE_STATUS_CHANGED",
    entityType: "VendorInvoice",
    entityId: id,
    before: { status: invoice.status },
    after: { status: newStatus },
  });

  revalidatePath(VENDOR_INVOICES_PATH);
  revalidatePath(`${VENDOR_INVOICES_PATH}/${id}`);
}
