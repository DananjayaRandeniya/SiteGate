"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { workerSecondaryClass } from "./worker-ui";

export function WorkerRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={workerSecondaryClass}
    >
      {pending ? "Trying again…" : "Try again"}
    </button>
  );
}
