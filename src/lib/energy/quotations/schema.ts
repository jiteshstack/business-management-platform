import { z } from "zod";
import { QUOTATION_TYPES } from "./types";
import { optionalTrimmed, optionalNumber, optionalDate, itemsJsonField } from "@/lib/energy/shared/form-fields";

export const quotationFormSchema = z.object({
  clientId: z.string().trim().min(1, "Select a client"),
  siteAddressId: optionalTrimmed,
  type: z.enum(QUOTATION_TYPES),
  quotationDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  validUntil: optionalDate,
  salespersonId: optionalTrimmed,
  reference: optionalTrimmed,
  subject: optionalTrimmed,
  notes: optionalTrimmed,
  paymentTerms: optionalTrimmed,
  equipmentWarranty: optionalTrimmed,
  installationWarranty: optionalTrimmed,
  deliveryTimeline: optionalTrimmed,
  installationTimeline: optionalTrimmed,
  termsAndConditions: optionalTrimmed,
  discountPercent: optionalNumber,
  otherCharges: optionalNumber,
  technicalConfigJson: optionalTrimmed,
  items: itemsJsonField,
});

export type QuotationFormValues = z.infer<typeof quotationFormSchema>;
