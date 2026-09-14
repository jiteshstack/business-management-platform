import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/current-session";
import { canViewProfitability } from "@/lib/core/permissions";
import { resolvePeriodRange, isReportPeriod, type ReportPeriod } from "@/lib/energy/reporting/period";
import { getSalesByCustomer, getVendorPurchases } from "@/lib/energy/reporting/queries";
import { listExpenses } from "@/lib/energy/expenses/queries";
import { listReceivables } from "@/lib/energy/payments/queries";
import { listPayables } from "@/lib/energy/vendor-payments/queries";
import { listProjectProfitability } from "@/lib/energy/reporting/project-profitability";

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function csvResponse(fileName: string, csv: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Simple CSV export for the handful of reports the spec prioritizes (Sales,
// Purchases, Receivables, Payables, Expenses, Project Profitability) — each
// reuses the exact same tenant-scoped query function the on-screen report
// uses, so the export can never drift from what's displayed.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const periodParam = url.searchParams.get("period") ?? undefined;
  const period: ReportPeriod = isReportPeriod(periodParam) ? (periodParam as ReportPeriod) : "THIS_MONTH";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const range = resolvePeriodRange(period, from, to);

  switch (type) {
    case "sales": {
      const rows = await getSalesByCustomer(session.companyId, range);
      return csvResponse("sales.csv", toCsv(["Customer", "Invoices", "Invoiced"], rows.map((r) => [r.clientName, r.count, r.invoiced])));
    }
    case "purchases": {
      const rows = await getVendorPurchases(session.companyId, range);
      return csvResponse("purchases.csv", toCsv(["Vendor", "Vendor Invoices", "Purchased"], rows.map((r) => [r.vendorName, r.count, r.purchased])));
    }
    case "expenses": {
      const { items } = await listExpenses({ companyId: session.companyId, page: 1 });
      return csvResponse(
        "expenses.csv",
        toCsv(
          ["Expense Number", "Date", "Category", "Vendor/Payee", "Project", "Amount", "Status"],
          items.map((e) => [e.expenseNumber, e.expenseDate.toISOString().slice(0, 10), e.category.name, e.vendor?.name ?? "", e.project?.projectNumber ?? "", e.grandTotal, e.status])
        )
      );
    }
    case "receivables": {
      const { items } = await listReceivables({ companyId: session.companyId, page: 1 });
      return csvResponse(
        "receivables.csv",
        toCsv(
          ["Invoice", "Customer", "Due Date", "Total", "Paid", "Outstanding"],
          items.map((i) => [i.invoiceNumber, i.client.name, i.dueDate?.toISOString().slice(0, 10) ?? "", i.grandTotal, i.paidAmount, i.outstandingAmount])
        )
      );
    }
    case "payables": {
      const { items } = await listPayables({ companyId: session.companyId, page: 1 });
      return csvResponse(
        "payables.csv",
        toCsv(
          ["Vendor Invoice", "Vendor", "Due Date", "Total", "Paid", "Outstanding"],
          items.map((i) => [i.invoiceNumber, i.vendor.name, i.dueDate?.toISOString().slice(0, 10) ?? "", i.grandTotal, i.paidAmount, i.outstandingAmount])
        )
      );
    }
    case "project-profitability": {
      if (!canViewProfitability(session.role)) return new NextResponse("Forbidden", { status: 403 });
      const { items } = await listProjectProfitability({ companyId: session.companyId, page: 1 });
      return csvResponse(
        "project-profitability.csv",
        toCsv(
          ["Project", "Customer", "Revenue", "Direct Cost", "Expenses", "Estimated Profit", "Margin %"],
          items.map((p) => [p.projectNumber, p.customerName, p.revenue, p.materialCost + p.serviceCost, p.expenseCost, p.estimatedProfit, p.estimatedMargin])
        )
      );
    }
    default:
      return new NextResponse("Unknown export type", { status: 400 });
  }
}
