import "server-only";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/energy/shared/pricing";
import { getProjectCommercialSummary } from "@/lib/energy/projects/queries";
import { getProjectExpenseTotal } from "@/lib/energy/expenses/queries";

// ---- Project-level cost/profitability estimate ----
//
// This is deliberately NOT statutory accounting profit. Product only has a
// single `purchasePrice` field (no weighted-average/FIFO batch costing — see
// PROJECT_STATE.md "Phase 10 detail" for why), so Material Cost here is
// installedQuantity × product.purchasePrice — the simplest defensible
// estimate supported by the existing inventory model, and it deliberately
// uses INSTALLED quantity (not required/purchased) so unused/unassigned
// inventory is never counted as project cost (spec section 16).

export type ProjectCostBreakdown = {
  materialCost: number;
  serviceCost: number;
  expenseCost: number;
  totalCost: number;
};

export async function getProjectCostBreakdown(params: { companyId: string; projectId: string }): Promise<ProjectCostBreakdown> {
  const { companyId, projectId } = params;

  const [items, partsUsed, expenseTotal] = await Promise.all([
    prisma.projectItem.findMany({ where: { projectId }, include: { product: true } }),
    prisma.servicePartUsage.findMany({
      where: { maintenanceVisit: { companyId, projectId } },
      include: { product: true },
    }),
    getProjectExpenseTotal({ companyId, projectId }),
  ]);

  const materialCost = round2(items.reduce((sum, item) => sum + item.installedQuantity * (item.product?.purchasePrice ?? 0), 0));
  const serviceCost = round2(partsUsed.reduce((sum, part) => sum + part.quantity * (part.product?.purchasePrice ?? 0), 0));

  return {
    materialCost,
    serviceCost,
    expenseCost: round2(expenseTotal),
    totalCost: round2(materialCost + serviceCost + expenseTotal),
  };
}

export type ProjectProfitability = {
  projectId: string;
  projectNumber: string;
  name: string;
  customerName: string;
  status: string;
  type: string;
  revenue: number; // invoiced amount - never the full SO value once invoices exist
  contractValue: number;
  materialCost: number;
  serviceCost: number;
  expenseCost: number;
  totalCost: number;
  estimatedProfit: number;
  estimatedMargin: number;
};

export async function getProjectProfitability(params: { companyId: string; projectId: string }): Promise<ProjectProfitability | null> {
  const { companyId, projectId } = params;
  const project = await prisma.energyProject.findFirst({ where: { id: projectId, companyId }, include: { customer: true } });
  if (!project) return null;

  const [commercial, cost] = await Promise.all([
    getProjectCommercialSummary({ companyId, salesOrderId: project.salesOrderId }),
    getProjectCostBreakdown({ companyId, projectId }),
  ]);

  const revenue = commercial?.invoiced ?? 0;
  const estimatedProfit = round2(revenue - cost.totalCost);
  const estimatedMargin = revenue > 0 ? round2((estimatedProfit / revenue) * 100) : 0;

  return {
    projectId: project.id,
    projectNumber: project.projectNumber,
    name: project.name,
    customerName: project.customer.name,
    status: project.status,
    type: project.type,
    revenue,
    contractValue: commercial?.contractValue ?? 0,
    materialCost: cost.materialCost,
    serviceCost: cost.serviceCost,
    expenseCost: cost.expenseCost,
    totalCost: cost.totalCost,
    estimatedProfit,
    estimatedMargin,
  };
}

export type ProjectProfitabilityListParams = {
  companyId: string;
  customerId?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
};

const PAGE_SIZE = 20;

// Cost breakdown is computed per project, but only for the current page's
// projects (bounded at PAGE_SIZE) — never for the whole project table at
// once (spec section 38).
export async function listProjectProfitability(params: ProjectProfitabilityListParams) {
  const { companyId, customerId, status, type, dateFrom, dateTo, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const where: Prisma.EnergyProjectWhereInput = {
    companyId,
    ...(customerId ? { customerId } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.energyProject.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: true },
    }),
    prisma.energyProject.count({ where }),
  ]);

  const items: ProjectProfitability[] = await Promise.all(
    projects.map(async (project) => {
      const [commercial, cost] = await Promise.all([
        getProjectCommercialSummary({ companyId, salesOrderId: project.salesOrderId }),
        getProjectCostBreakdown({ companyId, projectId: project.id }),
      ]);
      const revenue = commercial?.invoiced ?? 0;
      const estimatedProfit = round2(revenue - cost.totalCost);
      const estimatedMargin = revenue > 0 ? round2((estimatedProfit / revenue) * 100) : 0;
      return {
        projectId: project.id,
        projectNumber: project.projectNumber,
        name: project.name,
        customerName: project.customer.name,
        status: project.status,
        type: project.type,
        revenue,
        contractValue: commercial?.contractValue ?? 0,
        materialCost: cost.materialCost,
        serviceCost: cost.serviceCost,
        expenseCost: cost.expenseCost,
        totalCost: cost.totalCost,
        estimatedProfit,
        estimatedMargin,
      };
    })
  );

  return { items, total, page: safePage, pageSize: PAGE_SIZE };
}

export type CustomerProfitability = {
  customerId: string;
  customerName: string;
  projectCount: number;
  contractValue: number;
  revenue: number;
  collected: number;
  totalCost: number;
  estimatedProfit: number;
  estimatedMargin: number;
};

// Customer profitability aggregates each customer's OWN projects — a
// customer's cost is the sum of their projects' material/service/expense
// costs, since Expense/Purchase records have no direct customer link (only
// a project/vendor link). No vendor invoice or vendor payment is ever
// counted here (spec section 49).
export async function listCustomerProfitability(params: { companyId: string; page?: number }) {
  const { companyId, page = 1 } = params;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const customers = await prisma.party.findMany({
    where: { companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.party.count({ where: { companyId, type: "CLIENT", isActive: true } });

  const items: CustomerProfitability[] = await Promise.all(
    customers.map(async (customer) => {
      const [invoiceAgg, paidAgg, projects] = await Promise.all([
        prisma.invoice.aggregate({
          where: { companyId, clientId: customer.id, status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
          _sum: { grandTotal: true },
        }),
        prisma.invoice.aggregate({
          where: { companyId, clientId: customer.id, status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
          _sum: { paidAmount: true },
        }),
        prisma.energyProject.findMany({ where: { companyId, customerId: customer.id }, select: { id: true } }),
      ]);

      const costBreakdowns = await Promise.all(projects.map((p) => getProjectCostBreakdown({ companyId, projectId: p.id })));
      const totalCost = round2(costBreakdowns.reduce((sum, c) => sum + c.totalCost, 0));
      const revenue = invoiceAgg._sum.grandTotal ?? 0;
      const estimatedProfit = round2(revenue - totalCost);
      const estimatedMargin = revenue > 0 ? round2((estimatedProfit / revenue) * 100) : 0;

      return {
        customerId: customer.id,
        customerName: customer.name,
        projectCount: projects.length,
        contractValue: 0,
        revenue,
        collected: paidAgg._sum.paidAmount ?? 0,
        totalCost,
        estimatedProfit,
        estimatedMargin,
      };
    })
  );

  return { items, total, page: safePage, pageSize: PAGE_SIZE };
}
