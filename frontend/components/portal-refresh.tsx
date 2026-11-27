"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PortalRefresh({ automatic = false }: { automatic?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!automatic) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [automatic, router]);

  return (
    <button
      type="button"
      className="min-h-11 rounded-control border border-line bg-surface px-4 text-sm font-semibold hover:bg-soft disabled:opacity-60"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh now"}
    </button>
  );
}
