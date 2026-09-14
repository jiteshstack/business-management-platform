import Link from "next/link";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { key: "company", label: "Company" },
  { key: "categories", label: "Product Categories" },
  { key: "brands", label: "Brands" },
  { key: "units", label: "Units" },
  { key: "expense-categories", label: "Expense Categories" },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

export function isSettingsTabKey(value: string): value is SettingsTabKey {
  return (SETTINGS_TABS.map((t) => t.key) as string[]).includes(value);
}

export function SettingsTabs({ active }: { active: SettingsTabKey }) {
  return (
    <div className="mb-6 overflow-x-auto border-b border-slate-200">
      <nav aria-label="Settings tabs" className="flex min-w-max gap-1">
        {SETTINGS_TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.key === "company" ? "/settings" : `/settings?tab=${tab.key}`}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                isActive
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
