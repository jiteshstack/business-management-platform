"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import {
  saveUploadedFile,
  deleteStoredFile,
  UploadRejectedError,
} from "@/lib/core/storage";
import {
  partyFormSchema,
  contactFormSchema,
  addressFormSchema,
  noteFormSchema,
} from "./schema";
import type { PartyType } from "./types";

// `values`/`attempt` exist purely so a failed submission can redisplay what
// the user typed: React resets uncontrolled form fields after any Server
// Action submission (success or failure), so without this the form would
// blank itself out every time a validation error is shown.
export type FormActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  attempt?: number;
};

function basePath(type: PartyType): string {
  return type === "CLIENT" ? "/parties/clients" : "/parties/vendors";
}

function firstFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): Record<string, string> {
  const { fieldErrors } = error.flatten();
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) out[key] = messages[0];
  }
  return out;
}

function rawValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function nextAttempt(prevState: FormActionState): number {
  return (prevState.attempt ?? 0) + 1;
}

// FormData.get() returns null for a field that isn't in the form at all
// (e.g. the edit form omits the billing-address inputs entirely) — zod's
// `.optional()` only accepts `undefined`, not `null`, so this normalizes
// "missing" to undefined before validation.
function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function readForm(formData: FormData) {
  return {
    name: str(formData, "name"),
    businessName: str(formData, "businessName"),
    category: str(formData, "category"),
    mobile: str(formData, "mobile"),
    email: str(formData, "email"),
    gstin: str(formData, "gstin"),
    pan: str(formData, "pan"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    paymentTerms: str(formData, "paymentTerms"),
    billingLine1: str(formData, "billingLine1"),
    billingLine2: str(formData, "billingLine2"),
    billingPincode: str(formData, "billingPincode"),
    isActive: formData.get("isActive") === "on",
  };
}

export async function createPartyAction(
  type: PartyType,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = partyFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const party = await prisma.party.create({
    data: {
      companyId: session.companyId,
      type,
      name: values.name,
      businessName: values.businessName,
      category: values.category,
      mobile: values.mobile,
      email: values.email,
      gstin: values.gstin,
      pan: values.pan,
      city: values.city,
      state: values.state,
      paymentTerms: values.paymentTerms,
      isActive: true,
      ...(values.billingLine1
        ? {
            addresses: {
              create: {
                type: "BILLING",
                label: "Billing Address",
                line1: values.billingLine1,
                line2: values.billingLine2,
                city: values.city,
                state: values.state,
                pincode: values.billingPincode,
                isDefault: true,
              },
            },
          }
        : {}),
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PARTY_CREATED",
    entityType: "Party",
    entityId: party.id,
    after: { type, name: party.name },
  });

  revalidatePath(basePath(type));
  redirect(`${basePath(type)}/${party.id}`);
}

export async function updatePartyAction(
  type: PartyType,
  partyId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const parsed = partyFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const existing = await prisma.party.findFirst({
    where: { id: partyId, companyId: session.companyId, type },
  });
  if (!existing) {
    return { error: "This record no longer exists.", attempt: nextAttempt(_prevState) };
  }

  await prisma.party.update({
    where: { id: partyId },
    data: {
      name: values.name,
      businessName: values.businessName,
      category: values.category,
      mobile: values.mobile,
      email: values.email,
      gstin: values.gstin,
      pan: values.pan,
      city: values.city,
      state: values.state,
      paymentTerms: values.paymentTerms,
      isActive: values.isActive,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PARTY_UPDATED",
    entityType: "Party",
    entityId: partyId,
    before: { name: existing.name, isActive: existing.isActive },
    after: { name: values.name, isActive: values.isActive },
  });

  revalidatePath(basePath(type));
  revalidatePath(`${basePath(type)}/${partyId}`);
  redirect(`${basePath(type)}/${partyId}`);
}

export async function setPartyActiveAction(
  type: PartyType,
  partyId: string,
  isActive: boolean
): Promise<void> {
  const session = await requireSession();
  const existing = await prisma.party.findFirst({
    where: { id: partyId, companyId: session.companyId, type },
  });
  if (!existing) return;

  await prisma.party.update({ where: { id: partyId }, data: { isActive } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: isActive ? "PARTY_ACTIVATED" : "PARTY_DEACTIVATED",
    entityType: "Party",
    entityId: partyId,
  });

  revalidatePath(basePath(type));
  revalidatePath(`${basePath(type)}/${partyId}`);
}

// ---- Contacts ----

export async function addContactAction(
  type: PartyType,
  partyId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId: session.companyId, type },
  });
  if (!party) return { error: "This record no longer exists.", attempt: nextAttempt(_prevState) };

  const parsed = contactFormSchema.safeParse({
    name: formData.get("name"),
    designation: formData.get("designation"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  if (parsed.data.isPrimary) {
    await prisma.partyContact.updateMany({ where: { partyId }, data: { isPrimary: false } });
  }
  await prisma.partyContact.create({ data: { partyId, ...parsed.data } });

  revalidatePath(`${basePath(type)}/${partyId}`);
  return {};
}

export async function deleteContactAction(type: PartyType, partyId: string, contactId: string) {
  const session = await requireSession();
  const contact = await prisma.partyContact.findFirst({
    where: { id: contactId, party: { companyId: session.companyId, id: partyId, type } },
  });
  if (!contact) return;

  await prisma.partyContact.delete({ where: { id: contactId } });
  revalidatePath(`${basePath(type)}/${partyId}`);
}

// ---- Addresses ----

export async function addAddressAction(
  type: PartyType,
  partyId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId: session.companyId, type },
  });
  if (!party) return { error: "This record no longer exists.", attempt: nextAttempt(_prevState) };

  const parsed = addressFormSchema.safeParse({
    type: formData.get("type"),
    label: formData.get("label"),
    line1: formData.get("line1"),
    line2: formData.get("line2"),
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    country: formData.get("country"),
    isDefault: formData.get("isDefault") === "on",
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  if (parsed.data.isDefault) {
    await prisma.partyAddress.updateMany({ where: { partyId }, data: { isDefault: false } });
  }
  await prisma.partyAddress.create({ data: { partyId, ...parsed.data } });

  revalidatePath(`${basePath(type)}/${partyId}`);
  return {};
}

export async function deleteAddressAction(type: PartyType, partyId: string, addressId: string) {
  const session = await requireSession();
  const address = await prisma.partyAddress.findFirst({
    where: { id: addressId, party: { companyId: session.companyId, id: partyId, type } },
  });
  if (!address) return;

  await prisma.partyAddress.delete({ where: { id: addressId } });
  revalidatePath(`${basePath(type)}/${partyId}`);
}

// ---- Notes ----

export async function addNoteAction(
  type: PartyType,
  partyId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId: session.companyId, type },
  });
  if (!party) return { error: "This record no longer exists.", attempt: nextAttempt(_prevState) };

  const parsed = noteFormSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid note.",
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }

  await prisma.partyNote.create({
    data: { partyId, authorId: session.userId, body: parsed.data.body },
  });

  revalidatePath(`${basePath(type)}/${partyId}`);
  return {};
}

