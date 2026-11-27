import Link from "next/link";
import {
  OperationsMessage,
  Panel,
  secondaryClass,
} from "@/components/operations-ui";
import { PageHeading } from "@/components/page-heading";
import { PortalRefresh } from "@/components/portal-refresh";
import { formatUtc, sites, siteLabel } from "@/lib/operations";
import { getOnSite } from "@/lib/operations-service";
import { getContractors } from "@/lib/workers/worker-service";

export default async function OnSitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const [presence, contractors] = await Promise.all([
    getOnSite(siteId).catch(() => null),
    getContractors().catch(() => []),
  ]);
  const contractorNames = new Map(
    contractors.map(({ id, name }) => [id, name]),
  );
  return (
    <>
      <PageHeading
        title="Who’s on site"
        description="See who is currently inside each site."
      />
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-sm font-semibold">Site</h2>
            <nav aria-label="Sites" className="flex flex-wrap gap-2">
              {sites.map(({ id, name }) => (
                <Link
                  key={id}
                  className={`${secondaryClass} aria-[current=location]:border-brand aria-[current=location]:bg-soft`}
                  href={`/sites/${id}/on-site`}
                  aria-current={id === siteId ? "location" : undefined}
                >
                  {name} · {id}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>Refreshes every 10 seconds</span>
            <PortalRefresh automatic />
          </div>
        </div>
      </Panel>
      {presence === null ? (
        <OperationsMessage
          title="Could not load the on-site list"
          detail="Check that Access Service is running, then refresh."
          error
        />
      ) : presence.length === 0 ? (
        <OperationsMessage
          title="No one is on site"
          detail={`Workers will appear here when they enter ${siteLabel(siteId)}.`}
        />
      ) : (
        <Panel>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">On-site workers</h2>
            <span className="rounded-full bg-success-bg px-2 py-1 text-xs font-semibold text-success">
              {presence.length} on site
            </span>
          </div>
          <ul className="divide-y divide-line">
            {presence.map((worker) => (
              <li
                key={worker.workerId}
                className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4"
              >
                <span className="font-semibold">
                  {worker.name ?? worker.workerId}
                </span>
                <span className="text-muted">
                  {contractorNames.get(worker.contractorId ?? "") ??
                    worker.contractorId ??
                    "Contractor unavailable"}
                </span>
                <time className="text-muted" dateTime={worker.enteredAt}>
                  {formatUtc(worker.enteredAt)}
                </time>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
