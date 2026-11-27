import Link from "next/link";
import { AlertActions } from "@/components/alert-actions";
import {
  fieldClass,
  OperationsMessage,
  Pagination,
  Panel,
  secondaryClass,
} from "@/components/operations-ui";
import { PageHeading } from "@/components/page-heading";
import { PortalRefresh } from "@/components/portal-refresh";
import { getPortalRole } from "@/lib/auth/session";
import {
  alertTitle,
  formatUtc,
  readableCode,
  readPage,
  readText,
  siteLabel,
  sites,
} from "@/lib/operations";
import { getAlerts } from "@/lib/operations-service";

const statuses = ["Open", "Acknowledged", "Resolved"];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await searchParams;
  const status = readText(filters.status);
  const site = readText(filters.site).slice(0, 100);
  const query = new URLSearchParams({
    page: String(readPage(filters.page)),
    pageSize: "20",
  });
  const links = new URLSearchParams();
  if (statuses.includes(status)) {
    query.set("status", status);
    links.set("status", status);
  }
  if (site) {
    query.set("siteId", site);
    links.set("site", site);
  }
  const [alerts, role] = await Promise.all([
    getAlerts(query).catch(() => null),
    getPortalRole(),
  ]);
  return (
    <>
      <PageHeading
        title="Alerts"
        description="Review site alerts and track what your team has handled."
      />
      <Panel>
        <form
          action="/alerts"
          className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="grid gap-1 text-sm font-semibold">
            Status
            <select
              name="status"
              defaultValue={statuses.includes(status) ? status : ""}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Site
            <select name="site" defaultValue={site} className={fieldClass}>
              <option value="">All sites</option>
              {sites.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              {site && !sites.some(({ id }) => id === site) && (
                <option value={site}>{site}</option>
              )}
            </select>
          </label>
          <button className={secondaryClass}>Apply filters</button>
        </form>
      </Panel>
      {alerts === null ? (
        <>
          <OperationsMessage
            title="Could not load alerts"
            detail="Check that Audit & Alerts Service is running, then refresh."
            error
          />
          <div>
            <PortalRefresh />
          </div>
        </>
      ) : (
        <>
          {alerts.data.length ? (
            <ul className="grid gap-3">
              {alerts.data.map((alert) => (
                <li key={alert.id}>
                  <Panel>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-1 font-semibold ${alert.severity === "HIGH" ? "bg-error-bg text-danger" : "bg-soft text-brand"}`}
                      >
                        {readableCode(alert.severity)}
                      </span>
                      <span className="rounded-full bg-neutral px-2 py-1 font-semibold text-muted">
                        {alert.status}
                      </span>
                      <time className="text-muted" dateTime={alert.createdAt}>
                        {formatUtc(alert.createdAt)}
                      </time>
                    </div>
                    <h2 className="text-xl font-semibold">
                      {alertTitle(alert.type)}
                    </h2>
                    <p className="text-sm text-muted">
                      {[
                        siteLabel(alert.siteId),
                        alert.gateId,
                        alert.credentialNumber,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {role === "Admin" && alert.status !== "Resolved" && (
                      <AlertActions id={alert.id} status={alert.status} />
                    )}
                    {alert.workerId && (
                      <Link
                        className="w-fit text-sm font-semibold text-brand underline"
                        href={`/workers/${encodeURIComponent(alert.workerId)}/audit`}
                      >
                        View worker audit
                      </Link>
                    )}
                  </Panel>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <OperationsMessage
                title="No alerts match your filters"
                detail="Change the status or site to see more alerts."
              />
              {(links.size > 0 || alerts.page > 1) && (
                <Link className={`${secondaryClass} w-fit`} href="/alerts">
                  Clear filters
                </Link>
              )}
            </>
          )}
          <Pagination {...alerts} path="/alerts" query={links} />
        </>
      )}
    </>
  );
}
