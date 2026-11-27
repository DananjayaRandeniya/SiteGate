import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OperationsMessage,
  Pagination,
  Panel,
  secondaryClass,
} from "@/components/operations-ui";
import { PageHeading } from "@/components/page-heading";
import { PortalRefresh } from "@/components/portal-refresh";
import { formatUtc, readableCode, readPage, siteLabel } from "@/lib/operations";
import { getWorkerAudit } from "@/lib/operations-service";
import { workerIdSchema } from "@/lib/workers/worker-schemas";
import { getWorkerProfile } from "@/lib/workers/worker-service";

export default async function WorkerAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ id }, filters] = await Promise.all([params, searchParams]);
  if (!workerIdSchema.safeParse(id).success) notFound();
  const workerId = id.toLowerCase();
  const path = `/workers/${workerId}/audit`;
  const [worker, activity] = await Promise.all([
    getWorkerProfile(workerId).catch(() => null),
    getWorkerAudit(workerId, readPage(filters.page)).catch(() => null),
  ]);
  return (
    <>
      <PageHeading
        title="Worker audit"
        description="See what changed, when it happened, and why."
        action={
          <Link className={secondaryClass} href="/audit">
            Choose another worker
          </Link>
        }
      />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {worker?.fullName ?? "Worker record"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {worker?.credentialNumber ?? workerId}
            </p>
          </div>
          {worker && (
            <Link className={secondaryClass} href={`/workers/${workerId}`}>
              View profile
            </Link>
          )}
        </div>
      </Panel>
      {activity === null ? (
        <>
          <OperationsMessage
            title="Could not load worker activity"
            detail="Check that Audit & Alerts Service is running, then refresh."
            error
          />
          <div>
            <PortalRefresh />
          </div>
        </>
      ) : (
        <>
          {activity.data.length === 0 ? (
            <OperationsMessage
              title="No activity on this page"
              detail="Worker and access events appear here as they are recorded."
            />
          ) : (
            <Panel>
              <h2 className="text-lg font-semibold">Activity timeline</h2>
              <ol className="divide-y divide-line">
                {activity.data.map((event) => {
                  const { siteId, gateId, reasonCode, reason, direction } =
                    event.payload;
                  const explanation =
                    typeof reasonCode === "string" ? reasonCode : reason;
                  const details = [
                    typeof siteId === "string" ? siteLabel(siteId) : null,
                    typeof gateId === "string" ? gateId : null,
                    typeof explanation === "string"
                      ? readableCode(explanation)
                      : null,
                    typeof direction === "string"
                      ? readableCode(direction)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={event.eventId}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">
                          {readableCode(event.eventType)}
                        </p>
                        <p className="text-muted">
                          {details || readableCode(event.source)}
                        </p>
                      </div>
                      <time className="text-muted" dateTime={event.occurredAt}>
                        {formatUtc(event.occurredAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          )}
          <Pagination {...activity} path={path} />
        </>
      )}
    </>
  );
}
