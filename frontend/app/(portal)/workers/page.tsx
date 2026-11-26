import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { WorkerDirectoryFilters } from "@/components/workers/worker-directory-filters";
import { WorkerRetry } from "@/components/workers/worker-retry";
import {
  WorkerNotice,
  WorkerSignIn,
  WorkerStatus,
  workerButtonClass,
  workerSecondaryClass,
} from "@/components/workers/worker-ui";
import { workerDirectoryQuery } from "@/lib/workers/directory-query";
import { getWorkerPortalRole } from "@/lib/workers/worker-access";
import {
  getContractors,
  getWorkerDirectory,
} from "@/lib/workers/worker-service";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await getWorkerPortalRole();
  const heading = (
    <PageHeading
      title="Workers"
      description="Find workers and manage their site access."
      action={
        role === "Admin" && (
          <Link href="/workers/new" className={workerButtonClass}>
            Add worker
          </Link>
        )
      }
    />
  );
  if (!role)
    return (
      <>
        {heading}
        <WorkerSignIn />
      </>
    );

  const query = workerDirectoryQuery(await searchParams);
  let directory: Awaited<ReturnType<typeof getWorkerDirectory>>;
  let contractors: Awaited<ReturnType<typeof getContractors>>;
  try {
    [directory, contractors] = await Promise.all([
      getWorkerDirectory(query),
      getContractors(),
    ]);
  } catch {
    return (
      <>
        {heading}
        <WorkerNotice title="Could not load workers">
          <WorkerRetry />
        </WorkerNotice>
      </>
    );
  }

  const filtered = ["search", "status", "contractorId", "siteId"].some((key) =>
    query.has(key),
  );
  const pageHref = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/workers?${next}`;
  };

  return (
    <>
      {heading}
      <WorkerDirectoryFilters
        key={query.toString()}
        search={query.get("search") ?? ""}
        status={query.get("status") ?? ""}
        contractorId={query.get("contractorId") ?? ""}
        siteId={query.get("siteId") ?? ""}
        limit={String(directory.limit)}
        contractors={contractors}
      />
      {directory.items.length === 0 ? (
        <WorkerNotice
          title={
            filtered
              ? "No workers match your filters"
              : directory.page > 1
                ? "No workers on this page"
                : "No workers yet"
          }
        >
          {directory.page > 1 || filtered ? (
            <Link href="/workers" className={workerSecondaryClass}>
              Clear filters
            </Link>
          ) : (
            role === "Admin" && (
              <Link href="/workers/new" className={workerButtonClass}>
                Add worker
              </Link>
            )
          )}
        </WorkerNotice>
      ) : (
        <section
          aria-label="Worker results"
          className="overflow-hidden rounded-panel border border-line bg-surface"
        >
          <table className="hidden w-full table-fixed text-left text-sm lg:table">
            <thead className="bg-neutral text-muted">
              <tr>
                {["Worker", "Contractor", "Credential", "Status", "Sites"].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-3 font-semibold"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {directory.items.map((worker) => (
                <tr key={worker.id}>
                  <th
                    scope="row"
                    className="px-4 py-4 font-semibold break-words"
                  >
                    <Link
                      href={`/workers/${worker.id}`}
                      className="text-brand underline-offset-4 hover:underline"
                    >
                      {worker.fullName}
                    </Link>
                  </th>
                  <td className="px-4 py-4 break-words">
                    {worker.contractorName ?? "Unavailable"}
                  </td>
                  <td className="px-4 py-4 break-words">
                    {worker.credentialNumber ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-4">
                    <WorkerStatus status={worker.status} />
                  </td>
                  <td className="px-4 py-4 break-words">
                    {worker.assignedSiteIds.join(", ") || "Unassigned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line lg:hidden">
            {directory.items.map((worker) => (
              <li key={worker.id} className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/workers/${worker.id}`}
                    className="min-w-0 font-semibold break-words text-brand underline-offset-4 hover:underline"
                  >
                    {worker.fullName}
                  </Link>
                  <WorkerStatus status={worker.status} />
                </div>
                <p className="text-sm break-words text-muted">
                  {worker.contractorName ?? "Contractor unavailable"}
                </p>
                <p className="text-sm break-words text-muted">
                  Credential {worker.credentialNumber ?? "unassigned"}
                </p>
                <p className="text-sm break-words text-muted">
                  Sites {worker.assignedSiteIds.join(", ") || "unassigned"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav
        aria-label="Worker pages"
        className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
      >
        <p>
          {directory.total} {directory.total === 1 ? "worker" : "workers"} ·
          Page {directory.page} of {Math.max(1, directory.totalPages)}
        </p>
        <div className="flex gap-2">
          {directory.page > 1 && (
            <Link
              href={pageHref(directory.page - 1)}
              className={workerSecondaryClass}
            >
              Previous
            </Link>
          )}
          {directory.page < directory.totalPages && (
            <Link
              href={pageHref(directory.page + 1)}
              className={workerSecondaryClass}
            >
              Next
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
