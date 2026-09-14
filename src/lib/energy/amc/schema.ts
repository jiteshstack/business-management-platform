import { z } from "zod";
import { optionalTrimmed, optionalNumber } from "@/lib/energy/shared/form-fields";
import { BILLING_FREQUENCIES } from "./types";

export const amcFormSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  siteId: optionalTrimmed,
  projectId: optionalTrimmed,
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().min(1, "End date is required"),
  contractValue: optionalNumber,
  // A <select> with an empty "-" option submits "" (a string), not the field
  // being absent — z.enum(...).optional() only treats `undefined` as unset,
  // so "" must be normalized to undefined first or this rejects the empty
  // option with "Invalid option" (found during Phase 12 UI smoke testing).
  billingFrequency: z.preprocess((value) => (value === "" ? undefined : value), z.enum(BILLING_FREQUENCIES).optional()),
  numberOfVisits: z.coerce.number().int().min(0).default(0),
  coverage: optionalTrimmed,
  exclusions: optionalTrimmed,
  notes: optionalTrimmed,
});

export type AmcFormValues = z.infer<typeof amcFormSchema>;
