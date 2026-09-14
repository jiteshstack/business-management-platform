import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { computeWarrantyStatus, DEFAULT_EXPIRY_THRESHOLD_DAYS, type WarrantyDisplayStatus } from "./types";

export const WARRANTY_PAGE_SIZE = 20;

export type WarrantyListParams = {
  companyId: string;
  q?: string;
  customerId?: string;
  status?: WarrantyDisplayStatus | "all";
  page?: number;
};

export async function listWarranties(params: WarrantyListParams) {
  const { companyId, q, customerId, status, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.WarrantyWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(q
      ? {
          OR: [
            { warrantyNumber: { contains: q } },
            { customer: { name: { contains: q } } },
            { installedEquipment: { productName: { contains: q } } },
            { installedEquipment: { serialNumberText: { contains: q } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.warranty.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: true, site: true, installedEquipment: true },
  });

  const filtered = status && status !== "all" ? rows.filter((w) => computeWarrantyStatus(w) === status) : rows;
  const start = (safePage - 1) * WARRANTY_PAGE_SIZE;
  const items = filtered.slice(start, start + WARRANTY_PAGE_SIZE);

  return { items, total: filtered.length, page: safePage, pageSize: WARRANTY_PAGE_SIZE };
}

export async function getWarrantyById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.warranty.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      site: true,
      project: true,
      installedEquipment: true,
      serviceRequests: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listWarrantiesForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  return prisma.warranty.findMany({ where: { companyId, customerId }, orderBy: { createdAt: "desc" }, include: { installedEquipment: true } });
}

export async function listWarrantiesForSite(params: { companyId: string; siteId: string }) {
  const { companyId, siteId } = params;
  return prisma.warranty.findMany({ where: { companyId, siteId }, orderBy: { createdAt: "desc" }, include: { installedEquipment: true } });
}

export async function listWarrantiesForProject(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.warranty.findMany({ where: { companyId, projectId }, orderBy: { createdAt: "desc" }, include: { installedEquipment: true } });
}

export async function listWarrantiesForEquipment(params: { companyId: string; installedEquipmentId: string }) {
  const { companyId, installedEquipmentId } = params;
  return prisma.warranty.findMany({ where: { companyId, installedEquipmentId }, orderBy: { createdAt: "desc" } });
}

// The most relevant warranty for a piece of equipment right now — used to
// answer "is this equipment currently under warranty?" when logging a
// service request (spec section 11).
export async function findActiveWarrantyForEquipment(params: { companyId: string; installedEquipmentId: string }) {
  const { companyId, installedEquipmentId } = params;
  const rows = await prisma.warranty.findMany({
    where: { companyId, installedEquipmentId, status: { not: "CANCELLED" } },
    orderBy: { endDate: "desc" },
  });
  return rows.find((w) => {
    const s = computeWarrantyStatus(w);
    return s === "ACTIVE" || s === "EXPIRING_SOON";
  }) ?? null;
}

export async function listWarrantiesExpiringSoon(params: { companyId: string; thresholdDays?: number }) {
  const { companyId, thresholdDays = DEFAULT_EXPIRY_THRESHOLD_DAYS } = params;
  const rows = await prisma.warranty.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    include: { customer: true, installedEquipment: true },
    orderBy: { endDate: "asc" },
  });
  return rows.filter((w) => {
    const s = computeWarrantyStatus(w, new Date(), thresholdDays);
    return s === "EXPIRING_SOON" || s === "EXPIRED";
  });
}

export async function getWarrantyDashboardStats(companyId: string) {
  const rows = await prisma.warranty.findMany({ where: { companyId, status: { not: "CANCELLED" } } });
  const active = rows.filter((w) => computeWarrantyStatus(w) === "ACTIVE").length;
  const expiringSoon = rows.filter((w) => computeWarrantyStatus(w) === "EXPIRING_SOON").length;
  return { active, expiringSoon };
}
