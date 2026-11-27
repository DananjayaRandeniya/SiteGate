import Link from "next/link";
import type { ReactNode } from "react";

export const fieldClass =
  "min-h-11 min-w-0 rounded-control border border-input-border bg-surface px-3 text-sm";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60";
export const secondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-soft";

export function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-3 rounded-panel border border-line bg-surface p-4 md:p-5">
      {children}
    </section>
  );
}

export function OperationsMessage({
  title,
  detail,
  error = false,
}: {
  title: string;
  detail: string;
  error?: boolean;
}) {
  return (
    <Panel>
      <div role={error ? "alert" : undefined}>
        <h2 className={error ? "font-semibold text-danger" : "font-semibold"}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{detail}</p>
      </div>
    </Panel>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  path,
  query,
}: {
  page: number;
  pageSize: number;
  total: number;
  path: string;
  query?: URLSearchParams;
}) {
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  function link(target: number) {
    const params = new URLSearchParams(query);
    params.set("page", String(target));
    return `${path}?${params}`;
  }
  if (pages === 1 && page === 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center gap-3 text-sm text-muted"
    >
      {page > 1 && (
        <Link className={secondaryClass} href={link(Math.min(page - 1, pages))}>
          Previous
        </Link>
      )}
      <span>
        {page <= pages
          ? `Page ${page} of ${pages}`
          : `Page ${page} is out of range`}
      </span>
      {page < pages && (
        <Link className={secondaryClass} href={link(page + 1)}>
          Next
        </Link>
      )}
    </nav>
  );
}
