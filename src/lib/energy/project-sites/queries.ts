import "server-only";
import { prisma } from "@/lib/db/client";

export const PROJECT_SITE_PAGE_SIZE = 20;

export async function listProjectSites(params: { companyId: string; q?: string; customerId?: string; page?: number }) {
  const { companyId, q, customerId, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { city: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.projectSite.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (safePage - 1) * PROJECT_SITE_PAGE_SIZE,
      take: PROJECT_SITE_PAGE_SIZE,
      include: { customer: true },
    }),
    prisma.projectSite.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: PROJECT_SITE_PAGE_SIZE };
}

export async function getProjectSiteById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.projectSite.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      projects: { orderBy: { createdAt: "desc" } },
      installations: { orderBy: { installationDate: "desc" } },
    },
  });
}

export async function listSitesForParty(params: { companyId: string; customerId: string }) {
  const { companyId, customerId } = params;
  return prisma.projectSite.findMany({
    where: { companyId, customerId },
    orderBy: { name: "asc" },
  });
}
