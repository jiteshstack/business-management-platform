"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { canManageSites } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { projectSiteFormSchema } from "./schema";

const SITES_PATH = "/projects/sites";

function requireSiteManager(role: Parameters<typeof canManageSites>[0]) {
  if (!canManageSites(role)) {
    throw new Error("You don't have permission to manage sites.");
  }
}

function readSiteForm(formData: FormData) {
  return {
    customerId: str(formData, "customerId"),
    name: str(formData, "name"),
    line1: str(formData, "line1"),
    line2: str(formData, "line2"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    pincode: str(formData, "pincode"),
    landmark: str(formData, "landmark"),
    contactPerson: str(formData, "contactPerson"),
    contactPhone: str(formData, "contactPhone"),
    contactEmail: str(formData, "contactEmail"),
    notes: str(formData, "notes"),
  };
}

export async function createProjectSiteAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireSiteManager(session.role);

  const parsed = projectSiteFormSchema.safeParse(readSiteForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const customer = await prisma.party.findFirst({
    where: { id: values.customerId, companyId: session.companyId, type: "CLIENT" },
  });
  if (!customer) {
    return { error: "Select a valid customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const site = await prisma.projectSite.create({
    data: {
      companyId: session.companyId,
      customerId: customer.id,
      name: values.name,
      line1: values.line1,
      line2: values.line2,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      landmark: values.landmark,
      contactPerson: values.contactPerson,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
      notes: values.notes,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SITE_CREATED",
    entityType: "ProjectSite",
    entityId: site.id,
    after: { name: site.name, customerId: customer.id },
  });

  revalidatePath(SITES_PATH);
  redirect(`${SITES_PATH}/${site.id}`);
}

export async function updateProjectSiteAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireSiteManager(session.role);

  const existing = await prisma.projectSite.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This site no longer exists.", attempt: nextAttempt(_prevState) };
  }

  const parsed = projectSiteFormSchema.safeParse(readSiteForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const customer = await prisma.party.findFirst({
    where: { id: values.customerId, companyId: session.companyId, type: "CLIENT" },
  });
  if (!customer) {
    return { error: "Select a valid customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  await prisma.projectSite.update({
    where: { id },
    data: {
      customerId: customer.id,
      name: values.name,
      line1: values.line1,
      line2: values.line2,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      landmark: values.landmark,
      contactPerson: values.contactPerson,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
      notes: values.notes,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "SITE_UPDATED",
    entityType: "ProjectSite",
    entityId: id,
    after: { name: values.name },
  });

  revalidatePath(SITES_PATH);
  revalidatePath(`${SITES_PATH}/${id}`);
  redirect(`${SITES_PATH}/${id}`);
}
