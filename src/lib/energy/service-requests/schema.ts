import { z } from "zod";
import { optionalTrimmed } from "@/lib/energy/shared/form-fields";
import { SERVICE_REQUEST_SOURCES, SERVICE_REQUEST_PRIORITIES, SERVICE_TYPES } from "./types";

export const serviceRequestFormSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  siteId: optionalTrimmed,
  projectId: optionalTrimmed,
  installedEquipmentId: optionalTrimmed,
  source: z.enum(SERVICE_REQUEST_SOURCES),
  requestDate: z.string().trim().min(1, "Request date is required"),
  issue: z.string().trim().min(1, "Describe the issue"),
  description: optionalTrimmed,
  priority: z.enum(SERVICE_REQUEST_PRIORITIES),
  serviceType: z.enum(SERVICE_TYPES),
  assignedToId: optionalTrimmed,
  expectedVisitDate: optionalTrimmed,
});

export type ServiceRequestFormValues = z.infer<typeof serviceRequestFormSchema>;

export const resolveServiceRequestFormSchema = z.object({
  resolution: z.string().trim().min(1, "Add a resolution note before resolving this request."),
});
