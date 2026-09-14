import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { computeAmcStatus, DEFAULT_EXPIRY_THRESHOLD_DAYS, type AmcDisplayStatus } from "./types";

export const AMC_PAGE_SIZE = 20;

export type AmcListParams = {
  companyId: string;
  q?: string;
  customerId?: string;
  siteId?: string;
  status?: AmcDisplayStatus | "all";
  page?: number;
};

export async function listAmcs(params: AmcListParams) {
  const { companyId, q, customerId, siteId, status, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.AMCWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(q
      ? {
          OR: [{ amcNumber: { contains: q } }, { customer: { name: { contains: q } } }],
        }
      : {}),
  };

  const rows = await prisma.aMC.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: true, site: true },
  });

  const filtered = status && status !== "all" ? rows.filter((a) => computeAmcStatus(a) === status) : rows;
  const start = (safePage - 1) * AMC_PAGE_SIZE;
  const items = filtered.slice(start, start + AMC_PAGE_SIZE);

  return { items, total: filtered.length, page: safePage, pageSize: AMC_PAGE_SIZE };
}

export async function getAmcById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  const amc = await prisma.aMC.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      site: true,
      project: true,
      maintenanceVisits: { orderBy: { visitDate: "desc" }, include: { technician: true } },
      serviceRequests: { orderBy: { createdAt: "desc" } },
      invoices: true,
    },
  });
  if (!amc) return null;
  const visitsUsed = amc.maintenanceVisits.filter((v) => v.status === "COMPLETED").length;
  return { ...amc, visitsUsed, visitsRemaining: Math.max(0, amc.numberOfVisits - visitsUsed) };
}

export async function listAmcsForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  return prisma.aMC.findMany({ where: { companyId, customerId }, orderBy: { createdAt: "desc" }, include: { site: true } });
}

export async function listAmcsForProject(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.aMC.findMany({ where: { companyId, projectId }, orderBy: { createdAt: "desc" } });
}

export async function listAmcsForSite(params: { companyId: string; siteId: string }) {
  const { companyId, siteId } = params;
  return prisma.aMC.findMany({ where: { companyId, siteId }, orderBy: { createdAt: "desc" } });
}

// The AMC most relevant to a customer/site right now — prefers one scoped
// to the given site over a customer-wide contract. Used to answer "does
// this equipment/customer have an active AMC?" without a separate
// AMC<->Equipment join table (see schema.prisma comment on AMC).
export async function findActiveAmcForCustomer(params: { companyId: string; customerId: string; siteId?: string | null }) {
  const { companyId, customerId, siteId } = params;
  const candidates = await prisma.aMC.findMany({
    where: { companyId, customerId, status: { notIn: ["CANCELLED", "DRAFT"] } },
    orderBy: { endDate: "desc" },
  });
  const active = candidates.filter((a) => computeAmcStatus(a) === "ACTIVE" || computeAmcStatus(a) === "EXPIRING_SOON");
  if (active.length === 0) return null;
  const siteScoped = siteId ? active.find((a) => a.siteId === siteId) : undefined;
  return siteScoped ?? active[0];
}

export async function listAmcsExpiringSoon(params: { companyId: string; thresholdDays?: number }) {
  const { companyId, thresholdDays = DEFAULT_EXPIRY_THRESHOLD_DAYS } = params;
  const rows = await prisma.aMC.findMany({
    where: { companyId, status: { notIn: ["CANCELLED", "DRAFT", "COMPLETED"] } },
    include: { customer: true, site: true },
    orderBy: { endDate: "asc" },
  });
  return rows.filter((a) => {
    const s = computeAmcStatus(a, new Date(), thresholdDays);
    return s === "EXPIRING_SOON" || s === "EXPIRED";
  });
}

export async function getAmcDashboardStats(companyId: string) {
  const rows = await prisma.aMC.findMany({ where: { companyId, status: { notIn: ["CANCELLED", "DRAFT"] } } });
  const active = rows.filter((a) => computeAmcStatus(a) === "ACTIVE").length;
  const expiringSoon = rows.filter((a) => computeAmcStatus(a) === "EXPIRING_SOON").length;
  return { active, expiringSoon };
}
