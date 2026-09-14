"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManagePurchaseOrders, canCancelPurchaseOrders } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { purchaseOrderFormSchema } from "./schema";
import type { LineItemFormValues } from "@/lib/energy/shared/form-fields";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/energy/shared/pricing";
import { PURCHASE_ORDER_STATUS_TRANSITIONS, type PurchaseOrderStatus } from "./types";

const PURCHASE_ORDERS_PATH = "/purchase/purchase-orders";

function requirePurchaseOrderManager(role: Parameters<typeof canManagePurchaseOrders>[0]) {
  if (!canManagePurchaseOrders(role)) {
    throw new Error("You don't have permission to manage purchase orders.");
  }
}

function readPurchaseOrderForm(formData: FormData) {
  return {
    vendorId: str(formData, "vendorId"),
    poDate: str(formData, "poDate"),
    expectedDeliveryDate: str(formData, "expectedDeliveryDate"),
    referenceNumber: str(formData, "referenceNumber"),
    notes: str(formData, "notes"),
    termsAndConditions: str(formData, "termsAndConditions"),
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

export async function createPurchaseOrderAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requirePurchaseOrderManager(session.role);

  const parsed = purchaseOrderFormSchema.safeParse(readPurchaseOrderForm(formData));
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
  const poDate = new Date(values.poDate);

  const po = await prisma.$transaction(async (tx) => {
    const poNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "VPO", prefix: "VPO" });

    return tx.purchaseOrder.create({
      data: {
        companyId: session.companyId,
        poNumber,
        status: "DRAFT",
        vendorId: vendor.id,
        poDate,
        expectedDeliveryDate: values.expectedDeliveryDate ? new Date(values.expectedDeliveryDate) : null,
        referenceNumber: values.referenceNumber,
        notes: values.notes,
        termsAndConditions: values.termsAndConditions,
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
    action: "PURCHASE_ORDER_CREATED",
    entityType: "PurchaseOrder",
    entityId: po.id,
    after: { poNumber: po.poNumber, grandTotal: po.grandTotal },
  });

  revalidatePath(PURCHASE_ORDERS_PATH);
  redirect(`${PURCHASE_ORDERS_PATH}/${po.id}`);
}

export async function updatePurchaseOrderAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requirePurchaseOrderManager(session.role);

  const existing = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This purchase order no longer exists.", attempt: nextAttempt(_prevState) };
  }
  if (existing.status !== "DRAFT") {
    return { error: "Only draft purchase orders can be edited.", attempt: nextAttempt(_prevState) };
  }

  const parsed = purchaseOrderFormSchema.safeParse(readPurchaseOrderForm(formData));
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
  const poDate = new Date(values.poDate);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLineItem.deleteMany({ where: { purchaseOrderId: id } });
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        vendorId: vendor.id,
        poDate,
        expectedDeliveryDate: values.expectedDeliveryDate ? new Date(values.expectedDeliveryDate) : null,
        referenceNumber: values.referenceNumber,
        notes: values.notes,
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
    action: "PURCHASE_ORDER_UPDATED",
    entityType: "PurchaseOrder",
    entityId: id,
    after: { grandTotal: totals.grandTotal },
  });

  revalidatePath(PURCHASE_ORDERS_PATH);
  revalidatePath(`${PURCHASE_ORDERS_PATH}/${id}`);
  redirect(`${PURCHASE_ORDERS_PATH}/${id}`);
}

export async function setPurchaseOrderStatusAction(id: string, newStatus: PurchaseOrderStatus): Promise<void> {
  const session = await requireSession();
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId: session.companyId } });
  if (!po) return;

  if (newStatus === "CANCELLED") {
    if (!canCancelPurchaseOrders(session.role)) {
      throw new Error("Only Owner/Admin can cancel a purchase order.");
    }
  } else {
    requirePurchaseOrderManager(session.role);
  }

  const allowed = PURCHASE_ORDER_STATUS_TRANSITIONS[po.status as PurchaseOrderStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${po.status} purchase order to ${newStatus}.`);
  }

  await prisma.purchaseOrder.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PURCHASE_ORDER_STATUS_CHANGED",
    entityType: "PurchaseOrder",
    entityId: id,
    before: { status: po.status },
    after: { status: newStatus },
  });

  revalidatePath(PURCHASE_ORDERS_PATH);
  revalidatePath(`${PURCHASE_ORDERS_PATH}/${id}`);
}
