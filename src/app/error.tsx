"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-2xl font-semibold text-slate-900">Something went wrong</p>
      <p className="max-w-sm text-sm text-slate-500">
        {error.message || "An unexpected error occurred. You can try again, and the issue has been logged."}
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
