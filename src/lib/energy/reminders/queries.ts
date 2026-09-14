import "server-only";
import { prisma } from "@/lib/db/client";
import { REMINDER_TYPES, UPCOMING_WINDOW_DAYS, type ReminderType } from "./types";

export type ReminderCandidate = {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  dueDate: Date | null;
  outstandingAmount: number;
  paidAmount: number;
  daysOverdue: number;
  type: ReminderType;
  lastReminderAt: Date | null;
  lastReminderStatus: string | null;
  nextFollowUpDate: Date | null;
};

function categorize(dueDate: Date | null, paidAmount: number, now: Date): ReminderType | null {
  if (paidAmount > 0) return "PARTIAL_PAYMENT";
  if (!dueDate) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  if (dueDate >= startOfToday && dueDate < endOfToday) return "DUE_TODAY";
  if (dueDate < startOfToday) return "OVERDUE";
  const upcomingCutoff = new Date(startOfToday);
  upcomingCutoff.setDate(upcomingCutoff.getDate() + UPCOMING_WINDOW_DAYS);
  if (dueDate < upcomingCutoff) return "UPCOMING";
  return null;
}

// Live-computed list of invoices that need collections attention — not
// stored. Each candidate is annotated with the most recent manually-logged
// PaymentReminder (if any) purely for display ("last reminder"/"next
// follow-up").
export async function listReminderCandidates(params: {
  companyId: string;
  type?: ReminderType | "all";
  clientId?: string;
}): Promise<ReminderCandidate[]> {
  const { companyId, type, clientId } = params;
  const now = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true },
    orderBy: { dueDate: "asc" },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const reminders = await prisma.paymentReminder.findMany({
    where: { companyId, invoiceId: { in: invoiceIds } },
    orderBy: { reminderDate: "desc" },
  });
  const latestByInvoice = new Map<string, (typeof reminders)[number]>();
  for (const r of reminders) {
    if (!latestByInvoice.has(r.invoiceId)) latestByInvoice.set(r.invoiceId, r);
  }

  const candidates: ReminderCandidate[] = [];
  for (const inv of invoices) {
    const category = categorize(inv.dueDate, inv.paidAmount, now);
    if (!category) continue;
    if (type && type !== "all" && category !== type) continue;

    const latest = latestByInvoice.get(inv.id);
    const daysOverdue = inv.dueDate
      ? Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

    candidates.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.client.name,
      dueDate: inv.dueDate,
      outstandingAmount: inv.outstandingAmount,
      paidAmount: inv.paidAmount,
      daysOverdue,
      type: category,
      lastReminderAt: latest?.reminderDate ?? null,
      lastReminderStatus: latest?.status ?? null,
      nextFollowUpDate: latest?.nextFollowUpDate ?? null,
    });
  }

  return candidates;
}

export async function getReminderCounts(companyId: string) {
  const all = await listReminderCandidates({ companyId });
  const counts: Record<ReminderType, number> = {
    UPCOMING: 0,
    DUE_TODAY: 0,
    OVERDUE: 0,
    PARTIAL_PAYMENT: 0,
  };
  for (const c of all) counts[c.type] += 1;
  return counts;
}

export async function listRemindersForInvoice(params: { companyId: string; invoiceId: string }) {
  const { companyId, invoiceId } = params;
  return prisma.paymentReminder.findMany({
    where: { companyId, invoiceId },
    orderBy: { reminderDate: "desc" },
  });
}

export function isReminderType(value: string): value is ReminderType {
  return (REMINDER_TYPES as readonly string[]).includes(value);
}
