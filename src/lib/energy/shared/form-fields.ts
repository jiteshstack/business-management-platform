import { z } from "zod";

// Common zod field helpers + the line-item shape, shared by Quotations,
// Sales Orders, and Invoices so the three document types validate identical
// data the same way rather than three near-copies drifting apart.

export const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || !Number.isNaN(Number(value)), {
    message: "Enter a valid number",
  })
  .transform((value) => (value === undefined ? undefined : Number(value)));

export const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date",
  });

export const lineItemSchema = z.object({
  productId: z.string().trim().min(1, "Choose a product"),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitPrice: z.coerce.number().min(0, "Rate cannot be negative"),
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
});

export type LineItemFormValues = z.infer<typeof lineItemSchema>;

// The line-items editor always submits one hidden field containing a
// JSON-encoded array — this parses + validates it consistently everywhere.
export const itemsJsonField = z
  .string()
  .trim()
  .min(1, "Add at least one line item")
  .transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value);
      const result = z.array(lineItemSchema).min(1, "Add at least one line item").safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: "One or more line items are invalid." });
        return z.NEVER;
      }
      return result.data;
    } catch {
      ctx.addIssue({ code: "custom", message: "Add at least one line item." });
      return z.NEVER;
    }
  });
