"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { nextDocumentNumber } from "@/lib/core/numbering";
import { canManageProjects, canCancelProjects } from "@/lib/core/permissions";
import {
  type FormActionState,
  firstFieldErrors,
  rawValues,
  nextAttempt,
  str,
} from "@/lib/core/form-state";
import { projectFormSchema } from "./schema";
import { PROJECT_STATUS_TRANSITIONS, DEFAULT_MILESTONES, type ProjectStatus } from "./types";
import { assertProjectCompletable, recomputeSerialProjectItemCounters, ProjectRuleError } from "./ledger";
import { saveUploadedFile, deleteStoredFile, UploadRejectedError } from "@/lib/core/storage/local-disk";

const PROJECTS_PATH = "/projects";

function requireProjectManagerRole(role: Parameters<typeof canManageProjects>[0]) {
  if (!canManageProjects(role)) {
    throw new Error("You don't have permission to manage projects.");
  }
}

function readProjectForm(formData: FormData) {
  return {
    customerId: str(formData, "customerId"),
    salesOrderId: str(formData, "salesOrderId"),
    siteId: str(formData, "siteId"),
    name: str(formData, "name"),
    type: str(formData, "type"),
    priority: str(formData, "priority"),
    description: str(formData, "description"),
    startDate: str(formData, "startDate"),
    expectedCompletionDate: str(formData, "expectedCompletionDate"),
    projectManagerId: str(formData, "projectManagerId"),
    notes: str(formData, "notes"),
  };
}

async function createProjectCore(params: {
  companyId: string;
  userId: string;
  customerId: string;
  salesOrderId?: string | null;
  siteId?: string | null;
  name: string;
  type: string;
  priority: string;
  description?: string;
  startDate?: Date | null;
  expectedCompletionDate?: Date | null;
  projectManagerId?: string | null;
  notes?: string;
  scopeItems: { productId: string | null; productName: string; productCode: string | null; unitLabel: string | null; quantity: number }[];
}) {
  return prisma.$transaction(async (tx) => {
    const projectNumber = await nextDocumentNumber(tx, { companyId: params.companyId, series: "PRJ", prefix: "PRJ" });

    return tx.energyProject.create({
      data: {
        companyId: params.companyId,
        projectNumber,
        status: "DRAFT",
        priority: params.priority,
        type: params.type,
        customerId: params.customerId,
        salesOrderId: params.salesOrderId ?? null,
        siteId: params.siteId ?? null,
        name: params.name,
        description: params.description,
        startDate: params.startDate ?? null,
        expectedCompletionDate: params.expectedCompletionDate ?? null,
        projectManagerId: params.projectManagerId ?? null,
        notes: params.notes,
        createdBy: params.userId,
        items: {
          create: params.scopeItems.map((item, index) => ({
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            unitLabel: item.unitLabel,
            requiredQuantity: item.quantity,
            sortOrder: index,
          })),
        },
        milestones: {
          create: DEFAULT_MILESTONES.map((name, index) => ({ name, sortOrder: index })),
        },
      },
    });
  });
}

export async function createProjectAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const parsed = projectFormSchema.safeParse(readProjectForm(formData));
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

  if (values.siteId) {
    const site = await prisma.projectSite.findFirst({ where: { id: values.siteId, companyId: session.companyId, customerId: customer.id } });
    if (!site) {
      return { error: "Select a valid site for this customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
  }

  const project = await createProjectCore({
    companyId: session.companyId,
    userId: session.userId,
    customerId: customer.id,
    siteId: values.siteId,
    name: values.name,
    type: values.type,
    priority: values.priority,
    description: values.description,
    startDate: values.startDate ? new Date(values.startDate) : null,
    expectedCompletionDate: values.expectedCompletionDate ? new Date(values.expectedCompletionDate) : null,
    projectManagerId: values.projectManagerId,
    notes: values.notes,
    scopeItems: [],
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_CREATED",
    entityType: "EnergyProject",
    entityId: project.id,
    after: { projectNumber: project.projectNumber, name: project.name },
  });

  revalidatePath(PROJECTS_PATH);
  redirect(`${PROJECTS_PATH}/${project.id}`);
}

// The preferred path per spec section 36 — copies the Sales Order's line
// items as the project's scope (a snapshot, never a live join) and defaults
// the project name/type from the order. The Sales Order remains the sole
// commercial source of truth.
export async function createProjectFromSalesOrderAction(salesOrderId: string): Promise<void> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const so = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, companyId: session.companyId },
    include: { items: true, client: true },
  });
  if (!so) throw new Error("This sales order no longer exists.");
  if (so.status === "DRAFT" || so.status === "CANCELLED") {
    throw new Error("Only a confirmed sales order can start a project.");
  }

  const existing = await prisma.energyProject.findFirst({ where: { companyId: session.companyId, salesOrderId } });
  if (existing) {
    throw new Error("A project already exists for this sales order.");
  }

  const project = await createProjectCore({
    companyId: session.companyId,
    userId: session.userId,
    customerId: so.clientId,
    salesOrderId: so.id,
    name: `${so.client.name} - ${so.soNumber}`,
    type: "CUSTOM",
    priority: "NORMAL",
    scopeItems: so.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productCode: item.productCode,
      unitLabel: item.unitLabel,
      quantity: item.quantity,
    })),
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_CREATED_FROM_SALES_ORDER",
    entityType: "EnergyProject",
    entityId: project.id,
    before: { soNumber: so.soNumber },
    after: { projectNumber: project.projectNumber },
  });

  revalidatePath(PROJECTS_PATH);
  revalidatePath(`/sales/sales-orders/${so.id}`);
  redirect(`${PROJECTS_PATH}/${project.id}`);
}

