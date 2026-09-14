import { z } from "zod";
import { optionalTrimmed, optionalDate } from "@/lib/energy/shared/form-fields";
import { PROJECT_TYPES, PROJECT_PRIORITIES } from "./types";

export const projectFormSchema = z.object({
  customerId: z.string().trim().min(1, "Select a customer"),
  salesOrderId: optionalTrimmed,
  siteId: optionalTrimmed,
  name: z.string().trim().min(1, "Project name is required"),
  type: z.enum(PROJECT_TYPES),
  priority: z.enum(PROJECT_PRIORITIES),
  description: optionalTrimmed,
  startDate: optionalDate,
  expectedCompletionDate: optionalDate,
  projectManagerId: optionalTrimmed,
  notes: optionalTrimmed,
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
