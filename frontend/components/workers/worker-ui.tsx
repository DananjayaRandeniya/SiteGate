import Link from "next/link";
import type { ReactNode } from "react";

export const workerInputClass =
  "min-h-11 w-full rounded-control border border-input-border bg-surface px-3 py-2 text-sm text-ink aria-invalid:border-danger";
export const workerButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60";
export const workerSecondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand";

export function WorkerNotice({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-2 rounded-panel border border-line bg-surface p-5 md:p-7">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && (
        <div className="space-y-3 text-sm text-muted">{children}</div>
      )}
    </section>
  );
}

export function WorkerSignIn() {
  return (
    <WorkerNotice title="Sign in to continue">
      <p>Sign in to access worker records.</p>
      <Link href="/login" className={workerButtonClass}>
        Sign in
      </Link>
    </WorkerNotice>
  );
}

export function WorkerStatus({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span
      className={`inline-block w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Active" ? "bg-success-bg text-success" : "bg-neutral text-muted"}`}
    >
      {status}
    </span>
  );
}

export function WorkerField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label className="text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
