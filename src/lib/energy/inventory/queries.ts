import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ProductType } from "./types";

export const PRODUCT_PAGE_SIZE = 20;

export type ProductStatusFilter = "all" | "active" | "inactive";
export type ProductSortKey = "name_asc" | "name_desc" | "code_asc" | "updated_desc";

export async function getDefaultLocation(companyId: string) {
  const existing = await prisma.location.findFirst({
    where: { companyId, isDefault: true },
  });
  if (existing) return existing;
  // Defensive fallback — every company is seeded with one, but don't hard
  // fail a stock action if it's somehow missing.
  return prisma.location.create({
    data: { companyId, name: "Main Warehouse", isDefault: true },
  });
}

export type ProductListParams = {
  companyId: string;
  q?: string;
  type?: ProductType | "all";
  categoryId?: string;
  brandId?: string;
  status?: ProductStatusFilter;
  page?: number;
  sort?: ProductSortKey;
};

function sortToOrderBy(sort: ProductSortKey | undefined): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "name_desc":
      return { name: "desc" };
    case "code_asc":
      return { code: "asc" };
    case "updated_desc":
      return { updatedAt: "desc" };
    case "name_asc":
    default:
      return { name: "asc" };
  }
}

export async function listProducts(params: ProductListParams) {
  const { companyId, q, type, categoryId, brandId, status = "all", page = 1, sort } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.ProductWhereInput = {
    companyId,
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(type && type !== "all" ? { type } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { model: { contains: q } },
          ],
        }
      : {}),
  };

  const defaultLocation = await getDefaultLocation(companyId);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: sortToOrderBy(sort),
      skip: (safePage - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
      include: {
        category: true,
        brand: true,
        unit: true,
        balances: { where: { locationId: defaultLocation.id } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize: PRODUCT_PAGE_SIZE };
}

export async function getProductById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.product.findFirst({
    where: { id, companyId },
    include: {
      category: true,
      brand: true,
      unit: true,
      defaultVendor: true,
      balances: { include: { location: true } },
    },
  });
}

export async function listStockMovements(params: { companyId: string; productId: string; take?: number }) {
  const { companyId, productId, take = 50 } = params;
  return prisma.stockMovement.findMany({
    where: { companyId, productId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: true, location: true },
  });
}

export async function listSerialNumbers(params: {
  companyId: string;
  productId?: string;
  status?: string;
  q?: string;
}) {
  const { companyId, productId, status, q } = params;
  return prisma.serialNumber.findMany({
    where: {
      companyId,
      ...(productId ? { productId } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(q ? { serialNumber: { contains: q } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { product: true, location: true },
  });
}

export async function listCategories(companyId: string, activeOnly = false) {
  return prisma.category.findMany({
    where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function listBrands(companyId: string, activeOnly = false) {
  return prisma.brand.findMany({
    where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function listUnits(companyId: string, activeOnly = false) {
  return prisma.unit.findMany({
    where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function getInventoryDashboard(companyId: string) {
  const defaultLocation = await getDefaultLocation(companyId);

  const [totalProducts, stockTrackedProducts, serialTrackedProducts, balances, recentMovements] =
    await Promise.all([
      prisma.product.count({ where: { companyId, isActive: true } }),
      prisma.product.count({ where: { companyId, isActive: true, stockTracked: true } }),
      prisma.product.count({ where: { companyId, isActive: true, serialTracked: true } }),
      prisma.inventoryBalance.findMany({
        where: { companyId, locationId: defaultLocation.id },
        include: { product: true },
      }),
      prisma.stockMovement.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { product: true, user: true },
      }),
    ]);

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalReserved = 0;
  let totalDamaged = 0;
  const lowStockItems: typeof balances = [];

  for (const balance of balances) {
    if (!balance.product.isActive || !balance.product.stockTracked) continue;
    const available = balance.totalQty - balance.reservedQty - balance.damagedQty;
    totalReserved += balance.reservedQty;
    totalDamaged += balance.damagedQty;
    if (balance.totalQty <= 0) {
      outOfStockCount += 1;
    } else if (
      balance.product.reorderLevel != null &&
      available <= balance.product.reorderLevel
    ) {
      lowStockCount += 1;
      lowStockItems.push(balance);
    }
  }

  return {
    totalProducts,
    stockTrackedProducts,
    serialTrackedProducts,
    lowStockCount,
    outOfStockCount,
    totalReserved,
    totalDamaged,
    lowStockItems: lowStockItems
      .sort((a, b) => a.totalQty - a.reservedQty - a.damagedQty - (b.totalQty - b.reservedQty - b.damagedQty))
      .slice(0, 10),
    recentMovements,
  };
}
