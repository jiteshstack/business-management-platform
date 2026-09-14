import Link from "next/link";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getCustomerOutstandingSummary } from "@/lib/energy/payments/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

// A launcher/index page — the actual ledger table lives on each client's
// 360° page (Client 360 → Ledger tab) so there is exactly one ledger UI,
// not two.
export async function CustomerLedgerIndexView() {
  const session = await requireSession();

  const clients = await prisma.party.findMany({
    where: { companyId: session.companyId, type: "CLIENT", isActive: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    clients.map(async (c) => {
      const summary = await getCustomerOutstandingSummary(session.companyId, c.id);
      return { ...c, outstanding: summary.totalOutstanding };
    })
  );

  return (
    <div>
      <PageHeader title="Customer Ledger" description="Per-customer transaction ledger." />
      {rows.length === 0 ? (
        <EmptyState title="No clients yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/parties/clients/${c.id}?tab=ledger`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">₹{c.outstanding.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
