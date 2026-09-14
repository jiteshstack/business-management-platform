import { z } from "zod";
import { optionalTrimmed, optionalNumber } from "@/lib/energy/shared/form-fields";
import { PAYMENT_MODES } from "@/lib/energy/payments/types";

export const expenseFormSchema = z.object({
  expenseDate: z.string().trim().min(1, "Expense date is required"),
  categoryId: z.string().trim().min(1, "Choose a category"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  taxRate: optionalNumber,
  vendorId: optionalTrimmed,
  projectId: optionalTrimmed,
  siteId: optionalTrimmed,
  description: optionalTrimmed,
  referenceNumber: optionalTrimmed,
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const recordExpensePaymentFormSchema = z.object({
  amount: z.coerce.number().positive("Enter a payment amount greater than 0"),
  paymentDate: z.string().trim().min(1, "Payment date is required"),
  paymentMode: z.enum(PAYMENT_MODES),
  paymentReferenceNumber: optionalTrimmed,
});

export type RecordExpensePaymentFormValues = z.infer<typeof recordExpensePaymentFormSchema>;

export const expenseCategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  group: optionalTrimmed,
});
