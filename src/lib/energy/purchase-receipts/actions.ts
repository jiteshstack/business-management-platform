"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canReceivePurchases } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { receiveGoodsFormSchema } from "./schema";
import { receiveGoods, PurchaseOrderRuleError } from "@/lib/energy/purchase-orders/ledger";

const PURCHASE_ORDERS_PATH = "/purchase/purchase-orders";

export async function receiveGoodsAction(
  purchaseOrderId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  if (!canReceivePurchases(session.role)) {
    return { error: "You don't have permission to receive stock.", attempt: nextAttempt(_prevState) };
  }

  const parsed = receiveGoodsFormSchema.safeParse({
    locationId: str(formData, "locationId"),
    receiptDate: str(formData, "receiptDate"),
    notes: str(formData, "notes"),
    items: str(formData, "items") ?? "",
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

  const location = await prisma.location.findFirst({ where: { id: values.locationId, companyId: session.companyId } });
  if (!location) {
    return { error: "Select a valid location.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  let receiptId: string;
  try {
    receiptId = await prisma.$transaction(async (tx) => {
      const receiptNumber = await nextDocumentNumber(tx, {
        companyId: session.companyId,
        series: "PREC",
        prefix: "PREC",
      });
      const receipt = await receiveGoods(tx, {
        companyId: session.companyId,
        purchaseOrderId,
        locationId: location.id,
        receiptNumber,
        receiptDate: new Date(values.receiptDate),
        notes: values.notes,
        userId: session.userId,
        items: values.items.map((i) => ({ purchaseOrderLineItemId: i.purchaseOrderLineItemId, quantity: i.quantity })),
      });
      return receipt.id;
    });
  } catch (error) {
    if (error instanceof PurchaseOrderRuleError) {
      return { error: error.message, values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "STOCK_RECEIVED",
    entityType: "PurchaseReceipt",
    entityId: receiptId,
    after: { purchaseOrderId },
  });

  revalidatePath(PURCHASE_ORDERS_PATH);
  revalidatePath(`${PURCHASE_ORDERS_PATH}/${purchaseOrderId}`);
  revalidatePath("/purchase/purchase-receipts");
  redirect(`${PURCHASE_ORDERS_PATH}/${purchaseOrderId}?tab=receipts`);
}
