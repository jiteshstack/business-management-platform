"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageWarranties } from "@/lib/core/permissions";
import { type FormActionState, firstFieldErrors, rawValues, nextAttempt, str } from "@/lib/core/form-state";
import { warrantyFormSchema } from "./schema";

const WARRANTIES_PATH = "/warranty/warranties";

function requireManager(role: Parameters<typeof canManageWarranties>[0]) {
  if (!canManageWarranties(role)) {
    throw new Error("You don't have permission to manage warranties.");
  }
}

function readForm(formData: FormData) {
  return {
    customerId: str(formData, "customerId"),
    siteId: str(formData, "siteId"),
    projectId: str(formData, "projectId"),
    installedEquipmentId: str(formData, "installedEquipmentId"),
    warrantyType: str(formData, "warrantyType"),
    startDate: str(formData, "startDate"),
    endDate: str(formData, "endDate"),
    durationMonths: str(formData, "durationMonths"),
    terms: str(formData, "terms"),
    coverage: str(formData, "coverage"),
    exclusions: str(formData, "exclusions"),
    documentReference: str(formData, "documentReference"),
  };
}

export async function createWarrantyAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const parsed = warrantyFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  const customer = await prisma.party.findFirst({ where: { id: values.customerId, companyId: session.companyId, type: "CLIENT" } });
  if (!customer) {
    return { error: "Select a valid customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const startDate = new Date(values.startDate);
  const endDate = new Date(values.endDate);
  if (endDate.getTime() <= startDate.getTime()) {
    return { error: "End date must be after the start date.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  const warranty = await prisma.$transaction(async (tx) => {
    const warrantyNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "WAR", prefix: "WAR" });
    return tx.warranty.create({
      data: {
        companyId: session.companyId,
        warrantyNumber,
        customerId: values.customerId,
        siteId: values.siteId,
        projectId: values.projectId,
        installedEquipmentId: values.installedEquipmentId,
        warrantyType: values.warrantyType,
        startDate,
        endDate,
        durationMonths: values.durationMonths ?? null,
        terms: values.terms,
        coverage: values.coverage,
        exclusions: values.exclusions,
        documentReference: values.documentReference,
        createdBy: session.userId,
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "WARRANTY_CREATED",
    entityType: "Warranty",
    entityId: warranty.id,
    after: { warrantyNumber: warranty.warrantyNumber },
  });

  revalidatePath(WARRANTIES_PATH);
  redirect(`${WARRANTIES_PATH}/${warranty.id}`);
}

export async function updateWarrantyAction(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const existing = await prisma.warranty.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) return { error: "This warranty no longer exists.", attempt: nextAttempt(_prevState) };

  const parsed = warrantyFormSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;
  const startDate = new Date(values.startDate);
  const endDate = new Date(values.endDate);
  if (endDate.getTime() <= startDate.getTime()) {
    return { error: "End date must be after the start date.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
  }

  await prisma.warranty.update({
    where: { id },
    data: {
      siteId: values.siteId,
      projectId: values.projectId,
      installedEquipmentId: values.installedEquipmentId,
      warrantyType: values.warrantyType,
      startDate,
      endDate,
      durationMonths: values.durationMonths ?? null,
      terms: values.terms,
      coverage: values.coverage,
      exclusions: values.exclusions,
      documentReference: values.documentReference,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "WARRANTY_UPDATED",
    entityType: "Warranty",
    entityId: id,
  });

  revalidatePath(WARRANTIES_PATH);
  revalidatePath(`${WARRANTIES_PATH}/${id}`);
  redirect(`${WARRANTIES_PATH}/${id}`);
}

export async function cancelWarrantyAction(id: string): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const warranty = await prisma.warranty.findFirst({ where: { id, companyId: session.companyId } });
  if (!warranty) return;

  await prisma.warranty.update({ where: { id }, data: { status: "CANCELLED" } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "WARRANTY_CANCELLED",
    entityType: "Warranty",
    entityId: id,
  });

  revalidatePath(WARRANTIES_PATH);
  revalidatePath(`${WARRANTIES_PATH}/${id}`);
}
