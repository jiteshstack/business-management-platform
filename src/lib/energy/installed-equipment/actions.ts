"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { canManageInstalledEquipment } from "@/lib/core/permissions";
import { EQUIPMENT_STATUS_TRANSITIONS, type EquipmentStatus } from "./types";

const EQUIPMENT_PATH = "/warranty/equipment";

export async function setEquipmentStatusAction(id: string, newStatus: EquipmentStatus): Promise<void> {
  const session = await requireSession();
  if (!canManageInstalledEquipment(session.role)) {
    throw new Error("You don't have permission to manage installed equipment.");
  }

  const equipment = await prisma.installedEquipment.findFirst({ where: { id, companyId: session.companyId } });
  if (!equipment) return;

  const allowed = EQUIPMENT_STATUS_TRANSITIONS[equipment.status as EquipmentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move ${equipment.status} equipment to ${newStatus}.`);
  }

  await prisma.installedEquipment.update({ where: { id }, data: { status: newStatus } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "EQUIPMENT_STATUS_CHANGED",
    entityType: "InstalledEquipment",
    entityId: id,
    before: { status: equipment.status },
    after: { status: newStatus },
  });

  revalidatePath(EQUIPMENT_PATH);
  revalidatePath(`${EQUIPMENT_PATH}/${id}`);
}

export async function updateEquipmentNotesAction(id: string, notes: string): Promise<void> {
  const session = await requireSession();
  if (!canManageInstalledEquipment(session.role)) {
    throw new Error("You don't have permission to manage installed equipment.");
  }
  const equipment = await prisma.installedEquipment.findFirst({ where: { id, companyId: session.companyId } });
  if (!equipment) return;

  await prisma.installedEquipment.update({ where: { id }, data: { notes: notes || null } });
  revalidatePath(`${EQUIPMENT_PATH}/${id}`);
}
