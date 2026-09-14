import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center">
      <p className="text-2xl font-semibold text-slate-900">Page not found</p>
      <p className="text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/dashboard" className="mt-4 text-sm font-medium text-slate-900 underline">
        Back to dashboard
      </Link>
    </div>
  );
}
