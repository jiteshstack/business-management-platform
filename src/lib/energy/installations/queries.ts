import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { InstallationStatus } from "./types";

export const INSTALLATION_PAGE_SIZE = 20;

export type InstallationListParams = {
  companyId: string;
  q?: string;
  status?: InstallationStatus | "all";
  technicianId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

export async function listInstallations(params: InstallationListParams) {
  const { companyId, q, status, technicianId, customerId, dateFrom, dateTo, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.InstallationWhereInput = {
    companyId,
    ...(status && status !== "all" ? { status } : {}),
    ...(technicianId ? { technicianId } : {}),
    ...(customerId ? { project: { customerId } } : {}),
    ...(dateFrom || dateTo
      ? {
          installationDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { installationNumber: { contains: q } },
            { project: { projectNumber: { contains: q } } },
            { project: { customer: { name: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.installation.findMany({
      where,
      orderBy: { installationDate: "desc" },
      skip: (safePage - 1) * INSTALLATION_PAGE_SIZE,
      take: INSTALLATION_PAGE_SIZE,
      include: { project: { include: { customer: true } }, site: true, technician: true },
    }),
    prisma.installation.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: INSTALLATION_PAGE_SIZE };
}

export async function getInstallationById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.installation.findFirst({
    where: { id, companyId },
    include: {
      project: { include: { customer: true } },
      site: true,
      technician: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true, projectItem: true } },
    },
  });
}

export async function listInstallationsForProject(params: { companyId: string; projectId: string }) {
  const { companyId, projectId } = params;
  return prisma.installation.findMany({
    where: { companyId, projectId },
    orderBy: { createdAt: "desc" },
    include: { technician: true, site: true },
  });
}