export async function updateProjectAction(
  id: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const existing = await prisma.energyProject.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) {
    return { error: "This project no longer exists.", attempt: nextAttempt(_prevState) };
  }

  const parsed = projectFormSchema.safeParse(readProjectForm(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      values: rawValues(formData),
      attempt: nextAttempt(_prevState),
    };
  }
  const values = parsed.data;

  if (values.siteId) {
    const site = await prisma.projectSite.findFirst({ where: { id: values.siteId, companyId: session.companyId, customerId: existing.customerId } });
    if (!site) {
      return { error: "Select a valid site for this customer.", values: rawValues(formData), attempt: nextAttempt(_prevState) };
    }
  }

  await prisma.energyProject.update({
    where: { id },
    data: {
      siteId: values.siteId ?? null,
      name: values.name,
      type: values.type,
      priority: values.priority,
      description: values.description,
      startDate: values.startDate ? new Date(values.startDate) : null,
      expectedCompletionDate: values.expectedCompletionDate ? new Date(values.expectedCompletionDate) : null,
      projectManagerId: values.projectManagerId ?? null,
      notes: values.notes,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_UPDATED",
    entityType: "EnergyProject",
    entityId: id,
    after: { name: values.name },
  });

  revalidatePath(PROJECTS_PATH);
  revalidatePath(`${PROJECTS_PATH}/${id}`);
  redirect(`${PROJECTS_PATH}/${id}`);
}

export async function setProjectStatusAction(id: string, newStatus: ProjectStatus): Promise<void> {
  const session = await requireSession();
  const project = await prisma.energyProject.findFirst({ where: { id, companyId: session.companyId } });
  if (!project) return;

  if (newStatus === "CANCELLED") {
    if (!canCancelProjects(session.role)) {
      throw new Error("Only Owner/Admin can cancel a project.");
    }
  } else {
    requireProjectManagerRole(session.role);
  }

  const allowed = PROJECT_STATUS_TRANSITIONS[project.status as ProjectStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a ${project.status} project to ${newStatus}.`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (newStatus === "COMPLETED") {
        await assertProjectCompletable(tx, id);
      }
      await tx.energyProject.update({
        where: { id },
        data: {
          status: newStatus,
          actualCompletionDate: newStatus === "COMPLETED" ? new Date() : project.actualCompletionDate,
        },
      });
    });
  } catch (error) {
    if (error instanceof ProjectRuleError) {
      throw new Error(error.message);
    }
    throw error;
  }

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_STATUS_CHANGED",
    entityType: "EnergyProject",
    entityId: id,
    before: { status: project.status },
    after: { status: newStatus },
  });

  revalidatePath(PROJECTS_PATH);
  revalidatePath(`${PROJECTS_PATH}/${id}`);
}

// ---- Milestones ----

export async function addMilestoneAction(
  projectId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const project = await prisma.energyProject.findFirst({ where: { id: projectId, companyId: session.companyId } });
  if (!project) return { error: "This project no longer exists." };

  const name = str(formData, "name");
  if (!name) return { error: "Milestone name is required." };
  const plannedDate = str(formData, "plannedDate");

  const last = await prisma.projectMilestone.aggregate({ where: { projectId }, _max: { sortOrder: true } });

  await prisma.projectMilestone.create({
    data: {
      projectId,
      name,
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_MILESTONE_ADDED",
    entityType: "EnergyProject",
    entityId: projectId,
    after: { name },
  });

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
  return {};
}

export async function updateMilestoneStatusAction(
  projectId: string,
  milestoneId: string,
  status: string
): Promise<void> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const milestone = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, projectId, project: { companyId: session.companyId } },
  });
  if (!milestone) return;

  await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data: {
      status,
      actualDate: status === "COMPLETED" ? new Date() : milestone.actualDate,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_MILESTONE_STATUS_CHANGED",
    entityType: "EnergyProject",
    entityId: projectId,
    before: { milestone: milestone.name, status: milestone.status },
    after: { milestone: milestone.name, status },
  });

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
}

// ---- Equipment assignment (non-serial products) ----

export async function assignProjectItemQuantityAction(
  projectId: string,
  projectItemId: string,
  formData: FormData
): Promise<void> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const item = await prisma.projectItem.findFirst({
    where: { id: projectItemId, projectId, project: { companyId: session.companyId } },
  });
  if (!item) throw new Error("This scope item no longer exists.");

  const quantity = Number(str(formData, "quantity"));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Enter a quantity greater than zero.");
  }
  const newAssigned = item.assignedQuantity + quantity;
  if (newAssigned > item.requiredQuantity + 0.005) {
    throw new Error(`Only ${item.requiredQuantity - item.assignedQuantity} unit(s) of "${item.productName}" remain unassigned.`);
  }

  await prisma.projectItem.update({ where: { id: projectItemId }, data: { assignedQuantity: newAssigned } });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_EQUIPMENT_ASSIGNED",
    entityType: "EnergyProject",
    entityId: projectId,
    after: { product: item.productName, quantity },
  });

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
}

export async function assignSerialToProjectAction(
  projectId: string,
  projectItemId: string,
  serialId: string
): Promise<void> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const item = await prisma.projectItem.findFirst({
    where: { id: projectItemId, projectId, project: { companyId: session.companyId } },
  });
  if (!item || !item.productId) throw new Error("This scope item no longer exists.");

  const serial = await prisma.serialNumber.findFirst({
    where: { id: serialId, companyId: session.companyId, productId: item.productId },
  });
  if (!serial) throw new Error("This serial number no longer exists for this product.");
  if (serial.status !== "IN_STOCK" && serial.status !== "RESERVED") {
    throw new Error(`Serial ${serial.serialNumber} is ${serial.status.replaceAll("_", " ").toLowerCase()} and cannot be assigned.`);
  }
  if (item.assignedQuantity + 1 > item.requiredQuantity + 0.005) {
    throw new Error(`"${item.productName}" already has all required units assigned.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.serialNumber.update({ where: { id: serialId }, data: { status: "ASSIGNED", projectId } });
    await recomputeSerialProjectItemCounters(tx, projectItemId);
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_EQUIPMENT_ASSIGNED",
    entityType: "EnergyProject",
    entityId: projectId,
    after: { serialNumber: serial.serialNumber },
  });

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
}

