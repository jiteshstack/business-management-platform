import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

// Statutory / print profile — every field optional since nothing forces this
// to be filled in before the app is otherwise usable (see Company.gstin etc.
// in schema.prisma).
export const companyProfileFormSchema = z.object({
  gstin: optionalTrimmed,
  pan: optionalTrimmed,
  addressLine1: optionalTrimmed,
  addressLine2: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,
  pincode: optionalTrimmed,
  phone: optionalTrimmed,
  email: optionalTrimmed,
  website: optionalTrimmed,
  tagline: optionalTrimmed,
  bankAccountName: optionalTrimmed,
  bankName: optionalTrimmed,
  bankAccountNumber: optionalTrimmed,
  bankIfsc: optionalTrimmed,
});

export type CompanyProfileFormValues = z.infer<typeof companyProfileFormSchema>;
