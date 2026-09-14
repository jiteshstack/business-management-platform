import { notFound } from "next/navigation";
import Link from "next/link";
import { Printer, Ban } from "lucide-react";
import { requireSession } from "@/lib/auth/current-session";
import { prisma } from "@/lib/db/client";
import { getPaymentById, listAllocatableInvoicesForClient } from "@/lib/energy/payments/queries";
import { cancelPaymentAction } from "@/lib/energy/payments/actions";
import { canCancelPayments } from "@/lib/core/permissions";
import { isPaymentDetailTabKey, PAYMENT_MODE_LABELS, type PaymentDetailTabKey } from "@/lib/energy/payments/types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentStatusBadge } from "./status-badge";
import { PaymentTabs } from "./payment-tabs";
import { AllocateForm } from "./allocate-form";

export async function PaymentDetailView({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const payment = await getPaymentById({ companyId: session.companyId, id });
  if (!payment) notFound();

  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "overview";
  const tab: PaymentDetailTabKey = isPaymentDetailTabKey(rawTab) ? rawTab : "overview";

  const canCancel = canCancelPayments(session.role);

  return (
    <div>
      <PageHeader
        title={payment.paymentNumber}
        description={payment.client.name}
        actions={
          <>
            <PaymentStatusBadge status={payment.status} />
            <span className="text-sm font-semibold text-slate-900">₹{payment.amount.toLocaleString("en-IN")}</span>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={`/sales/payments-received/${id}/receipt`} target="_blank">
          <Button variant="secondary" size="sm">
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
        </Link>
        {canCancel && payment.status !== "CANCELLED" ? (
          <form action={cancelPaymentAction.bind(null, id)}>
            <Button type="submit" variant="danger" size="sm">
              <Ban className="h-4 w-4" />
              Cancel Payment
            </Button>
          </form>
        ) : null}
      </div>

      <PaymentTabs basePath={`/sales/payments-received/${id}`} active={tab} />

      {tab === "overview" ? <OverviewTab payment={payment} /> : null}
      {tab === "allocations" ? <AllocationsTab payment={payment} companyId={session.companyId} /> : null}
      {tab === "activity" ? <ActivityTab companyId={session.companyId} paymentId={id} /> : null}
    </div>
  );
}

type PaymentWithRelations = NonNullable<Awaited<ReturnType<typeof getPaymentById>>>;

function OverviewTab({ payment }: { payment: PaymentWithRelations }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          <OverviewField label="Client" value={payment.client.name} />
          <OverviewField label="Amount" value={`₹${payment.amount.toLocaleString("en-IN")}`} />
          <OverviewField label="Payment Date" value={payment.paymentDate.toLocaleDateString()} />
          <OverviewField label="Mode" value={PAYMENT_MODE_LABELS[payment.mode as keyof typeof PAYMENT_MODE_LABELS] ?? payment.mode} />
          <OverviewField label="Reference Number" value={payment.referenceNumber} />
          {payment.mode === "CHEQUE" ? (
            <>
              <OverviewField label="Cheque Number" value={payment.chequeNumber} />
              <OverviewField label="Cheque Date" value={payment.chequeDate?.toLocaleDateString()} />
              <OverviewField label="Bank Name" value={payment.bankName} />
            </>
          ) : null}
          {payment.notes ? (
            <div className="sm:col-span-2">
              <OverviewField label="Notes" value={payment.notes} />
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <Row label="Payment Amount" value={payment.amount} />
          <Row label="Allocated" value={payment.allocatedAmount} />
          <div className="border-t border-slate-200 pt-2">
            <Row label="Unallocated" value={payment.unallocatedAmount} bold />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-base" : ""}`}>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-700"}>
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

async function AllocationsTab({ payment, companyId }: { payment: PaymentWithRelations; companyId: string }) {
  const candidateInvoices =
    payment.status === "CANCELLED"
      ? []
      : await listAllocatableInvoicesForClient({ companyId, clientId: payment.clientId });
  // Exclude invoices this payment is already fully carrying (still allow
  // topping up ones it's partially allocated to — those remain candidates
  // since the invoice itself still has outstanding balance).

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Allocated To</p>
          {payment.allocations.length === 0 ? (
            <p className="text-sm text-slate-400">Not allocated to any invoice yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Invoice</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.allocations.map((alloc) => (
                    <tr key={alloc.id}>
                      <td className="px-4 py-2.5">
                        <Link href={`/sales/invoices/${alloc.invoiceId}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                          {alloc.invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">₹{alloc.amount.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-medium">
                    <td className="px-4 py-2.5">Total allocated</td>
                    <td className="px-4 py-2.5 text-right">₹{payment.allocatedAmount.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-slate-500">Unallocated</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">₹{payment.unallocatedAmount.toLocaleString("en-IN")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {payment.status === "CANCELLED" ? (
        <EmptyState title="This payment is cancelled" description="Its allocations have been reversed and it can no longer be allocated." />
      ) : payment.unallocatedAmount > 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Allocate to Another Invoice</p>
            <AllocateForm paymentId={payment.id} unallocatedAmount={payment.unallocatedAmount} invoices={candidateInvoices} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function ActivityTab({ companyId, paymentId }: { companyId: string; paymentId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entityType: "Payment", entityId: paymentId },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
  if (logs.length === 0) {
    return <EmptyState title="No activity yet" />;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-slate-700">
            <span className="font-medium">{log.user?.name ?? "System"}</span> {log.action.toLowerCase().replaceAll("_", " ")}
          </span>
          <span className="text-xs text-slate-400">{log.createdAt.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function OverviewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || <span className="text-slate-400">-</span>}</p>
    </div>
  );
}
