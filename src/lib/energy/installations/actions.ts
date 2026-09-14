"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageInstallations } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { createInstallationFormSchema } from "./schema";
import { INSTALLATION_STATUS_TRANSITIONS, type InstallationStatus } from "./types";
import { assertProjectCompletable, ProjectRuleError } from "@/lib/energy/projects/ledger";

const INSTALLATIONS_PATH = "/projects/installations";

function requireInstallationManager(role: Parameters<typeof canManageInstallations>[0]) {
  if (!canManageInstallations(role)) {
    throw new Error("You don't have permission to manage installations.");
  }
}

export async function createInstallationAction(
  projectId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireInstallationManager(session.role);

  const project = await prisma.energyProject.findFirst({ where: { id: projectId, companyId: session.companyId } });
  if (!project) return { error: "This project no longer exists.", attempt: nextAttempt(_prevState) };

  const parsed = createInstallationFormSchema.safeParse({
    siteId: str(formData, "siteId"),
    installationDate: str(formData, "installationDate"),
    technicianId: str(formData, "technicianId"),
    notes: str(formData, "notes"),
    items: str(formData, "items") ?? "",
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

  const projectItems = await prisma.projectItem.findMany({ where: { projectId } });
  const itemById = new Map(projectItems.map((i) => [i.id, i]));

  const rows: { projectItemId: string; productId: string | null; productName: string; quantity: number }[] = [];
  for (const row of values.items) {
    const item = itemById.get(row.projectItemId);
    if (!item) {
      return { error: "One of the selected scope items no longer exists.", attempt: nextAttempt(_prevState) };
    }
    const pending = item.assignedQuantity - item.installedQuantity;
    if (row.quantity > pending + 0.005) {
      return {
        error: `Only ${pending} unit(s) of "${item.productName}" are assigned and pending installation.`,
        attempt: nextAttempt(_prevState),
      };
    }
    rows.push({ projectItemId: item.id, productId: item.productId, productName: item.productName, quantity: row.quantity });
  }

  const installation = await prisma.$transaction(async (tx) => {
    const installationNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "INS", prefix: "INS" });
    return tx.installation.create({
      data: {
        companyId: session.companyId,
        installationNumber,
        projectId,
        siteId: values.siteId ?? project.siteId,
        status: "PLANNED",
        installationDate: new Date(values.installationDate),
        technicianId: values.technicianId,
        notes: values.notes,
        createdBy: session.userId,
        items: { create: rows.map((r, index) => ({ ...r, sortOrder: index })) },
      },
    });
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INSTALLATION_CREATED",
    entityType: "Installation",
    entityId: installation.id,
    after: { installationNumber: installation.installationNumber, projectId },
  });

  revalidatePath(INSTALLATIONS_PATH);
  revalidatePath(`/projects/${projectId}`);
  redirect(`${INSTALLATIONS_PATH}/${installation.id}`);
}

