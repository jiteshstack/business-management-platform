import { z } from "zod";
import { ADDRESS_TYPES } from "./types";

// Indian GSTIN / PAN formats. Optional everywhere — many parties won't have
// one on file yet, but if a value is entered it should at least be shaped
// right so it doesn't silently save garbage into financial documents later.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const partyFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  businessName: optionalTrimmed,
  category: optionalTrimmed,
  mobile: optionalTrimmed,
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email",
    }),
  gstin: optionalTrimmed
    .transform((value) => value?.toUpperCase())
    .refine((value) => !value || GSTIN_REGEX.test(value), {
      message: "Enter a valid 15-character GSTIN",
    }),
  pan: optionalTrimmed
    .transform((value) => value?.toUpperCase())
    .refine((value) => !value || PAN_REGEX.test(value), {
      message: "Enter a valid 10-character PAN",
    }),
  city: optionalTrimmed,
  state: optionalTrimmed,
  paymentTerms: optionalTrimmed,
  billingLine1: optionalTrimmed,
  billingLine2: optionalTrimmed,
  billingPincode: optionalTrimmed,
  isActive: z.boolean().default(true),
});

export type PartyFormValues = z.infer<typeof partyFormSchema>;

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  designation: optionalTrimmed,
  phone: optionalTrimmed,
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email",
    }),
  isPrimary: z.boolean().default(false),
});

export const addressFormSchema = z.object({
  type: z.enum(ADDRESS_TYPES),
  label: optionalTrimmed,
  line1: z.string().trim().min(1, "Address line is required").max(300),
  line2: optionalTrimmed,
  city: optionalTrimmed,
  state: optionalTrimmed,
  pincode: optionalTrimmed,
  country: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "India"),
  isDefault: z.boolean().default(false),
});

export const noteFormSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(5000),
});
