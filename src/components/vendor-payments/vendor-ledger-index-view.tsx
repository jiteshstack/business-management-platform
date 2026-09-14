import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getVendorOutstandingSummary } from "@/lib/energy/vendor-payments/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

// A launcher/index page — the actual ledger table lives on each vendor's
// 360° page (Vendor 360 → Ledger tab) so there is exactly one ledger UI.
export async function VendorLedgerIndexView() {
  const session = await requireSession();

  const vendors = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "VENDOR", isActive: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    vendors.map(async (v) => {
      const summary = await getVendorOutstandingSummary(session.companyId, v.id);
      return { ...v, outstanding: summary.totalOutstanding };
    })
  );

  return (
    <div>
      <PageHeader title="Vendor Ledger" description="Per-vendor transaction ledger." />
      {rows.length === 0 ? (
        <EmptyState title="No vendors yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/parties/vendors/${v.id}?tab=ledger`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">₹{v.outstanding.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
