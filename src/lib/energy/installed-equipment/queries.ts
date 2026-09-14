import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { EquipmentStatus } from "./types";
import { findActiveWarrantyForEquipment } from "@/lib/energy/warranties/queries";
import { findActiveAmcForCustomer } from "@/lib/energy/amc/queries";

export const EQUIPMENT_PAGE_SIZE = 20;

export type EquipmentListParams = {
  companyId: string;
  q?: string;
  customerId?: string;
  siteId?: string;
  projectId?: string;
  status?: EquipmentStatus | "all";
  page?: number;
};

export async function listInstalledEquipment(params: EquipmentListParams) {
  const { companyId, q, customerId, siteId, projectId, status, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.InstalledEquipmentWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { equipmentNumber: { contains: q } },
            { productName: { contains: q } },
            { serialNumberText: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.installedEquipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * EQUIPMENT_PAGE_SIZE,
      take: EQUIPMENT_PAGE_SIZE,
      include: { customer: true, site: true, project: true },
    }),
    prisma.installedEquipment.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: EQUIPMENT_PAGE_SIZE };
}

export async function getInstalledEquipmentById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.installedEquipment.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      site: true,
      project: true,
      installation: true,
      product: true,
      serialNumberRef: true,
      warranties: { orderBy: { createdAt: "desc" } },
      serviceRequests: { orderBy: { createdAt: "desc" } },
      maintenanceVisits: { orderBy: { visitDate: "desc" }, include: { technician: true } },
    },
  });
}

export async function listInstalledEquipmentForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  return prisma.installedEquipment.findMany({
    where: { companyId, customerId },
    orderBy: { installationDate: "desc" },
    include: { site: true, project: true },
  });
}

export async function listInstalledEquipmentForSite(params: { companyId: string; siteId: string }) {
  const { companyId, siteId } = params;
  return prisma.installedEquipment.findMany({
    where: { companyId, siteId },
    orderBy: { installationDate: "desc" },
    include: { project: true },
  });
}

export async function listInstalledEquipmentForProject(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.installedEquipment.findMany({
    where: { companyId, projectId },
    orderBy: { installationDate: "desc" },
  });
}

// The at-a-glance coverage block shown on the Installed Equipment detail
// page (spec section 33/34) — always derived live from Warranty/AMC/Service
// records, never stored on InstalledEquipment itself.
export async function getEquipmentCoverageSummary(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  const equipment = await prisma.installedEquipment.findFirst({ where: { id, companyId } });
  if (!equipment) return null;

  const [activeWarranty, activeAmc, serviceRequests, maintenanceVisits] = await Promise.all([
    findActiveWarrantyForEquipment({ companyId, installedEquipmentId: id }),
    findActiveAmcForCustomer({ companyId, customerId: equipment.customerId, siteId: equipment.siteId }),
    prisma.serviceRequest.count({ where: { companyId, installedEquipmentId: id, status: { notIn: ["CLOSED", "CANCELLED"] } } }),
    prisma.maintenanceVisit.findMany({
      where: { companyId, installedEquipmentId: id },
      orderBy: { visitDate: "desc" },
    }),
  ]);

  const lastCompleted = maintenanceVisits.find((v) => v.status === "COMPLETED");
  const upcomingNext = maintenanceVisits
    .filter((v) => v.nextMaintenanceDate)
    .sort((a, b) => (a.nextMaintenanceDate!.getTime() - b.nextMaintenanceDate!.getTime()))[0];

  return {
    activeWarranty,
    activeAmc,
    openServiceRequestCount: serviceRequests,
    lastServiceDate: lastCompleted?.visitDate ?? null,
    nextMaintenanceDate: upcomingNext?.nextMaintenanceDate ?? null,
  };
}
