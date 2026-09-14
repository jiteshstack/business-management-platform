// "Candidate" reminder categories are computed live from open invoices, not
// stored — a PaymentReminder row only exists once a user actually logs a
// follow-up action against one of these candidates.
export const REMINDER_TYPES = ["UPCOMING", "DUE_TODAY", "OVERDUE", "PARTIAL_PAYMENT"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  UPCOMING: "Upcoming",
  DUE_TODAY: "Due Today",
  OVERDUE: "Overdue",
  PARTIAL_PAYMENT: "Partial Payment",
};

export const REMINDER_STATUSES = ["PENDING", "SENT"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  PENDING: "Pending",
  SENT: "Sent",
};

// How many days out counts as "upcoming" for the reminder list.
export const UPCOMING_WINDOW_DAYS = 7;
