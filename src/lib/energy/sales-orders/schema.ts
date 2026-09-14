import { z } from "zod";
import { optionalTrimmed, optionalNumber, optionalDate, itemsJsonField } from "@/lib/energy/shared/form-fields";

export const salesOrderFormSchema = z.object({
  clientId: z.string().trim().min(1, "Select a client"),
  siteAddressId: optionalTrimmed,
  orderDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  expectedDeliveryDate: optionalDate,
  salespersonId: optionalTrimmed,
  paymentTerms: optionalTrimmed,
  notes: optionalTrimmed,
  discountPercent: optionalNumber,
  otherCharges: optionalNumber,
  items: itemsJsonField,
});

export type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;
