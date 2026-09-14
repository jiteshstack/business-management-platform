// One shared date-range resolver reused by the Dashboard period selector,
// Reports, and Profitability — so there is exactly one implementation of
// "This Month" / "This Quarter" / etc. across the whole app (spec section 29).

export const REPORT_PERIODS = [
  "TODAY",
  "THIS_WEEK",
  "THIS_MONTH",
  "LAST_MONTH",
  "THIS_QUARTER",
  "THIS_YEAR",
  "CUSTOM",
] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  TODAY: "Today",
  THIS_WEEK: "This Week",
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  THIS_QUARTER: "This Quarter",
  THIS_YEAR: "This Year",
  CUSTOM: "Custom Range",
};

export type ResolvedPeriod = { from: Date; to: Date; label: string };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function resolvePeriodRange(
  period: ReportPeriod,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date()
): ResolvedPeriod {
  switch (period) {
    case "TODAY":
      return { from: startOfDay(now), to: endOfDay(now), label: REPORT_PERIOD_LABELS.TODAY };
    case "THIS_WEEK": {
      const day = now.getDay(); // 0=Sun
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      return { from: startOfDay(monday), to: endOfDay(now), label: REPORT_PERIOD_LABELS.THIS_WEEK };
    }
    case "THIS_MONTH":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(now),
        label: REPORT_PERIOD_LABELS.THIS_MONTH,
      };
    case "LAST_MONTH": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to, label: REPORT_PERIOD_LABELS.LAST_MONTH };
    }
    case "THIS_QUARTER": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: new Date(now.getFullYear(), quarterStartMonth, 1),
        to: endOfDay(now),
        label: REPORT_PERIOD_LABELS.THIS_QUARTER,
      };
    }
    case "THIS_YEAR":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now), label: REPORT_PERIOD_LABELS.THIS_YEAR };
    case "CUSTOM": {
      const from = customFrom ? startOfDay(new Date(customFrom)) : new Date(now.getFullYear(), now.getMonth(), 1);
      const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
      return { from, to, label: REPORT_PERIOD_LABELS.CUSTOM };
    }
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now), label: REPORT_PERIOD_LABELS.THIS_MONTH };
  }
}

export function isReportPeriod(value: string | undefined): value is ReportPeriod {
  return !!value && (REPORT_PERIODS as readonly string[]).includes(value);
}
