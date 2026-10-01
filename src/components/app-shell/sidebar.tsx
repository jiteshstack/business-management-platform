"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Truck,
  Boxes,
  HardHat,
  Wrench,
  ShieldCheck,
  Wallet,
  BarChart3,
  Settings,
  UserRound,
  FileText,
  ClipboardList,
  Receipt,
  HandCoins,
  ShoppingBag,
  Banknote,
  Package,
  ScanLine,
  ClipboardCheck,
  Hammer,
  CalendarClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookUser,
  BookMarked,
  ArrowLeftRight,
  BellRing,
  PackageCheck,
  MapPin,
  CalendarCheck2,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/lib/core/nav";
import type { ModuleKey } from "@/lib/core/permissions";

const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  parties: Users,
  sales: ShoppingCart,
  purchase: Truck,
  inventory: Boxes,
  projects: HardHat,
  service: Wrench,
  warranty: ShieldCheck,
  finance: Wallet,
  reports: BarChart3,
  settings: Settings,
};

// Per-leaf icons for items inside a group (Dashboard/Warranty/Reports/Settings
// are single links and use MODULE_ICONS directly instead).
const LEAF_ICONS: Record<string, LucideIcon> = {
  "/parties/clients": UserRound,
  "/parties/vendors": Truck,
  "/sales/quotations": FileText,
  "/sales/sales-orders": ClipboardList,
  "/sales/invoices": Receipt,
  "/sales/payments-received": HandCoins,
  "/sales/payment-reminders": BellRing,
  "/purchase/purchase-orders": ShoppingBag,
  "/purchase/purchase-receipts": PackageCheck,
  "/purchase/vendor-invoices": Receipt,
  "/purchase/payments-made": Banknote,
  "/inventory/products": Package,
  "/inventory/stock": Boxes,
  "/inventory/serial-numbers": ScanLine,
  "/projects": ClipboardCheck,
  "/projects/sites": MapPin,
  "/projects/installations": Hammer,
  "/service/service-requests": Wrench,
  "/service/amc": CalendarClock,
  "/service/maintenance": CalendarCheck2,
  "/warranty/equipment": ScanLine,
  "/warranty/warranties": ShieldCheck,
  "/finance/receivables": ArrowDownToLine,
  "/finance/payables": ArrowUpFromLine,
  "/finance/customer-ledger": BookUser,
  "/finance/vendor-ledger": BookMarked,
  "/finance/transactions": ArrowLeftRight,
  "/finance/expenses": Banknote,
  "/finance/profitability": LineChart,
};

