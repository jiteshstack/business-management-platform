"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageMaintenanceVisits, canCompleteMaintenanceVisits } from "@/lib/core/permissions";
import { applyStockMovement, StockRuleError } from "@/lib/energy/inventory/ledger";
import { type FormActionState, firstFieldErrors, rawValues, nextAttempt, str } from "@/lib/core/form-state";
import { createMaintenanceVisitFormSchema, completeMaintenanceVisitFormSchema } from "./schema";
import { VISIT_STATUS_TRANSITIONS, type VisitStatus } from "./types";

const VISITS_PATH = "/service/maintenance";

function requireManager(role: Parameters<typeof canManageMaintenanceVisits>[0]) {
  if (!canManageMaintenanceVisits(role)) {
    throw new Error("You don't have permission to manage maintenance visits.");
  }
}

function readCreateForm(formData: FormData) {
  return {
    customerId: str(formData, "customerId"),
    siteId: str(formData, "siteId"),
    projectId: str(formData, "projectId"),
    installedEquipmentId: str(formData, "installedEquipmentId"),
    serviceRequestId: str(formData, "serviceRequestId"),
    amcId: str(formData, "amcId"),
    technicianId: str(formData, "technicianId"),
    visitType: str(formData, "visitType"),
    visitDate: str(formData, "visitDate"),
  };
}

export async function createMaintenanceVisitAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const session = await requireSession();
  requireManager(session.role);

  const parsed = createMaintenanceVisitFormSchema.safeParse(readCreateForm(formData));
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

  const visit = await prisma.$transaction(async (tx) => {
    const visitNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "MNT", prefix: "MNT" });
    return tx.maintenanceVisit.create({
      data: {
        companyId: session.companyId,
        visitNumber,
        customerId: values.customerId,
        siteId: values.siteId,
        projectId: values.projectId,
        installedEquipmentId: values.installedEquipmentId,
        serviceRequestId: values.serviceRequestId,
        amcId: values.amcId,
        technicianId: values.technicianId,
        visitType: values.visitType,
        visitDate: new Date(values.visitDate),
        status: "PLANNED",
        createdBy: session.userId,
      },
    });
  });

  // A visit created against an Open service request naturally schedules it.
  if (values.serviceRequestId) {
    const request = await prisma.serviceRequest.findFirst({ where: { id: values.serviceRequestId, companyId: session.companyId } });
    if (request && (request.status === "OPEN" || request.status === "ASSIGNED")) {
      await prisma.serviceRequest.update({ where: { id: request.id }, data: { status: "SCHEDULED" } });
    }
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "MAINTENANCE_VISIT_CREATED",
    entityType: "MaintenanceVisit",
    entityId: visit.id,
    after: { visitNumber: visit.visitNumber },
  });

  revalidatePath(VISITS_PATH);
  if (values.serviceRequestId) revalidatePath(`/service/service-requests/${values.serviceRequestId}`);
  redirect(`${VISITS_PATH}/${visit.id}`);
}

export async function setMaintenanceVisitStatusAction(id: string, newStatus: VisitStatus): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const visit = await prisma.maintenanceVisit.findFirst({ where: { id, companyId: session.companyId } });
  if (!visit) return;

  const allowed = VISIT_STATUS_TRANSITIONS[visit.status as VisitStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${visit.status} visit to ${newStatus}.`);
  }

  await prisma.maintenanceVisit.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "MAINTENANCE_VISIT_STATUS_CHANGED",
    entityType: "MaintenanceVisit",
    entityId: id,
    before: { status: visit.status },
    after: { status: newStatus },
  });

  revalidatePath(VISITS_PATH);
  revalidatePath(`${VISITS_PATH}/${id}`);
}

export async function updateVisitChecklistAction(id: string, checklist: Record<string, boolean>): Promise<void> {
  const session = await requireSession();
  requireManager(session.role);

  const visit = await prisma.maintenanceVisit.findFirst({ where: { id, companyId: session.companyId } });
  if (!visit) return;

  await prisma.maintenanceVisit.update({ where: { id }, data: { checklistJson: JSON.stringify(checklist) } });
  revalidatePath(`${VISITS_PATH}/${id}`);
}

// Completing a visit is the one place parts consumption and the final
// findings/resolution get recorded (spec sections 26-29). Each part used
// goes through applyStockMovement (STOCK_OUT) — the same single stock
// ledger every other module uses — never a second inventory system, and
// StockRuleError (insufficient stock) surfaces as a normal form error.
export async function completeMaintenanceVisitAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  if (!canCompleteMaintenanceVisits(session.role)) {
    return { error: "You don't have permission to complete maintenance visits.", attempt: nextAttempt(_prevState) };
  }

  const visit = await prisma.maintenanceVisit.findFirst({ where: { id, companyId: session.companyId } });
  if (!visit) return { error: "This maintenance visit no longer exists.", attempt: nextAttempt(_prevState) };
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    return { error: `This visit is already ${visit.status.toLowerCase()}.`, attempt: nextAttempt(_prevState) };
  }

  const parsed = completeMaintenanceVisitFormSchema.safeParse({
    findings: str(formData, "findings"),
    workPerformed: str(formData, "workPerformed"),
    result: str(formData, "result"),
    customerRemarks: str(formData, "customerRemarks"),
    technicianRemarks: str(formData, "technicianRemarks"),
    nextMaintenanceDate: str(formData, "nextMaintenanceDate"),
    partsUsed: str(formData, "partsUsed"),
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      for (const part of values.partsUsed) {
        const product = await tx.product.findFirst({ where: { id: part.productId, companyId: session.companyId } });
        if (!product) throw new Error("One of the selected parts no longer exists.");

        const movement = await applyStockMovement(tx, {
          companyId: session.companyId,
          productId: part.productId,
          locationId: part.locationId,
          type: "STOCK_OUT",
          quantity: part.quantity,
          reference: visit.visitNumber,
          reason: "SERVICE_PART_CONSUMPTION",
          notes: `Consumed on maintenance visit ${visit.visitNumber}`,
          userId: session.userId,
        });

        await tx.servicePartUsage.create({
          data: {
            maintenanceVisitId: id,
            productId: part.productId,
            productName: product.name,
            quantity: part.quantity,
            locationId: part.locationId,
            stockMovementId: movement.id,
          },
        });
      }

      await tx.maintenanceVisit.update({
        where: { id },
        data: {
          status: "COMPLETED",
          findings: values.findings,
          workPerformed: values.workPerformed,
          result: values.result,
          customerRemarks: values.customerRemarks,
          technicianRemarks: values.technicianRemarks,
          nextMaintenanceDate: values.nextMaintenanceDate ? new Date(values.nextMaintenanceDate) : null,
        },
      });
    });
  } catch (error) {
    if (error instanceof StockRuleError) {
      return { error: error.message, attempt: nextAttempt(_prevState) };
    }
    return { error: error instanceof Error ? error.message : "Could not complete this visit.", attempt: nextAttempt(_prevState) };
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "MAINTENANCE_VISIT_COMPLETED",
    entityType: "MaintenanceVisit",
    entityId: id,
    after: { partsUsed: values.partsUsed.length },
  });

  revalidatePath(VISITS_PATH);
  revalidatePath(`${VISITS_PATH}/${id}`);
  if (visit.serviceRequestId) revalidatePath(`/service/service-requests/${visit.serviceRequestId}`);
  redirect(`${VISITS_PATH}/${id}`);
}
