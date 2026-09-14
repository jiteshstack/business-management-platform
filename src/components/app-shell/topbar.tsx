import { logoutAction } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/core/roles";
import { Button } from "@/components/ui/button";
import type { SessionPayload } from "@/lib/auth/session";

export function Topbar({
  session,
  onMenuClick,
}: {
  session: SessionPayload;
  onMenuClick: () => void;
}) {
  const initials = getInitials(session.name);

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        aria-label="Toggle navigation"
      >
        <MenuIcon />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
          {initials}
        </div>
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium text-slate-900">{session.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[session.role]}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-5 w-5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}
