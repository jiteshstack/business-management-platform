import { z } from "zod";
import { optionalTrimmed, optionalNumber, optionalDate, itemsJsonField } from "@/lib/energy/shared/form-fields";

export const invoiceFormSchema = z.object({
  clientId: z.string().trim().min(1, "Select a client"),
  siteAddressId: optionalTrimmed,
  billingAddressId: optionalTrimmed,
  invoiceDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  dueDate: optionalDate,
  paymentTerms: optionalTrimmed,
  notes: optionalTrimmed,
  discountPercent: optionalNumber,
  otherCharges: optionalNumber,
  items: itemsJsonField,
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
