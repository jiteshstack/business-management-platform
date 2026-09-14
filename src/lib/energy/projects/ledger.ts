import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

export class ProjectRuleError extends Error {}

type TxClient = Prisma.TransactionClient | PrismaClient;

// Recomputes a serial-tracked ProjectItem's assigned/installed counters from
// the actual SerialNumber rows referencing this project+product — never
// incremented directly, so it can never drift from what's really assigned.
// Non-serial products are incremented directly by the assign/install
// actions instead (there is no per-unit row to count for them).
export async function recomputeSerialProjectItemCounters(tx: TxClient, projectItemId: string): Promise<void> {
  const item = await tx.projectItem.findUniqueOrThrow({ where: { id: projectItemId } });
  if (!item.productId) return;

  const [assignedCount, installedCount] = await Promise.all([
    tx.serialNumber.count({
      where: { projectId: item.projectId, productId: item.productId, status: { in: ["ASSIGNED", "INSTALLED"] } },
    }),
    tx.serialNumber.count({
      where: { projectId: item.projectId, productId: item.productId, status: "INSTALLED" },
    }),
  ]);

  await tx.projectItem.update({
    where: { id: projectItemId },
    data: { assignedQuantity: assignedCount, installedQuantity: installedCount },
  });
}

// Section 38: a project cannot be marked Completed while required
// operational work remains outstanding — every scope item must be fully
// installed, and every milestone must be Completed or explicitly Skipped.
// Kept intentionally simple (no dependency graph), per spec.
export async function assertProjectCompletable(tx: TxClient, projectId: string): Promise<void> {
  const [items, milestones] = await Promise.all([
    tx.projectItem.findMany({ where: { projectId } }),
    tx.projectMilestone.findMany({ where: { projectId } }),
  ]);

  const incompleteItem = items.find((item) => item.installedQuantity + 0.005 < item.requiredQuantity);
  if (incompleteItem) {
    throw new ProjectRuleError(
      `"${incompleteItem.productName}" still has ${incompleteItem.requiredQuantity - incompleteItem.installedQuantity} unit(s) not installed - complete installation before closing the project.`
    );
  }

  const openMilestone = milestones.find((m) => m.status !== "COMPLETED" && m.status !== "SKIPPED");
  if (openMilestone) {
    throw new ProjectRuleError(
      `Milestone "${openMilestone.name}" is still ${openMilestone.status.replaceAll("_", " ").toLowerCase()} - complete or skip it before closing the project.`
    );
  }
}
