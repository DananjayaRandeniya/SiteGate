import Link from "next/link";
import {
  OperationsMessage,
  Panel,
  secondaryClass,
} from "@/components/operations-ui";
import { PageHeading } from "@/components/page-heading";
import { alertTitle, formatUtc, siteLabel } from "@/lib/operations";
import { getAlerts, getOnSite } from "@/lib/operations-service";

export default async function DashboardPage() {
  const [onSite, open, acknowledged, recent] = await Promise.all([
    getOnSite("S-01").catch(() => null),
    getAlerts(new URLSearchParams({ status: "Open", pageSize: "1" })).catch(
      () => null,
    ),
    getAlerts(
      new URLSearchParams({ status: "Acknowledged", pageSize: "1" }),
    ).catch(() => null),
    getAlerts(new URLSearchParams({ pageSize: "5" })).catch(() => null),
  ]);
  const metrics = [
    {
      label: "Workers on site",
      value: onSite?.length,
      detail: "Harbour East · S-01",
      href: "/sites/S-01/on-site",
      color: "text-brand",
    },
    {
      label: "Open alerts",
      value: open?.total,
      detail: "Across all sites",
      href: "/alerts?status=Open",
      color: "text-danger",
    },
    {
      label: "Acknowledged alerts",
      value: acknowledged?.total,
      detail: "Across all sites",
      href: "/alerts?status=Acknowledged",
      color: "text-ink",
    },
  ];
  return (
    <>
      <PageHeading
        title="Dashboard"
        description="See what’s happening across your sites."
      />
      <section aria-label="Site summary" className="grid gap-3 md:grid-cols-3">
        {metrics.map(({ label, value, detail, href, color }) => (
          <Link
            key={href}
            href={href}
            className="grid gap-2 rounded-panel border border-line bg-surface p-4 hover:bg-soft md:p-5"
          >
            <h2 className="text-sm font-semibold">{label}</h2>
            <span className={`text-3xl font-bold ${color}`}>
              {value ?? "—"}
            </span>
            <span className="text-sm text-muted">
              {value === undefined ? "Service unavailable" : detail}
            </span>
          </Link>
        ))}
      </section>
      {recent === null ? (
        <OperationsMessage
          title="Could not load recent activity"
          detail="Check that Audit & Alerts Service is running."
          error
        />
      ) : (
        <Panel>
          <h2 className="text-lg font-semibold">Recent activity</h2>
          {recent.data.length ? (
            <ul className="divide-y divide-line">
              {recent.data.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{alertTitle(alert.type)}</p>
                    <p className="text-muted">
                      {siteLabel(alert.siteId)} · {alert.status}
                    </p>
                  </div>
                  <time className="text-muted" dateTime={alert.createdAt}>
                    {formatUtc(alert.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">New alerts will appear here.</p>
          )}
          <Link className={`${secondaryClass} w-fit`} href="/audit">
            Open worker audit
          </Link>
        </Panel>
      )}
    </>
  );
}
