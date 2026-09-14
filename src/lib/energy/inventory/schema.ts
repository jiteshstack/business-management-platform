import { z } from "zod";
import { PRODUCT_TYPES } from "./types";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || !Number.isNaN(Number(value)), {
    message: "Enter a valid number",
  })
  .transform((value) => (value === undefined ? undefined : Number(value)));

const optionalInt = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || Number.isInteger(Number(value)), {
    message: "Enter a whole number",
  })
  .transform((value) => (value === undefined ? undefined : Number(value)));

export const productFormSchema = z.object({
  code: z.string().trim().min(1, "Product code is required").max(50),
  name: z.string().trim().min(1, "Product name is required").max(200),
  type: z.enum(PRODUCT_TYPES),
  categoryId: optionalTrimmed,
  brandId: optionalTrimmed,
  model: optionalTrimmed,
  description: optionalTrimmed,
  specifications: optionalTrimmed,
  unitId: optionalTrimmed,
  purchasePrice: optionalNumber,
  sellingPrice: optionalNumber,
  taxRate: optionalNumber,
  defaultVendorId: optionalTrimmed,
  warrantyMonths: optionalInt,
  serialTracked: z.boolean().default(false),
  stockTracked: z.boolean().default(true),
  reorderLevel: optionalNumber,
  isActive: z.boolean().default(true),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  group: optionalTrimmed,
});

export const brandFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const unitFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  abbreviation: optionalTrimmed,
});

const positiveQuantity = z
  .string()
  .trim()
  .refine((value) => Number(value) > 0 && !Number.isNaN(Number(value)), {
    message: "Enter a quantity greater than 0",
  })
  .transform((value) => Number(value));

function serialListFromText(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const stockInFormSchema = z.object({
  quantity: positiveQuantity,
  reference: optionalTrimmed,
  notes: optionalTrimmed,
  serialNumbers: optionalTrimmed,
});

export const openingStockFormSchema = stockInFormSchema;

export const stockOutFormSchema = z.object({
  quantity: positiveQuantity,
  reference: optionalTrimmed,
  notes: optionalTrimmed,
});

export const adjustStockFormSchema = z.object({
  direction: z.enum(["INCREASE", "DECREASE"]),
  quantity: positiveQuantity,
  reason: z.string().trim().min(1, "Reason is required").max(300),
  notes: optionalTrimmed,
});

export const damageStockFormSchema = z.object({
  quantity: positiveQuantity,
  reason: z.string().trim().min(1, "Reason is required").max(300),
  notes: optionalTrimmed,
});

export const returnStockFormSchema = z.object({
  quantity: positiveQuantity,
  reference: optionalTrimmed,
  notes: optionalTrimmed,
});

export const reserveStockFormSchema = z.object({
  quantity: positiveQuantity,
  reference: optionalTrimmed,
  notes: optionalTrimmed,
});

export const releaseReservationFormSchema = z.object({
  quantity: positiveQuantity,
  notes: optionalTrimmed,
});

export { serialListFromText };
