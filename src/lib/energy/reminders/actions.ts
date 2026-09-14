"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/current-session";
import { recordAudit } from "@/lib/core/audit";
import { canManageReminders } from "@/lib/core/permissions";
import { str } from "@/lib/core/form-state";
import { isReminderType } from "./queries";

const REMINDERS_PATH = "/sales/payment-reminders";

function requireReminderManager(role: Parameters<typeof canManageReminders>[0]) {
  if (!canManageReminders(role)) {
    throw new Error("You don't have permission to manage payment reminders.");
  }
}

// Logs a follow-up against an invoice (the primary "Mark reminder sent"
// action). Snapshots the invoice's outstanding/due date at the moment the
// reminder is logged, since those can keep changing afterward.
export async function logReminderAction(invoiceId: string, type: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  requireReminderManager(session.role);

  if (!isReminderType(type)) {
    throw new Error("Invalid reminder type.");
  }

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: session.companyId } });
  if (!invoice) throw new Error("This invoice no longer exists.");

  const notes = str(formData, "notes");
  const nextFollowUpDate = str(formData, "nextFollowUpDate");

  const reminder = await prisma.paymentReminder.create({
    data: {
      companyId: session.companyId,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      type,
      status: "SENT",
      outstandingAtReminder: invoice.outstandingAmount,
      dueDateAtReminder: invoice.dueDate,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      notes,
      createdBy: session.userId,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "REMINDER_LOGGED",
    entityType: "PaymentReminder",
    entityId: reminder.id,
    after: { invoiceId, type, outstanding: invoice.outstandingAmount },
  });

  revalidatePath(REMINDERS_PATH);
  revalidatePath(`/sales/invoices/${invoiceId}`);
}

export async function addFollowUpNoteAction(reminderId: string, formData: FormData): Promise<void> {
  const session = await requireSession();
  requireReminderManager(session.role);

  const reminder = await prisma.paymentReminder.findFirst({
    where: { id: reminderId, companyId: session.companyId },
  });
  if (!reminder) throw new Error("This reminder no longer exists.");

  const notes = str(formData, "notes");
  const nextFollowUpDate = str(formData, "nextFollowUpDate");

  await prisma.paymentReminder.update({
    where: { id: reminderId },
    data: {
      notes: notes ?? reminder.notes,
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : reminder.nextFollowUpDate,
    },
  });

  await recordAudit({
    companyId: session.companyId,
    userId: session.userId,
    action: "REMINDER_FOLLOW_UP_ADDED",
    entityType: "PaymentReminder",
    entityId: reminderId,
    after: { notes, nextFollowUpDate },
  });

  revalidatePath(REMINDERS_PATH);
  revalidatePath(`/sales/invoices/${reminder.invoiceId}`);
}