export async function unassignSerialFromProjectAction(projectId: string, serialId: string): Promise<void> {
  const session = await requireSession();
  requireProjectManagerRole(session.role);

  const serial = await prisma.serialNumber.findFirst({
    where: { id: serialId, companyId: session.companyId, projectId },
  });
  if (!serial) return;
  if (serial.status === "INSTALLED") {
    throw new Error("This serial has already been installed and cannot be unassigned.");
  }

  const item = await prisma.projectItem.findFirst({ where: { projectId, productId: serial.productId } });

  await prisma.$transaction(async (tx) => {
    await tx.serialNumber.update({ where: { id: serialId }, data: { status: "IN_STOCK", projectId: null } });
    if (item) {
      await recomputeSerialProjectItemCounters(tx, item.id);
    }
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "PROJECT_EQUIPMENT_UNASSIGNED",
    entityType: "EnergyProject",
    entityId: projectId,
    after: { serialNumber: serial.serialNumber },
  });

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
}

// ---- Documents ----
// Reuses the same generic Document model + storage helpers as Party
// documents (Phase 2) — entityType "PROJECT" instead of "PARTY" — and the
// same download route (/api/parties/documents/[id]), which only checks
// companyId, not entityType.

export async function uploadProjectDocumentAction(
  projectId: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const session = await requireSession();
  const project = await prisma.energyProject.findFirst({ where: { id: projectId, companyId: session.companyId } });
  if (!project) return { error: "This project no longer exists.", attempt: nextAttempt(_prevState) };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload.", attempt: nextAttempt(_prevState) };
  }

  try {
    const stored = await saveUploadedFile({ companyId: session.companyId, entityType: "PROJECT", entityId: projectId, file });

    const document = await prisma.document.create({
      data: {
        companyId: session.companyId,
        entityType: "PROJECT",
        entityId: projectId,
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
      entityType: "EnergyProject",
      entityId: projectId,
      after: { fileName: document.fileName },
    });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return { error: error.message, attempt: nextAttempt(_prevState) };
    }
    throw error;
  }

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
  return {};
}

export async function deleteProjectDocumentAction(projectId: string, documentId: string): Promise<void> {
  const session = await requireSession();
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId: session.companyId, entityType: "PROJECT", entityId: projectId },
  });
  if (!document) return;

  await prisma.document.delete({ where: { id: documentId } });
  await deleteStoredFile(document.fileUrl);

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "DOCUMENT_DELETED",
    entityType: "EnergyProject",
    entityId: projectId,
    before: { fileName: document.fileName },
  });

  revalidatePath(`${PROJECTS_PATH}/${projectId}`);
}
