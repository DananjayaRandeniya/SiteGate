import Link from "next/link";
import {
  fieldClass,
  OperationsMessage,
  Pagination,
  Panel,
  secondaryClass,
} from "@/components/operations-ui";
import { PageHeading } from "@/components/page-heading";
import { readPage, readText } from "@/lib/operations";
import { getWorkerDirectory } from "@/lib/workers/worker-service";

export default async function AuditIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await searchParams;
  const search = readText(filters.search).slice(0, 120);
  const workers = await getWorkerDirectory({
    search,
    page: String(readPage(filters.page)),
  }).catch(() => null);
  const query = new URLSearchParams();
  if (search) query.set("search", search);

  return (
    <>
      <PageHeading
        title="Worker audit"
        description="Choose a worker to see what changed and when."
      />
      <Panel>
        <form action="/audit" className="flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1 text-sm font-semibold">
            Worker name or credential
            <input
              name="search"
              className={fieldClass}
              defaultValue={search}
              maxLength={120}
            />
          </label>
          <button className={secondaryClass}>Search</button>
        </form>
      </Panel>
      {workers === null ? (
        <OperationsMessage
          title="Could not load workers"
          detail="Check that Worker Service is running and search again."
          error
        />
      ) : workers.items.length === 0 ? (
        <>
          <OperationsMessage
            title="No workers found"
            detail="Try another name or credential number."
          />
          {workers.page > 1 && (
            <Pagination
              page={workers.page}
              pageSize={workers.limit}
              total={workers.total}
              path="/audit"
              query={query}
            />
          )}
        </>
      ) : (
        <>
          <Panel>
            <ul className="divide-y divide-line">
              {workers.items.map((worker) => (
                <li
                  key={worker.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold">{worker.fullName}</p>
                    <p className="text-sm text-muted">
                      {worker.contractorName ?? "Contractor unavailable"}
                    </p>
                  </div>
                  <Link
                    className={secondaryClass}
                    href={`/workers/${worker.id}/audit`}
                    aria-label={`Open audit for ${worker.fullName}`}
                  >
                    Open audit
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Pagination
            page={workers.page}
            pageSize={workers.limit}
            total={workers.total}
            path="/audit"
            query={query}
          />
        </>
      )}
    </>
  );
}
