"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/lib/core/nav";
import type { SessionPayload } from "@/lib/auth/session";

const COLLAPSE_STORAGE_KEY = "bmp_sidebar_collapsed";

export function AppShell({
  session,
  companyName,
  navSections,
  children,
}: {
  session: SessionPayload;
  companyName: string;
  navSections: NavSection[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Starts expanded to match the server-rendered markup, then syncs from the
  // viewer's last choice after mount (avoids a hydration mismatch).
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
      // One-time hydration from localStorage after mount — can't read it
      // during SSR, and this is a plain persisted UI preference rather than
      // a live external store, so useSyncExternalStore would be overkill.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setCollapsed(true);
    } catch {
      // Ignore (private browsing, blocked storage, etc.) — stay expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — the toggle still works for this session.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}
      <Sidebar
        sections={navSections}
        companyName={companyName}
        open={mobileOpen}
        collapsed={collapsed}
        onNavigate={() => setMobileOpen(false)}
        onToggleCollapsed={toggleCollapsed}
      />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding]",
          collapsed ? "md:pl-16" : "md:pl-64"
        )}
      >
        <Topbar session={session} onMenuClick={() => setMobileOpen((value) => !value)} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
