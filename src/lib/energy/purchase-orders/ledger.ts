import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { round2 } from "@/lib/energy/shared/pricing";
import { applyStockMovement, StockRuleError } from "@/lib/energy/inventory/ledger";
import { RECEIVABLE_PO_STATUSES } from "./types";

export class PurchaseOrderRuleError extends Error {}

type TxClient = Prisma.TransactionClient | PrismaClient;

async function recomputeLineReceivedQuantity(tx: TxClient, purchaseOrderLineItemId: string): Promise<void> {
  const agg = await tx.purchaseReceiptLineItem.aggregate({
    where: { purchaseOrderLineItemId },
    _sum: { quantity: true },
  });
  await tx.purchaseOrderLineItem.update({
    where: { id: purchaseOrderLineItemId },
    data: { receivedQuantity: round2(agg._sum.quantity ?? 0) },
  });
}

async function recomputePurchaseOrderStatus(tx: TxClient, purchaseOrderId: string): Promise<void> {
  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (!RECEIVABLE_PO_STATUSES.includes(po.status as (typeof RECEIVABLE_PO_STATUSES)[number])) {
    // Not in a receivable state (shouldn't happen — receiving is blocked
    // earlier — but never silently overwrite Cancelled/Closed/Draft/Sent).
    return;
  }
  const fullyReceived = po.items.every((item) => item.receivedQuantity + 0.005 >= item.quantity);
  const status = fullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";
  if (status !== po.status) {
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });
  }
}

export type ReceiveGoodsItemInput = { purchaseOrderLineItemId: string; quantity: number };

// The only code path allowed to create PurchaseReceipt(LineItem) rows,
// apply the corresponding STOCK_IN movements, and recompute a PO's
// received/pending quantities and status. Mirrors
// src/lib/energy/inventory/ledger.ts (stock) and
// src/lib/energy/payments/ledger.ts (money) — one recompute-from-source
// function per derived field, never an ad hoc increment.
export async function receiveGoods(
  tx: TxClient,
  input: {
    companyId: string;
    purchaseOrderId: string;
    locationId: string;
    receiptNumber: string;
    receiptDate: Date;
    notes?: string;
    userId?: string;
    items: ReceiveGoodsItemInput[];
  }
): Promise<{ id: string }> {
  const { companyId, purchaseOrderId, locationId, receiptNumber, receiptDate, notes, userId, items } = input;

  if (items.length === 0) {
    throw new PurchaseOrderRuleError("Select at least one item to receive.");
  }

  const po = await tx.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, companyId },
    include: { items: true },
  });
  if (!po) throw new PurchaseOrderRuleError("This purchase order no longer exists.");
  if (!RECEIVABLE_PO_STATUSES.includes(po.status as (typeof RECEIVABLE_PO_STATUSES)[number])) {
    throw new PurchaseOrderRuleError(
      `A ${po.status.replaceAll("_", " ").toLowerCase()} purchase order cannot receive stock. Confirm it first.`
    );
  }

  const lineItemById = new Map(po.items.map((li) => [li.id, li]));
  const receiptLineData: {
    purchaseOrderLineItemId: string;
    productId: string | null;
    productName: string;
    quantity: number;
    sortOrder: number;
  }[] = [];

  let sortOrder = 0;
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new PurchaseOrderRuleError("Received quantity must be greater than zero.");
    }
    const lineItem = lineItemById.get(item.purchaseOrderLineItemId);
    if (!lineItem) {
      throw new PurchaseOrderRuleError("One of the selected items does not belong to this purchase order.");
    }
    const pending = round2(lineItem.quantity - lineItem.receivedQuantity);
    if (item.quantity > pending + 0.005) {
      throw new PurchaseOrderRuleError(
        `Only ${pending} unit(s) of "${lineItem.productName}" are pending - cannot receive ${item.quantity}.`
      );
    }
    receiptLineData.push({
      purchaseOrderLineItemId: lineItem.id,
      productId: lineItem.productId,
      productName: lineItem.productName,
      quantity: item.quantity,
      sortOrder: sortOrder++,
    });
  }

  const receipt = await tx.purchaseReceipt.create({
    data: {
      companyId,
      receiptNumber,
      purchaseOrderId,
      vendorId: po.vendorId,
      locationId,
      receiptDate,
      notes,
      createdBy: userId,
      items: { create: receiptLineData },
    },
  });

  try {
    for (const line of receiptLineData) {
      if (!line.productId) continue;
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product?.stockTracked) continue;
      await applyStockMovement(tx, {
        companyId,
        productId: line.productId,
        locationId,
        type: "STOCK_IN",
        quantity: line.quantity,
        reference: receiptNumber,
        reason: "Purchase receipt",
        userId,
      });
    }
  } catch (error) {
    if (error instanceof StockRuleError) {
      throw new PurchaseOrderRuleError(error.message);
    }
    throw error;
  }

  for (const line of receiptLineData) {
    await recomputeLineReceivedQuantity(tx, line.purchaseOrderLineItemId);
  }
  await recomputePurchaseOrderStatus(tx, purchaseOrderId);

  return { id: receipt.id };
}
