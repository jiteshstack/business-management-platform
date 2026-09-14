import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { VisitStatus } from "./types";

export const VISIT_PAGE_SIZE = 20;

export type VisitListParams = {
  companyId: string;
  q?: string;
  customerId?: string;
  technicianId?: string;
  status?: VisitStatus | "all";
  amcId?: string;
  page?: number;
};

export async function listMaintenanceVisits(params: VisitListParams) {
  const { companyId, q, customerId, technicianId, status, amcId, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.MaintenanceVisitWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(technicianId ? { technicianId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(amcId ? { amcId } : {}),
    ...(q
      ? {
          OR: [{ visitNumber: { contains: q } }, { customer: { name: { contains: q } } }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.maintenanceVisit.findMany({
      where,
      orderBy: { visitDate: "desc" },
      skip: (safePage - 1) * VISIT_PAGE_SIZE,
      take: VISIT_PAGE_SIZE,
      include: { customer: true, site: true, technician: true, amc: true, serviceRequest: true },
    }),
    prisma.maintenanceVisit.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: VISIT_PAGE_SIZE };
}

export async function getMaintenanceVisitById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.maintenanceVisit.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      site: true,
      project: true,
      installedEquipment: true,
      serviceRequest: true,
      amc: true,
      technician: true,
      partsUsed: { include: { product: true, location: true } },
    },
  });
}

export async function listMaintenanceVisitsForEquipment(params: { companyId: string; installedEquipmentId: string }) {
  const { companyId, installedEquipmentId } = params;
  return prisma.maintenanceVisit.findMany({ where: { companyId, installedEquipmentId }, orderBy: { visitDate: "desc" }, include: { technician: true } });
}

export async function listMaintenanceVisitsForServiceRequest(params: { companyId: string; serviceRequestId: string }) {
  const { companyId, serviceRequestId } = params;
  return prisma.maintenanceVisit.findMany({ where: { companyId, serviceRequestId }, orderBy: { visitDate: "desc" }, include: { technician: true, partsUsed: true } });
}

export async function listMaintenanceVisitsForSite(params: { companyId: string; siteId: string }) {
  const { companyId, siteId } = params;
  return prisma.maintenanceVisit.findMany({ where: { companyId, siteId }, orderBy: { visitDate: "desc" }, include: { technician: true } });
}

export async function listMaintenanceVisitsForAmc(params: { companyId: string; amcId: string }) {
  const { companyId, amcId } = params;
  return prisma.maintenanceVisit.findMany({ where: { companyId, amcId }, orderBy: { visitDate: "desc" }, include: { technician: true } });
}

// The "Upcoming Work" / "Maintenance Due" operational view (spec sections
// 39/42) — a simple sorted list, not a scheduling engine. Anything
// PLANNED/SCHEDULED and past its visitDate is flagged overdue.
export async function listMaintenanceSchedule(params: { companyId: string }) {
  const { companyId } = params;
  const now = new Date();
  const rows = await prisma.maintenanceVisit.findMany({
    where: { companyId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
    orderBy: { visitDate: "asc" },
    include: { customer: true, site: true, technician: true, amc: true, serviceRequest: true },
  });
  return rows.map((v) => ({ ...v, isOverdue: v.visitDate.getTime() < now.getTime() }));
}

export async function getMaintenanceDashboardStats(companyId: string) {
  const now = new Date();
  const [scheduled, overdue] = await Promise.all([
    prisma.maintenanceVisit.count({ where: { companyId, status: { in: ["PLANNED", "IN_PROGRESS"] }, visitDate: { gte: now } } }),
    prisma.maintenanceVisit.count({ where: { companyId, status: { in: ["PLANNED", "IN_PROGRESS"] }, visitDate: { lt: now } } }),
  ]);
  return { scheduled, overdue };
}
