"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { canManageInventory } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { applyStockMovement, StockRuleError } from "./ledger";
import { getDefaultLocation } from "./queries";
import {
  productFormSchema,
  categoryFormSchema,
  brandFormSchema,
  unitFormSchema,
  stockInFormSchema,
  stockOutFormSchema,
  adjustStockFormSchema,
  damageStockFormSchema,
  returnStockFormSchema,
  reserveStockFormSchema,
  releaseReservationFormSchema,
  serialListFromText,
} from "./schema";
import type { MovementType, SerialStatus } from "./types";

const PRODUCTS_PATH = "/inventory/products";

function requireInventoryManager(role: Parameters<typeof canManageInventory>[0]) {
  if (!canManageInventory(role)) {
    throw new Error("You don't have permission to manage inventory.");
  }
}

function readProductForm(formData: FormData) {
  return {
    code: str(formData, "code"),
    name: str(formData, "name"),
    type: str(formData, "type"),
    categoryId: str(formData, "categoryId"),
    brandId: str(formData, "brandId"),
    model: str(formData, "model"),
    description: str(formData, "description"),
    specifications: str(formData, "specifications"),
    unitId: str(formData, "unitId"),
    purchasePrice: str(formData, "purchasePrice"),
    sellingPrice: str(formData, "sellingPrice"),
    taxRate: str(formData, "taxRate"),
    defaultVendorId: str(formData, "defaultVendorId"),
    warrantyMonths: str(formData, "warrantyMonths"),
    serialTracked: formData.get("serialTracked") === "on",
    stockTracked: formData.get("stockTracked") === "on",
    reorderLevel: str(formData, "reorderLevel"),
    isActive: formData.get("isActive") === "on",
  };
}

// Business rule: Service products never track physical stock; serial
// tracking always implies stock tracking (you can't track individual units
// of something you don't count).
function normalizeTrackingFlags(values: {
  type: string;
  serialTracked: boolean;
  stockTracked: boolean;
}) {
  if (values.type === "SERVICE") {
    return { serialTracked: false, stockTracked: false };
  }
  if (values.serialTracked) {
    return { serialTracked: true, stockTracked: true };
  }
  return { serialTracked: values.serialTracked, stockTracked: values.stockTracked };
}

export async function createProductAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = productFormSchema.safeParse(readProductForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;
  const tracking = normalizeTrackingFlags(values);

  const existingCode = await prisma.product.findFirst({
    where: { companyId: session.companyId, code: { equals: values.code } },
  });
  if (existingCode) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { code: "This product code is already in use." },
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  const product = await prisma.product.create({
    data: {
      companyId: session.companyId,
      code: values.code,
      name: values.name,
      type: values.type,
      categoryId: values.categoryId,
      brandId: values.brandId,
      model: values.model,
      description: values.description,
      specifications: values.specifications,
      unitId: values.unitId,
      purchasePrice: values.purchasePrice,
      sellingPrice: values.sellingPrice,
      taxRate: values.taxRate,
      defaultVendorId: values.defaultVendorId,
      warrantyMonths: values.warrantyMonths,
      reorderLevel: values.reorderLevel,
      isActive: true,
      ...tracking,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    after: { code: product.code, name: product.name },
  });

  revalidatePath(PRODUCTS_PATH);
  redirect(`${PRODUCTS_PATH}/${product.id}`);
}

export async function updateProductAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = productFormSchema.safeParse(readProductForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;
  const tracking = normalizeTrackingFlags(values);

  const existing = await prisma.product.findFirst({
    where: { id: productId, companyId: session.companyId },
  });
  if (!existing) {
    return { error: "This product no longer exists.", attempt: nextAttempt(_prevState) };
  }

  const codeOwner = await prisma.product.findFirst({
    where: { companyId: session.companyId, code: values.code, NOT: { id: productId } },
  });
  if (codeOwner) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { code: "This product code is already in use." },
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      code: values.code,
      name: values.name,
      type: values.type,
      categoryId: values.categoryId,
      brandId: values.brandId,
      model: values.model,
      description: values.description,
      specifications: values.specifications,
      unitId: values.unitId,
      purchasePrice: values.purchasePrice,
      sellingPrice: values.sellingPrice,
      taxRate: values.taxRate,
      defaultVendorId: values.defaultVendorId,
      warrantyMonths: values.warrantyMonths,
      reorderLevel: values.reorderLevel,
      isActive: values.isActive,
      ...tracking,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: productId,
    before: { name: existing.name, isActive: existing.isActive },
    after: { name: values.name, isActive: values.isActive },
  });

  revalidatePath(PRODUCTS_PATH);
  revalidatePath(`${PRODUCTS_PATH}/${productId}`);
  redirect(`${PRODUCTS_PATH}/${productId}`);
}