export async function setInstallationStatusAction(id: string, newStatus: InstallationStatus): Promise<void> {
  const session = await requireSession();
  requireInstallationManager(session.role);

  const installation = await prisma.installation.findFirst({ where: { id, companyId: session.companyId } });
  if (!installation) return;

  const allowed = INSTALLATION_STATUS_TRANSITIONS[installation.status as InstallationStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${installation.status} installation to ${newStatus}.`);
  }

  await prisma.installation.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INSTALLATION_STATUS_CHANGED",
    entityType: "Installation",
    entityId: id,
    before: { status: installation.status },
    after: { status: newStatus },
  });

  revalidatePath(INSTALLATIONS_PATH);
  revalidatePath(`${INSTALLATIONS_PATH}/${id}`);
}

export async function updateChecklistAction(id: string, checklist: Record<string, boolean>): Promise<void> {
  const session = await requireSession();
  requireInstallationManager(session.role);

  const installation = await prisma.installation.findFirst({ where: { id, companyId: session.companyId } });
  if (!installation) return;

  await prisma.installation.update({ where: { id }, data: { checklistJson: JSON.stringify(checklist) } });

  revalidatePath(`${INSTALLATIONS_PATH}/${id}`);
}

// The one action that actually records installed equipment: increments
// each referenced ProjectItem's installedQuantity (capped at assigned),
// flips the corresponding serials (if any) to INSTALLED, marks the
// installation Completed, and — per spec section 19/38 — auto-completes the
// project only if every scope item is now fully installed and every
// milestone is Completed/Skipped; never forces it.
export async function completeInstallationAction(id: string): Promise<void> {
  const session = await requireSession();
  requireInstallationManager(session.role);

  const installation = await prisma.installation.findFirst({
    where: { id, companyId: session.companyId },
    include: { items: true, project: true },
  });
  if (!installation) throw new Error("This installation no longer exists.");
  if (installation.status === "COMPLETED" || installation.status === "CANCELLED") {
    throw new Error(`This installation is already ${installation.status.toLowerCase()}.`);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of installation.items) {
      const projectItem = await tx.projectItem.findUniqueOrThrow({ where: { id: item.projectItemId } });
      const newInstalled = projectItem.installedQuantity + item.quantity;
      if (newInstalled > projectItem.assignedQuantity + 0.005) {
        throw new Error(`Cannot install more of "${item.productName}" than has been assigned.`);
      }

      let serialNumbers: string[] = [];
      let installedSerials: { id: string; serialNumber: string }[] = [];
      if (item.productId) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product?.serialTracked) {
          const serials = await tx.serialNumber.findMany({
            where: { projectId: installation.projectId, productId: item.productId, status: "ASSIGNED" },
            take: item.quantity,
          });
          if (serials.length < item.quantity) {
            throw new Error(`Not enough assigned serial numbers for "${item.productName}" to complete this installation.`);
          }
          for (const serial of serials) {
            await tx.serialNumber.update({ where: { id: serial.id }, data: { status: "INSTALLED" } });
          }
          serialNumbers = serials.map((s) => s.serialNumber);
          installedSerials = serials.map((s) => ({ id: s.id, serialNumber: s.serialNumber }));
        }
      }

      await tx.installationItem.update({
        where: { id: item.id },
        data: { serialNumbersJson: serialNumbers.length > 0 ? JSON.stringify(serialNumbers) : null },
      });
      await tx.projectItem.update({ where: { id: projectItem.id }, data: { installedQuantity: newInstalled } });

      // Installed Equipment registry (Phase 9) — one row per serial for
      // serial-tracked products, or one row for the whole installed batch
      // otherwise. Created only here, never a second inventory/serial
      // source of truth.
      if (installedSerials.length > 0) {
        for (const serial of installedSerials) {
          const equipmentNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "EQP", prefix: "EQP" });
          await tx.installedEquipment.create({
            data: {
              companyId: session.companyId,
              equipmentNumber,
              customerId: installation.project.customerId,
              siteId: installation.siteId,
              projectId: installation.projectId,
              installationId: installation.id,
              productId: item.productId,
              productName: item.productName,
              productCode: projectItem.productCode,
              serialNumberId: serial.id,
              serialNumberText: serial.serialNumber,
              quantity: 1,
              installationDate: installation.installationDate,
            },
          });
        }
      } else {
        const equipmentNumber = await nextDocumentNumber(tx, { companyId: session.companyId, series: "EQP", prefix: "EQP" });
        await tx.installedEquipment.create({
          data: {
            companyId: session.companyId,
            equipmentNumber,
            customerId: installation.project.customerId,
            siteId: installation.siteId,
            projectId: installation.projectId,
            installationId: installation.id,
            productId: item.productId,
            productName: item.productName,
            productCode: projectItem.productCode,
            quantity: item.quantity,
            installationDate: installation.installationDate,
          },
        });
      }
    }

    await tx.installation.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date(), completedBy: session.userId },
    });

    if (installation.project.status === "IN_PROGRESS") {
      try {
        await assertProjectCompletable(tx, installation.projectId);
        await tx.energyProject.update({
          where: { id: installation.projectId },
          data: { status: "COMPLETED", actualCompletionDate: new Date() },
        });
      } catch (error) {
        if (!(error instanceof ProjectRuleError)) throw error;
        // Not everything is done yet — leave the project's status as-is.
      }
    }
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "INSTALLATION_COMPLETED",
    entityType: "Installation",
    entityId: id,
    after: { projectId: installation.projectId },
  });

  revalidatePath(INSTALLATIONS_PATH);
  revalidatePath(`${INSTALLATIONS_PATH}/${id}`);
  revalidatePath(`/projects/${installation.projectId}`);
  revalidatePath("/warranty/equipment");
}
