import { z } from "zod";
import { optionalTrimmed } from "@/lib/energy/shared/form-fields";

const installItemSchema = z.object({
  projectItemId: z.string().trim().min(1),
  quantity: z.coerce.number(),
});

export const createInstallationFormSchema = z.object({
  siteId: optionalTrimmed,
  installationDate: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  technicianId: optionalTrimmed,
  notes: optionalTrimmed,
  items: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        const result = z.array(installItemSchema).safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({ code: "custom", message: "Installation items are invalid." });
          return z.NEVER;
        }
        return result.data.filter((row) => row.quantity > 0);
      } catch {
        ctx.addIssue({ code: "custom", message: "Installation items are invalid." });
        return z.NEVER;
      }
    }),
});

export type CreateInstallationFormValues = z.infer<typeof createInstallationFormSchema>;