export async function setProductActiveAction(productId: string, isActive: boolean): Promise<void> {
  const session = await requireSession();
  const existing = await prisma.product.findFirst({
    where: { id: productId, companyId: session.companyId },
  });
  if (!existing) return;

  await prisma.product.update({ where: { id: productId }, data: { isActive } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: isActive ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    entityType: "Product",
    entityId: productId,
  });

  revalidatePath(PRODUCTS_PATH);
  revalidatePath(`${PRODUCTS_PATH}/${productId}`);
}

// ---- Categories / Brands / Units (Settings) ----

export async function createCategoryAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = categoryFormSchema.safeParse({ name: str(formData, "name"), group: str(formData, "group") });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }
  const existing = await prisma.category.findFirst({
    where: { companyId: session.companyId, name: parsed.data.name },
  });
  if (existing) {
    return { error: "A category with this name already exists." };
  }
  await prisma.category.create({ data: { companyId: session.companyId, ...parsed.data } });
  revalidatePath("/settings");
  return {};
}

export async function setCategoryActiveAction(categoryId: string, isActive: boolean): Promise<void> {
  const session = await requireSession();
  await prisma.category.updateMany({
    where: { id: categoryId, companyId: session.companyId },
    data: { isActive },
  });
  revalidatePath("/settings");
}

export async function createBrandAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = brandFormSchema.safeParse({ name: str(formData, "name") });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }
  const existing = await prisma.brand.findFirst({
    where: { companyId: session.companyId, name: parsed.data.name },
  });
  if (existing) {
    return { error: "A brand with this name already exists." };
  }
  await prisma.brand.create({ data: { companyId: session.companyId, ...parsed.data } });
  revalidatePath("/settings");
  return {};
}

export async function setBrandActiveAction(brandId: string, isActive: boolean): Promise<void> {
  const session = await requireSession();
  await prisma.brand.updateMany({
    where: { id: brandId, companyId: session.companyId },
    data: { isActive },
  });
  revalidatePath("/settings");
}

export async function createUnitAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = unitFormSchema.safeParse({
    name: str(formData, "name"),
    abbreviation: str(formData, "abbreviation"),
  });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }
  const existing = await prisma.unit.findFirst({
    where: { companyId: session.companyId, name: parsed.data.name },
  });
  if (existing) {
    return { error: "A unit with this name already exists." };
  }
  await prisma.unit.create({ data: { companyId: session.companyId, ...parsed.data } });
  revalidatePath("/settings");
  return {};
}

export async function setUnitActiveAction(unitId: string, isActive: boolean): Promise<void> {
  const session = await requireSession();
  await prisma.unit.updateMany({
    where: { id: unitId, companyId: session.companyId },
    data: { isActive },
  });
  revalidatePath("/settings");
}

// ---- Stock movements ----

async function loadStockableProduct(companyId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
  if (!product) throw new Error("This product no longer exists.");
  if (!product.stockTracked) throw new Error("This product does not track stock.");
  return product;
}

async function runMovement(params: {
  companyId: string;
  userId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reference?: string;
  reason?: string;
  notes?: string;
  serialNumbers?: string[];
}): Promise<FormActionState> {
  const location = await getDefaultLocation(params.companyId);

  try {
    await prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        companyId: params.companyId,
        productId: params.productId,
        locationId: location.id,
        type: params.type,
        quantity: params.quantity,
        reference: params.reference,
        reason: params.reason,
        notes: params.notes,
        userId: params.userId,
        serialNumbers: params.serialNumbers,
      });

      if (params.serialNumbers && params.serialNumbers.length > 0) {
        for (const serialNumber of params.serialNumbers) {
          await tx.serialNumber.create({
            data: {
              companyId: params.companyId,
              productId: params.productId,
              serialNumber,
              status: "IN_STOCK",
              locationId: location.id,
            },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof StockRuleError) {
      return { error: error.message };
    }
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: "One of those serial numbers is already recorded for this product." };
    }
    throw error;
  }

  await recordAudit({
    companyId: params.companyId,
    userId: params.userId,
    action: `STOCK_${params.type}`,
    entityType: "Product",
    entityId: params.productId,
    after: { type: params.type, quantity: params.quantity },
  });

  revalidatePath(`${PRODUCTS_PATH}/${params.productId}`);
  revalidatePath("/inventory/stock");
  return {};
}

