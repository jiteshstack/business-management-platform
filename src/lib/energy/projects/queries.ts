import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ProjectStatus, ProjectType } from "./types";

export const PROJECT_PAGE_SIZE = 20;

export type ProjectListParams = {
  companyId: string;
  q?: string;
  customerId?: string;
  type?: ProjectType | "all";
  status?: ProjectStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

export async function listProjects(params: ProjectListParams) {
  const { companyId, q, customerId, type, status, dateFrom, dateTo, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.EnergyProjectWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(type && type !== "all" ? { type } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          startDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { projectNumber: { contains: q } },
            { name: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.energyProject.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * PROJECT_PAGE_SIZE,
      take: PROJECT_PAGE_SIZE,
      include: { customer: true, site: true },
    }),
    prisma.energyProject.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: PROJECT_PAGE_SIZE };
}

export async function getProjectById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.energyProject.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      site: true,
      salesOrder: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
      milestones: { orderBy: { sortOrder: "asc" } },
      installations: { orderBy: { createdAt: "desc" }, include: { technician: true, site: true } },
    },
  });
}

// Client 360 "Equipment" tab — installed equipment across all of this
// customer's projects, derived from ProjectItem's installed counters
// (never a separately-maintained equipment list).
export async function getInstalledEquipmentForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  const items = await prisma.projectItem.findMany({
    where: { project: { companyId, customerId }, installedQuantity: { gt: 0 } },
    include: { project: true },
    orderBy: { productName: "asc" },
  });
  return items;
}

export async function getProjectDocuments(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.document.findMany({
    where: { companyId, entityType: "PROJECT", entityId: projectId },
    orderBy: { createdAt: "desc" },
    include: { uploader: true },
  });
}

export async function listProjectsForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  return prisma.energyProject.findMany({
    where: { companyId, customerId },
    orderBy: { createdAt: "desc" },
    include: { site: true },
  });
}

export async function listProjectsForSalesOrder(params: { companyId: string; salesOrderId: string }) {
  const { companyId, salesOrderId } = params;
  return prisma.energyProject.findMany({
    where: { companyId, salesOrderId },
    orderBy: { createdAt: "desc" },
  });
}

// Project's commercial summary is always read live from the Sales Order and
// its Invoices — never a separately-maintained project balance.
export async function getProjectCommercialSummary(params: { companyId: string; salesOrderId: string | null }) {
  const { companyId, salesOrderId } = params;
  if (!salesOrderId) return null;

  const salesOrder = await prisma.salesOrder.findFirst({ where: { id: salesOrderId, companyId } });
  if (!salesOrder) return null;

  const invoices = await prisma.invoice.findMany({
    where: { companyId, salesOrderId, status: { not: "CANCELLED" } },
  });

  const invoiced = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const paid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const outstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

  return {
    contractValue: salesOrder.grandTotal,
    invoiced,
    paid,
    outstanding,
    soNumber: salesOrder.soNumber,
  };
}

export async function getProjectDashboard(companyId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [active, dueSoon, scheduled, inProgress, completed, sitesInExecution] = await Promise.all([
    prisma.energyProject.count({ where: { companyId, status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] } } }),
    prisma.energyProject.count({
      where: {
        companyId,
        status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] },
        expectedCompletionDate: { gte: now, lte: soon },
      },
    }),
    prisma.installation.count({ where: { companyId, status: "SCHEDULED" } }),
    prisma.installation.count({ where: { companyId, status: "IN_PROGRESS" } }),
    prisma.energyProject.count({ where: { companyId, status: "COMPLETED" } }),
    prisma.energyProject
      .findMany({
        where: { companyId, status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] }, siteId: { not: null } },
        select: { siteId: true },
        distinct: ["siteId"],
      })
      .then((rows) => rows.length),
  ]);

  return { active, dueSoon, scheduled, inProgress, completed, sitesInExecution };
}
