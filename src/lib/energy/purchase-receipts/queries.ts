import "server-only";
import { prisma } from "@/lib/db/client";

export async function getPurchaseReceiptById(params: { companyId: string; id: string }) {
  const { companyId, id } = params;
  return prisma.purchaseReceipt.findFirst({
    where: { id, companyId },
    include: {
      vendor: true,
      location: true,
      purchaseOrder: true,
      items: { orderBy: { sortOrder: "asc" }, include: { product: true } },
    },
  });
}

export async function listPurchaseReceipts(params: {
  companyId: string;
  q?: string;
  page?: number;
}) {
  const { companyId, q, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pageSize = 20;

  const where = {
    companyId,
    ...(q
      ? {
          OR: [
            { receiptNumber: { contains: q } },
            { vendor: { name: { contains: q } } },
            { purchaseOrder: { poNumber: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where,
      orderBy: { receiptDate: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: { vendor: true, purchaseOrder: true },
    }),
    prisma.purchaseReceipt.count({ where }),
  ]);

  return { items, total, page: safePage, pageSize };
}
