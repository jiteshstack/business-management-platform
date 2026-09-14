import { z } from "zod";
import { optionalTrimmed, optionalNumber, optionalDate, itemsJsonField } from "@/lib/energy/shared/form-fields";

export const vendorInvoiceFormSchema = z.object({
  vendorId: z.string().trim().min(1, "Select a vendor"),
  vendorInvoiceNumber: optionalTrimmed,
  invoiceDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  dueDate: optionalDate,
  notes: optionalTrimmed,
  discountPercent: optionalNumber,
  otherCharges: optionalNumber,
  items: itemsJsonField,
});

export type VendorInvoiceFormValues = z.infer<typeof vendorInvoiceFormSchema>;
