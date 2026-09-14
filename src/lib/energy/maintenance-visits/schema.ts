import { z } from "zod";
import { optionalTrimmed } from "@/lib/energy/shared/form-fields";
import { VISIT_TYPES } from "./types";

export const createMaintenanceVisitFormSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  siteId: optionalTrimmed,
  projectId: optionalTrimmed,
  installedEquipmentId: optionalTrimmed,
  serviceRequestId: optionalTrimmed,
  amcId: optionalTrimmed,
  technicianId: optionalTrimmed,
  visitType: z.enum(VISIT_TYPES),
  visitDate: z.string().trim().min(1, "Visit date is required"),
});

export type CreateMaintenanceVisitFormValues = z.infer<typeof createMaintenanceVisitFormSchema>;

const partUsageSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  locationId: z.string().trim().min(1),
});

export const completeMaintenanceVisitFormSchema = z.object({
  findings: optionalTrimmed,
  workPerformed: z.string().trim().min(1, "Describe the work performed before completing this visit."),
  result: optionalTrimmed,
  customerRemarks: optionalTrimmed,
  technicianRemarks: optionalTrimmed,
  nextMaintenanceDate: optionalTrimmed,
  partsUsed: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : "[]"))
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);
        const result = z.array(partUsageSchema).safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({ code: "custom", message: "One or more parts used are invalid." });
          return z.NEVER;
        }
        return result.data;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid parts used data." });
        return z.NEVER;
      }
    }),
});

export type CompleteMaintenanceVisitFormValues = z.infer<typeof completeMaintenanceVisitFormSchema>;
