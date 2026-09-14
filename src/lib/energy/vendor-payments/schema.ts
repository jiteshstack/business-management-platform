import { z } from "zod";
import { optionalTrimmed, optionalDate } from "@/lib/energy/shared/form-fields";
import { PAYMENT_MODES } from "./types";

export const vendorPaymentFormSchema = z.object({
  vendorId: z.string().trim().min(1, "Select a vendor"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  mode: z.enum(PAYMENT_MODES),
  referenceNumber: optionalTrimmed,
  chequeNumber: optionalTrimmed,
  chequeDate: optionalDate,
  bankName: optionalTrimmed,
  notes: optionalTrimmed,
  // Optional single-invoice allocation at creation time (the "Record
  // Payment" flow from a Vendor Invoice detail page). Left blank, the
  // payment is created fully unallocated (an advance).
  vendorInvoiceId: optionalTrimmed,
});

export type VendorPaymentFormValues = z.infer<typeof vendorPaymentFormSchema>;

export const allocateVendorPaymentFormSchema = z.object({
  vendorInvoiceId: z.string().trim().min(1, "Select an invoice"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export type AllocateVendorPaymentFormValues = z.infer<typeof allocateVendorPaymentFormSchema>;
