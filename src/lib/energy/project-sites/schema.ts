import { z } from "zod";
import { optionalTrimmed } from "@/lib/energy/shared/form-fields";

export const projectSiteFormSchema = z.object({
  customerId: z.string().trim().min(1, "Select a customer"),
  name: z.string().trim().min(1, "Site name is required"),
  line1: z.string().trim().min(1, "Address line 1 is required"),
  line2: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,
  pincode: optionalTrimmed,
  landmark: optionalTrimmed,
  contactPerson: optionalTrimmed,
  contactPhone: optionalTrimmed,
  contactEmail: optionalTrimmed,
  notes: optionalTrimmed,
});

export type ProjectSiteFormValues = z.infer<typeof projectSiteFormSchema>;
