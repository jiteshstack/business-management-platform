import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { MovementType } from "./types";

export class StockRuleError extends Error {}

type TxClient = Prisma.TransactionClient | PrismaClient;

export type ApplyMovementInput = {
  companyId: string;
  productId: string;
  locationId: string;
  type: MovementType;
  quantity: number;
  reference?: string;
  reason?: string;
  notes?: string;
  userId?: string;
  serialNumbers?: string[];
};

// The single place that ever changes an InventoryBalance row. Every caller
// (stock in/out, adjustments, damage, reserve/release, returns, opening
// stock) goes through this so a movement record is always created and the
// business rules (no negative available, reserved never exceeds available,
// etc.) are enforced in exactly one spot.
export async function applyStockMovement(tx: TxClient, input: ApplyMovementInput) {
  if (input.quantity <= 0) {
    throw new StockRuleError("Quantity must be greater than zero.");
  }

  const balance =
    (await tx.inventoryBalance.findUnique({
      where: { productId_locationId: { productId: input.productId, locationId: input.locationId } },
    })) ??
    (await tx.inventoryBalance.create({
      data: {
        companyId: input.companyId,
        productId: input.productId,
        locationId: input.locationId,
        totalQty: 0,
        reservedQty: 0,
        damagedQty: 0,
      },
    }));

  const previousTotalQty = balance.totalQty;
  const previousReservedQty = balance.reservedQty;
  const previousDamagedQty = balance.damagedQty;
  const available = previousTotalQty - previousReservedQty - previousDamagedQty;

  let newTotalQty = previousTotalQty;
  let newReservedQty = previousReservedQty;
  let newDamagedQty = previousDamagedQty;

  switch (input.type) {
    case "STOCK_IN":
    case "OPENING_STOCK":
    case "RETURN":
    case "ADJUST_INCREASE":
      newTotalQty = previousTotalQty + input.quantity;
      break;
    case "STOCK_OUT":
    case "ADJUST_DECREASE":
      if (input.quantity > available) {
        throw new StockRuleError(
          `Only ${available} unit(s) are available - cannot remove ${input.quantity}.`
        );
      }
      newTotalQty = previousTotalQty - input.quantity;
      break;
    case "DAMAGE":
      if (input.quantity > available) {
        throw new StockRuleError(
          `Only ${available} unit(s) are available - cannot mark ${input.quantity} as damaged.`
        );
      }
      newDamagedQty = previousDamagedQty + input.quantity;
      break;
    case "RESERVE":
      if (input.quantity > available) {
        throw new StockRuleError(
          `Only ${available} unit(s) are available - cannot reserve ${input.quantity}.`
        );
      }
      newReservedQty = previousReservedQty + input.quantity;
      break;
    case "RESERVE_RELEASE":
      if (input.quantity > previousReservedQty) {
        throw new StockRuleError(
          `Only ${previousReservedQty} unit(s) are currently reserved - cannot release ${input.quantity}.`
        );
      }
      newReservedQty = previousReservedQty - input.quantity;
      break;
  }

  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { totalQty: newTotalQty, reservedQty: newReservedQty, damagedQty: newDamagedQty },
  });

  return tx.stockMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      locationId: input.locationId,
      type: input.type,
      quantity: input.quantity,
      reference: input.reference,
      reason: input.reason,
      notes: input.notes,
      userId: input.userId,
      previousTotalQty,
      newTotalQty,
      previousReservedQty,
      newReservedQty,
      previousDamagedQty,
      newDamagedQty,
      serialNumbersJson:
        input.serialNumbers && input.serialNumbers.length > 0
          ? JSON.stringify(input.serialNumbers)
          : null,
    },
  });
}
