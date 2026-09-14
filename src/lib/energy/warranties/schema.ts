import { z } from "zod";
import { optionalTrimmed } from "@/lib/energy/shared/form-fields";
import { WARRANTY_TYPES } from "./types";

export const warrantyFormSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  siteId: optionalTrimmed,
  projectId: optionalTrimmed,
  installedEquipmentId: optionalTrimmed,
  warrantyType: z.enum(WARRANTY_TYPES),
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().min(1, "End date is required"),
  durationMonths: z.coerce.number().int().min(0).optional().nullable(),
  terms: optionalTrimmed,
  coverage: optionalTrimmed,
  exclusions: optionalTrimmed,
  documentReference: optionalTrimmed,
});

export type WarrantyFormValues = z.infer<typeof warrantyFormSchema>;
