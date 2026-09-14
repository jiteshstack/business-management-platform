import { z } from "zod";
import { optionalTrimmed } from "@/lib/energy/shared/form-fields";

const receiveLineSchema = z.object({
  purchaseOrderLineItemId: z.string().trim().min(1),
  quantity: z.coerce.number(),
});

export const receiveGoodsFormSchema = z.object({
  locationId: z.string().trim().min(1, "Select a location"),
  receiptDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  notes: optionalTrimmed,
  items: z
    .string()
    .trim()
    .min(1, "Enter at least one received quantity")
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);
        const result = z.array(receiveLineSchema).safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({ code: "custom", message: "Received quantities are invalid." });
          return z.NEVER;
        }
        const withQuantity = result.data.filter((row) => row.quantity > 0);
        if (withQuantity.length === 0) {
          ctx.addIssue({ code: "custom", message: "Enter at least one received quantity greater than zero." });
          return z.NEVER;
        }
        return withQuantity;
      } catch {
        ctx.addIssue({ code: "custom", message: "Received quantities are invalid." });
        return z.NEVER;
      }
    }),
});

export type ReceiveGoodsFormValues = z.infer<typeof receiveGoodsFormSchema>;
