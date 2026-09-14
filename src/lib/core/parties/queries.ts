import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { PartyType } from "./types";

export const PARTY_PAGE_SIZE = 20;

export type PartyStatusFilter = "all" | "active" | "inactive";
export type PartySortKey = "name_asc" | "name_desc" | "updated_desc" | "city_asc";

export type PartyListParams = {
  companyId: string;
  type: PartyType;
  q?: string;
  status?: PartyStatusFilter;
  page?: number;
  sort?: PartySortKey;
};

function sortToOrderBy(sort: PartySortKey | undefined): Prisma.PartyOrderByWithRelationInput {
  switch (sort) {
    case "name_desc":
      return { name: "desc" };
    case "updated_desc":
      return { updatedAt: "desc" };
    case "city_asc":
      return { city: "asc" };
    case "name_asc":
    default:
      return { name: "asc" };
  }
}

export async function listParties(params: PartyListParams) {
  const { companyId, type, q, status = "all", page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.PartyWhereInput = {
    companyId,
    type,
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { businessName: { contains: q } },
            { mobile: { contains: q } },
            { email: { contains: q } },
            { gstin: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.party.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * PARTY_PAGE_SIZE,
      take: PARTY_PAGE_SIZE,
    }),
    prisma.party.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: PARTY_PAGE_SIZE };
}

export async function getPartyById(params: { companyId: string; type: PartyType; id: string }) {
  const { companyId, type, id } = params;
  return prisma.party.findFirst({
    where: { id, companyId, type },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true } },
    },
  });
}

export async function getPartyDocuments(params: { companyId: string; partyId: string }) {
  const { companyId, partyId } = params;
  return prisma.document.findMany({
    where: { companyId, entityType: "PARTY", entityId: partyId },
    orderBy: { createdAt: "desc" },
    include: { uploader: true },
  });
}

export async function getPartyCounts(params: { companyId: string; type: PartyType }) {
  const { companyId, type } = params;
  const [active, inactive] = await Promise.all([
    prisma.party.count({ where: { companyId, type, isActive: true } }),
    prisma.party.count({ where: { companyId, type, isActive: false } }),
  ]);
  return { active, inactive, total: active + inactive };
}
