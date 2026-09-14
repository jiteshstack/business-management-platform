import { z } from "zod";
import { optionalTrimmed, optionalDate } from "@/lib/energy/shared/form-fields";
import { PAYMENT_MODES } from "./types";

export const paymentFormSchema = z.object({
  clientId: z.string().trim().min(1, "Select a client"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  mode: z.enum(PAYMENT_MODES),
  referenceNumber: optionalTrimmed,
  chequeNumber: optionalTrimmed,
  chequeDate: optionalDate,
  bankName: optionalTrimmed,
  notes: optionalTrimmed,
  // Optional single-invoice allocation at creation time (the "Record
  // Payment" flow from an Invoice detail page — the full amount is applied
  // to this invoice). Left blank, the payment is created fully unallocated
  // (an advance / to be allocated later from the payment detail page).
  invoiceId: optionalTrimmed,
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const allocateFormSchema = z.object({
  invoiceId: z.string().trim().min(1, "Select an invoice"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export type AllocateFormValues = z.infer<typeof allocateFormSchema>;
