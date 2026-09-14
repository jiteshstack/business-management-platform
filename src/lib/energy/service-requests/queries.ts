import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ServiceRequestStatus, ServiceRequestPriority } from "./types";

export const SERVICE_REQUEST_PAGE_SIZE = 20;

export type ServiceRequestListParams = {
  companyId: string;
  q?: string;
  customerId?: string;
  status?: ServiceRequestStatus | "all";
  priority?: ServiceRequestPriority | "all";
  assignedToId?: string;
  page?: number;
};

export async function listServiceRequests(params: ServiceRequestListParams) {
  const { companyId, q, customerId, status, priority, assignedToId, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.ServiceRequestWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(priority && priority !== "all" ? { priority } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(q
      ? {
          OR: [
            { requestNumber: { contains: q } },
            { issue: { contains: q } },
            { customer: { name: { contains: q } } },
            { installedEquipment: { serialNumberText: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * SERVICE_REQUEST_PAGE_SIZE,
      take: SERVICE_REQUEST_PAGE_SIZE,
      include: { customer: true, site: true, installedEquipment: true, assignedTo: true },
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: SERVICE_REQUEST_PAGE_SIZE };
}

export async function getServiceRequestById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.serviceRequest.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      site: true,
      project: true,
      installedEquipment: true,
      amc: true,
      warranty: true,
      assignedTo: true,
      invoice: true,
      maintenanceVisits: { orderBy: { visitDate: "desc" }, include: { technician: true } },
    },
  });
}

export async function listServiceRequestsForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  return prisma.serviceRequest.findMany({
    where: { companyId, customerId },
    orderBy: { createdAt: "desc" },
    include: { installedEquipment: true, assignedTo: true },
  });
}

export async function listServiceRequestsForEquipment(params: { companyId: string; installedEquipmentId: string }) {
  const { companyId, installedEquipmentId } = params;
  return prisma.serviceRequest.findMany({ where: { companyId, installedEquipmentId }, orderBy: { createdAt: "desc" } });
}

export async function listServiceRequestsForProject(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.serviceRequest.findMany({ where: { companyId, projectId }, orderBy: { createdAt: "desc" } });
}

export async function listServiceRequestsForSite(params: { companyId: string; siteId: string }) {
  const { companyId, siteId } = params;
  return prisma.serviceRequest.findMany({ where: { companyId, siteId }, orderBy: { createdAt: "desc" } });
}

export async function getServiceDashboardStats(companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [open, highCritical, resolvedThisMonth] = await Promise.all([
    prisma.serviceRequest.count({ where: { companyId, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
    prisma.serviceRequest.count({
      where: { companyId, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] }, priority: { in: ["HIGH", "CRITICAL"] } },
    }),
    prisma.serviceRequest.count({ where: { companyId, status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: monthStart } } }),
  ]);

  return { open, highCritical, resolvedThisMonth };
}
