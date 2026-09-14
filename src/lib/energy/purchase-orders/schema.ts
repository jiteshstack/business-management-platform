import { z } from "zod";
import { optionalTrimmed, optionalNumber, optionalDate, itemsJsonField } from "@/lib/energy/shared/form-fields";

export const purchaseOrderFormSchema = z.object({
  vendorId: z.string().trim().min(1, "Select a vendor"),
  poDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  expectedDeliveryDate: optionalDate,
  referenceNumber: optionalTrimmed,
  notes: optionalTrimmed,
  termsAndConditions: optionalTrimmed,
  discountPercent: optionalNumber,
  otherCharges: optionalNumber,
  items: itemsJsonField,
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;