function requireSerialCountMatch(quantity: number, serialNumbers: string[], serialTracked: boolean) {
  if (!serialTracked) return undefined;
  if (serialNumbers.length === 0) {
    return "This product is serial-tracked - list one serial number per line (or comma-separated).";
  }
  if (serialNumbers.length !== quantity) {
    return `Quantity is ${quantity} but ${serialNumbers.length} serial number(s) were entered - they must match.`;
  }
  const unique = new Set(serialNumbers);
  if (unique.size !== serialNumbers.length) {
    return "Serial numbers must be unique.";
  }
  return undefined;
}

export async function stockInAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  const product = await loadStockableProduct(session.companyId, productId);

  const parsed = stockInFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
    serialNumbers: str(formData, "serialNumbers"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  const serials = serialListFromText(parsed.data.serialNumbers);
  const serialError = requireSerialCountMatch(parsed.data.quantity, serials, product.serialTracked);
  if (serialError) {
    return { error: serialError, values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "STOCK_IN",
    quantity: parsed.data.quantity,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    serialNumbers: serials,
  });
}

export async function openingStockAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  const product = await loadStockableProduct(session.companyId, productId);

  const parsed = stockInFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
    serialNumbers: str(formData, "serialNumbers"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  const serials = serialListFromText(parsed.data.serialNumbers);
  const serialError = requireSerialCountMatch(parsed.data.quantity, serials, product.serialTracked);
  if (serialError) {
    return { error: serialError, values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "OPENING_STOCK",
    quantity: parsed.data.quantity,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    serialNumbers: serials,
  });
}

export async function stockOutAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  await loadStockableProduct(session.companyId, productId);

  const parsed = stockOutFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "STOCK_OUT",
    quantity: parsed.data.quantity,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
  });
}

export async function adjustStockAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  await loadStockableProduct(session.companyId, productId);

  const parsed = adjustStockFormSchema.safeParse({
    direction: str(formData, "direction"),
    quantity: str(formData, "quantity") ?? "",
    reason: str(formData, "reason") ?? "",
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: parsed.data.direction === "INCREASE" ? "ADJUST_INCREASE" : "ADJUST_DECREASE",
    quantity: parsed.data.quantity,
    reason: parsed.data.reason,
    notes: parsed.data.notes,
  });
}

export async function damageStockAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  await loadStockableProduct(session.companyId, productId);

  const parsed = damageStockFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    reason: str(formData, "reason") ?? "",
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "DAMAGE",
    quantity: parsed.data.quantity,
    reason: parsed.data.reason,
    notes: parsed.data.notes,
  });
}

export async function returnStockAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  await loadStockableProduct(session.companyId, productId);

  const parsed = returnStockFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "RETURN",
    quantity: parsed.data.quantity,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
  });
}

export async function reserveStockAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  await loadStockableProduct(session.companyId, productId);

  const parsed = reserveStockFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    reference: str(formData, "reference"),
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "RESERVE",
    quantity: parsed.data.quantity,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
  });
}

export async function releaseReservationAction(
  productId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);
  await loadStockableProduct(session.companyId, productId);

  const parsed = releaseReservationFormSchema.safeParse({
    quantity: str(formData, "quantity") ?? "",
    notes: str(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  return runMovement({
    companyId: session.companyId,
    userId: session.userId,
    productId,
    type: "RESERVE_RELEASE",
    quantity: parsed.data.quantity,
    notes: parsed.data.notes,
  });
}

// ---- Serial numbers ----

export async function updateSerialStatusAction(
  serialId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInventoryManager(session.role);

  const serial = await prisma.serialNumber.findFirst({
    where: { id: serialId, companyId: session.companyId },
  });
  if (!serial) return { error: "This serial number no longer exists." };

  const newStatus = str(formData, "status") as SerialStatus | undefined;
  const notes = str(formData, "notes");
  if (!newStatus) {
    return { error: "Choose a status." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (serial.status !== "DAMAGED" && newStatus === "DAMAGED") {
        const location = await getDefaultLocation(session.companyId);
        await applyStockMovement(tx, {
          companyId: session.companyId,
          productId: serial.productId,
          locationId: location.id,
          type: "DAMAGE",
          quantity: 1,
          reference: `Serial ${serial.serialNumber}`,
          userId: session.userId,
        });
      }
      await tx.serialNumber.update({
        where: { id: serialId },
        data: { status: newStatus, notes: notes ?? serial.notes },
      });
    });
  } catch (error) {
    if (error instanceof StockRuleError) {
      return { error: error.message };
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SERIAL_STATUS_CHANGED",
    entityType: "Product",
    entityId: serial.productId,
    before: { serialNumber: serial.serialNumber, status: serial.status },
    after: { serialNumber: serial.serialNumber, status: newStatus },
  });

  revalidatePath(`${PRODUCTS_PATH}/${serial.productId}`);
  return {};
}