export function Sidebar({
  sections,
  companyName,
  open,
  collapsed,
  onNavigate,
  onToggleCollapsed,
}: {
  sections: NavSection[];
  companyName: string;
  open: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();

  function sectionForPathname(currentPathname: string): string | undefined {
    return sections.find(
      (section) =>
        (section.href && isPathMatch(currentPathname, section.href)) ||
        section.items?.some((item) => isPathMatch(currentPathname, item.href))
    )?.label;
  }

  // Exactly one link is ever "active": a naive per-item prefix check would
  // mark both "Projects" (/projects) and "Sites" (/projects/sites) active at
  // once on a Sites page, since /projects is itself a prefix of /projects/sites.
  // Picking the single longest (most specific) matching href across the whole
  // sidebar avoids that ambiguity regardless of how nav sections are nested.
  const activeHref = (() => {
    const allHrefs = sections.flatMap((section) => [
      ...(section.href ? [section.href] : []),
      ...(section.items?.map((item) => item.href) ?? []),
    ]);
    const matches = allHrefs.filter((href) => isPathMatch(pathname, href));
    return matches.reduce<string | undefined>(
      (best, href) => (!best || href.length > best.length ? href : best),
      undefined
    );
  })();

  const activeSectionLabel = sectionForPathname(pathname);

  // A link clicked from page content (e.g. a customer name while viewing a
  // Warranty) can land on a sidebar item scrolled out of view — the sidebar
  // is a tall, independently-scrolling list, not the page itself. Bring
  // whichever item just became active into view automatically, same as the
  // section auto-expand above; "nearest" only scrolls if it's actually
  // outside the visible area, so clicking a link that's already visible
  // never causes a jump.
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHref]);

  // Open sections are tracked explicitly (never derived by XOR-ing a route
  // default against a toggle — flipping both at once, e.g. by navigating to
  // a link inside a section you just opened, would cancel out and close it).
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const active = sectionForPathname(pathname);
    return active ? new Set([active]) : new Set();
  });

  // Auto-open whichever section the route just navigated into, without
  // touching any section the user already opened or closed by hand. Setting
  // state during render (guarded by the pathname comparison) rather than in
  // an effect avoids an extra render pass and matches the pattern React
  // recommends for "adjusting state when a prop changes".
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    const active = sectionForPathname(pathname);
    if (active && !openSections.has(active)) {
      setOpenSections(new Set(openSections).add(active));
    }
  }

  function isSectionOpen(section: NavSection): boolean {
    return openSections.has(section.label);
  }

  function toggleSection(label: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0 md:transition-[width]",
        open ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-slate-100",
          collapsed ? "md:justify-center md:px-0" : "px-4"
        )}
      >
        <Image
          src="/logo.png"
          alt=""
          width={36}
          height={36}
          unoptimized
          className="h-9 w-9 shrink-0 rounded"
        />
        <span
          className={cn(
            "truncate text-sm font-semibold text-slate-900",
            collapsed ? "md:hidden" : ""
          )}
        >
          {companyName}
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {sections.map((section) => {
          const Icon = MODULE_ICONS[section.moduleKey];
          if (section.href) {
            return (
              <div key={section.label}>
                <NavItem
                  ref={section.href === activeHref ? activeItemRef : undefined}
                  label={section.label}
                  href={section.href}
                  icon={Icon}
                  active={section.href === activeHref}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                  emphasized
                />
              </div>
            );
          }

          const sectionOpen = isSectionOpen(section);
          const sectionActive = section.label === activeSectionLabel;

          return (
            <div key={section.label}>
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={sectionOpen}
                aria-current={sectionActive ? "true" : undefined}
                className={cn(
                  "mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-slate-50",
                  sectionActive ? "text-emerald-700 hover:text-emerald-800" : "text-slate-500 hover:text-slate-700",
                  collapsed ? "md:mb-2 md:border-t md:border-slate-100 md:pt-2" : ""
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    sectionActive ? "text-emerald-600" : "text-slate-400",
                    collapsed ? "md:hidden" : ""
                  )}
                  strokeWidth={2}
                />
                <span className={cn("flex-1 text-left", collapsed ? "md:hidden" : "")}>
                  {section.label}
                </span>
                {sectionActive ? (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500",
                      collapsed ? "md:hidden" : ""
                    )}
                    aria-hidden
                  />
                ) : null}
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    sectionActive ? "text-emerald-400" : "text-slate-400",
                    sectionOpen ? "rotate-90" : "",
                    collapsed ? "md:hidden" : ""
                  )}
                  strokeWidth={2}
                />
              </button>
              <div
                className={cn(
                  "space-y-0.5",
                  sectionOpen ? "" : "hidden",
                  collapsed ? "md:block" : ""
                )}
              >
                {section.items?.map((item) => (
                  <NavItem
                    key={item.href}
                    ref={item.href === activeHref ? activeItemRef : undefined}
                    label={item.label}
                    href={item.href}
                    icon={LEAF_ICONS[item.href]}
                    active={item.href === activeHref}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggleCollapsed}
        className={cn(
          "hidden shrink-0 items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 md:flex",
          collapsed ? "md:justify-center md:px-0" : ""
        )}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4 shrink-0" strokeWidth={2} />
        ) : (
          <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={2} />
        )}
        <span className={collapsed ? "md:hidden" : ""}>Collapse</span>
      </button>
    </aside>
  );
}

function isPathMatch(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NavItem = forwardRef<
  HTMLAnchorElement,
  {
    label: string;
    href: string;
    icon?: LucideIcon;
    active: boolean;
    onNavigate: () => void;
    emphasized?: boolean;
    collapsed?: boolean;
  }
>(function NavItem({ label, href, icon: Icon, active, onNavigate, emphasized, collapsed }, ref) {
  return (
    <Link
      ref={ref}
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md border-l-2 py-1.5 pr-2 pl-2.5 text-sm transition-colors",
        collapsed ? "md:justify-center md:border-l-0 md:px-0" : "",
        emphasized ? "font-medium" : "font-normal",
        active
          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
          : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {Icon ? (
        <Icon
          className={cn("h-4 w-4 shrink-0", active ? "text-emerald-600" : "text-slate-400")}
          strokeWidth={2}
        />
      ) : null}
      <span className={cn("truncate", collapsed ? "md:sr-only" : "")}>{label}</span>
    </Link>
  );
});