// ---- Documents ----

export async function uploadDocumentAction(
  type: PartyType,
  partyId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId: session.companyId, type },
  });
  if (!party) return { error: "This record no longer exists.", attempt: nextAttempt(_prevState) };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload.", attempt: nextAttempt(_prevState) };
  }

  try {
    const stored = await saveUploadedFile({
      companyId: session.companyId,
      entityType: "PARTY",
      entityId: partyId,
      file,
    });

    const document = await prisma.document.create({
      data: {
        companyId: session.companyId,
        entityType: "PARTY",
        entityId: partyId,
        fileName: stored.fileName,
        fileUrl: stored.fileUrl,
        fileType: stored.fileType,
        fileSize: stored.fileSize,
        uploadedBy: session.userId,
      },
    });

    await recordAudit({
      companyId: session.companyId,
      userId: session.userId,
      action: "DOCUMENT_UPLOADED",
      entityType: "Party",
      entityId: partyId,
      after: { fileName: document.fileName },
    });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return { error: error.message, attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  revalidatePath(`${basePath(type)}/${partyId}`);
  return {};
}

export async function deleteDocumentAction(
  type: PartyType,
  partyId: string,
  documentId: string
) {
  const session = await requireSession();
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId: session.companyId, entityType: "PARTY", entityId: partyId },
  });
  if (!document) return;

  await prisma.document.delete({ where: { id: documentId } });
  await deleteStoredFile(document.fileUrl);

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "DOCUMENT_DELETED",
    entityType: "Party",
    entityId: partyId,
    before: { fileName: document.fileName },
  });

  revalidatePath(`${basePath(type)}/${partyId}`);
}
