import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/current-session";
import { AppShell } from "@/components/app-shell/app-shell";
import { NAV_SECTIONS } from "@/lib/core/nav";
import { canAccessModule } from "@/lib/core/permissions";
import type { ReactNode } from "react";

// Defense in depth: middleware already blocks unauthenticated requests to
// every route under this layout, but the layout does not assume that.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const visibleSections = NAV_SECTIONS.filter((section) =>
    canAccessModule(session.role, section.moduleKey)
  );

  return (
    <AppShell session={session} companyName={session.companyName} navSections={visibleSections}>
      {children}
    </AppShell>
  );
}
