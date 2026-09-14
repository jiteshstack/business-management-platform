import Link from "next/link";
import { cn } from "@/lib/utils";
import { VENDOR_PAYMENT_DETAIL_TABS, type VendorPaymentDetailTabKey } from "@/lib/energy/vendor-payments/types";

export function VendorPaymentTabs({ basePath, active }: { basePath: string; active: VendorPaymentDetailTabKey }) {
  return (
    <div className="mb-6 overflow-x-auto border-b border-slate-200">
      <nav aria-label="Vendor payment detail tabs" className="flex min-w-max gap-1">
        {VENDOR_PAYMENT_DETAIL_TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.key === "overview" ? basePath : `${basePath}?tab=${tab.key}`}
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
