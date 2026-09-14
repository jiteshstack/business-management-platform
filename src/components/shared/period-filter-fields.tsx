"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { REPORT_PERIODS, REPORT_PERIOD_LABELS, type ReportPeriod } from "@/lib/energy/reporting/period";

// Embeds into any existing <form method="get"> filter bar — reused by the
// Dashboard, Reports hub, and Profitability views so there is exactly one
// period-selection UI in the app (spec section 29/31).
export function PeriodFilterFields({
  period,
  from,
  to,
}: {
  period: ReportPeriod;
  from?: string;
  to?: string;
}) {
  const [value, setValue] = useState<ReportPeriod>(period);

  return (
    <>
      <div>
        <label htmlFor="period" className="mb-1 block text-sm font-medium text-slate-700">
          Period
        </label>
        <Select id="period" name="period" value={value} onChange={(e) => setValue(e.target.value as ReportPeriod)} className="w-40">
          {REPORT_PERIODS.map((p) => (
            <option key={p} value={p}>
              {REPORT_PERIOD_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>
      {value === "CUSTOM" ? (
        <>
          <div>
            <label htmlFor="from" className="mb-1 block text-sm font-medium text-slate-700">
              From
            </label>
            <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-sm font-medium text-slate-700">
              To
            </label>
            <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
          </div>
        </>
      ) : null}
    </>
  );
}
