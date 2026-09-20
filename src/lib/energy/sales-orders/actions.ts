"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageSalesOrders, canCancelSalesOrders } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { salesOrderFormSchema } from "./schema";
import { resolveSiteSelection } from "@/lib/energy/shared/site-selection";
import type { LineItemFormValues } from "@/lib/energy/shared/form-fields";
import { calculateLineItem, calculateDocumentTotals } from "@/lib/energy/shared/pricing";
import { applyStockMovement, StockRuleError } from "@/lib/energy/inventory/ledger";
import { getDefaultLocation } from "@/lib/energy/inventory/queries";
import { SALES_ORDER_STATUS_TRANSITIONS, type SalesOrderStatus } from "./types";

const SALES_ORDERS_PATH = "/sales/sales-orders";

function requireSalesOrderManager(role: Parameters<typeof canManageSalesOrders>[0]) {
  if (!canManageSalesOrders(role)) {
    throw new Error("You don't have permission to manage sales orders.");
  }
}

function readSalesOrderForm(formData: FormData) {
  return {
    clientId: str(formData, "clientId"),
    siteSelection: str(formData, "siteSelection"),
    orderDate: str(formData, "orderDate"),
    expectedDeliveryDate: str(formData, "expectedDeliveryDate"),
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

export async function createSalesOrderAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireSalesOrderManager(session.role);

  const parsed = salesOrderFormSchema.safeParse(readSalesOrderForm(formData));
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

  let siteId: string | null;
  let siteAddressId: string | null;
  let siteAddressText: string | undefined;
  try {
    const resolved = await resolveSiteSelection({
      companyId: session.companyId,
      clientId: client.id,
      siteSelection: values.siteSelection,
    });
    siteId = resolved.siteId;
    siteAddressId = resolved.siteAddressId;
    siteAddressText = resolved.siteAddressText;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid site.",
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
  const orderDate = new Date(values.orderDate);

  const salesOrder = await prisma.$transaction(async (tx) => {
    const soNumber = await nextDocumentNumber(tx, {
      companyId: session.companyId,
      series: "SO",
      prefix: "SO",
    });

    return tx.salesOrder.create({
      data: {
        companyId: session.companyId,
        soNumber,
        status: "DRAFT",
        clientId: client.id,
        siteId,
        siteAddressId,
        siteAddressText,
        orderDate,
        expectedDeliveryDate: values.expectedDeliveryDate ? new Date(values.expectedDeliveryDate) : null,
        paymentTerms: values.paymentTerms,
        notes: values.notes,
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
    action: "SALES_ORDER_CREATED",
    entityType: "SalesOrder",
    entityId: salesOrder.id,
    after: { soNumber: salesOrder.soNumber, grandTotal: salesOrder.grandTotal },
  });

  revalidatePath(SALES_ORDERS_PATH);
  redirect(`${SALES_ORDERS_PATH}/${salesOrder.id}`);
}

export async function updateSalesOrderAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireSalesOrderManager(session.role);

  const existing = await prisma.salesOrder.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This sales order no longer exists.", attempt: nextAttempt(_prevState) };
  }
  if (existing.status !== "DRAFT") {
    return { error: "Only draft sales orders can be edited.", attempt: nextAttempt(_prevState) };
  }

  const parsed = salesOrderFormSchema.safeParse(readSalesOrderForm(formData));
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

  let siteId: string | null;
  let siteAddressId: string | null;
  let siteAddressText: string | undefined;
  try {
    const resolved = await resolveSiteSelection({
      companyId: session.companyId,
      clientId: client.id,
      siteSelection: values.siteSelection,
    });
    siteId = resolved.siteId;
    siteAddressId = resolved.siteAddressId;
    siteAddressText = resolved.siteAddressText;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid site.",
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
  const orderDate = new Date(values.orderDate);

  await prisma.$transaction(async (tx) => {
    await tx.salesOrderLineItem.deleteMany({ where: { salesOrderId: id } });
    await tx.salesOrder.update({
      where: { id },
      data: {
        clientId: client.id,
        siteId,
        siteAddressId,
        siteAddressText,
        orderDate,
        expectedDeliveryDate: values.expectedDeliveryDate ? new Date(values.expectedDeliveryDate) : null,
        paymentTerms: values.paymentTerms,
        notes: values.notes,
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
    action: "SALES_ORDER_UPDATED",
    entityType: "SalesOrder",
    entityId: id,
    after: { grandTotal: totals.grandTotal },
  });

  revalidatePath(SALES_ORDERS_PATH);
  revalidatePath(`${SALES_ORDERS_PATH}/${id}`);
  redirect(`${SALES_ORDERS_PATH}/${id}`);
}

// Creates a Sales Order directly from an approved quotation, copying its line
// items as a snapshot (never a live link) so later quotation edits/revisions
// never retroactively change an already-created order.
export async function createSalesOrderFromQuotationAction(quotationId: string): Promise<void> {
  const session = await requireSession();
  requireSalesOrderManager(session.role);

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId: session.companyId },
    include: { items: true },
  });
  if (!quotation) throw new Error("This quotation no longer exists.");
  if (quotation.status !== "APPROVED") {
    throw new Error("Only an approved quotation can be converted to a sales order.");
  }

  const salesOrder = await prisma.$transaction(async (tx) => {
    const soNumber = await nextDocumentNumber(tx, {
      companyId: session.companyId,
      series: "SO",
      prefix: "SO",
    });

    return tx.salesOrder.create({
      data: {
        companyId: session.companyId,
        soNumber,
        status: "DRAFT",
        clientId: quotation.clientId,
        siteId: quotation.siteId,
        siteAddressId: quotation.siteAddressId,
        siteAddressText: quotation.siteAddressText,
        quotationId: quotation.id,
        orderDate: new Date(),
        paymentTerms: quotation.paymentTerms,
        notes: quotation.notes,
        discountPercent: quotation.discountPercent,
        subtotal: quotation.subtotal,
        discountAmount: quotation.discountAmount,
        taxableAmount: quotation.taxableAmount,
        taxAmount: quotation.taxAmount,
        otherCharges: quotation.otherCharges,
        grandTotal: quotation.grandTotal,
        createdBy: session.userId,
        items: {
          create: quotation.items.map((item, index) => ({
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
    action: "SALES_ORDER_CREATED_FROM_QUOTATION",
    entityType: "SalesOrder",
    entityId: salesOrder.id,
    before: { quotationNumber: quotation.quotationNumber },
    after: { soNumber: salesOrder.soNumber },
  });

  revalidatePath(SALES_ORDERS_PATH);
  revalidatePath(`/sales/quotations/${quotation.id}`);
  redirect(`${SALES_ORDERS_PATH}/${salesOrder.id}`);
}

export async function setSalesOrderStatusAction(id: string, newStatus: SalesOrderStatus): Promise<void> {
  const session = await requireSession();
  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: { items: true },
  });
  if (!salesOrder) return;

  if (newStatus === "CANCELLED") {
    if (!canCancelSalesOrders(session.role)) {
      throw new Error("Only Owner/Admin can cancel a sales order.");
    }
  } else {
    requireSalesOrderManager(session.role);
  }

  const allowed = SALES_ORDER_STATUS_TRANSITIONS[salesOrder.status as SalesOrderStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${salesOrder.status} sales order to ${newStatus}.`);
  }

  const defaultLocation = await getDefaultLocation(session.companyId);

  try {
    await prisma.$transaction(async (tx) => {
      if (newStatus === "CONFIRMED" && !salesOrder.stockReserved) {
        for (const item of salesOrder.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product?.stockTracked) continue;
          await applyStockMovement(tx, {
            companyId: session.companyId,
            productId: item.productId,
            locationId: defaultLocation.id,
            type: "RESERVE",
            quantity: item.quantity,
            reference: salesOrder.soNumber,
            reason: "Sales order confirmed",
            userId: session.userId,
          });
        }
        await tx.salesOrder.update({ where: { id }, data: { status: newStatus, stockReserved: true } });
      } else if (newStatus === "CANCELLED" && salesOrder.stockReserved) {
        for (const item of salesOrder.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product?.stockTracked) continue;
          await applyStockMovement(tx, {
            companyId: session.companyId,
            productId: item.productId,
            locationId: defaultLocation.id,
            type: "RESERVE_RELEASE",
            quantity: item.quantity,
            reference: salesOrder.soNumber,
            reason: "Sales order cancelled",
            userId: session.userId,
          });
        }
        await tx.salesOrder.update({ where: { id }, data: { status: newStatus, stockReserved: false } });
      } else {
        await tx.salesOrder.update({ where: { id }, data: { status: newStatus } });
      }
    });
  } catch (error) {
    if (error instanceof StockRuleError) {
      throw new Error(`Cannot confirm this sales order - insufficient stock: ${error.message}`);
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SALES_ORDER_STATUS_CHANGED",
    entityType: "SalesOrder",
    entityId: id,
    before: { status: salesOrder.status },
    after: { status: newStatus },
  });

  revalidatePath(SALES_ORDERS_PATH);
  revalidatePath(`${SALES_ORDERS_PATH}/${id}`);
}
