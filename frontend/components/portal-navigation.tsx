"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Dashboard", href: "/", prefix: "/" },
  { label: "Workers", href: "/workers", prefix: "/workers" },
  { label: "On site", href: "/sites/S-01/on-site", prefix: "/sites" },
  { label: "Gates", href: "/gates", prefix: "/gates" },
  { label: "Alerts", href: "/alerts", prefix: "/alerts" },
  { label: "Audit", href: "/audit", prefix: "/audit" },
];

export function PortalNavigation() {
  const pathname = usePathname();
  const inAudit = /^\/workers\/[^/]+\/audit\/?$/.test(pathname);

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-wrap gap-1 md:flex-col md:gap-2"
    >
      {navigation.map(({ href, label, prefix }) => {
        const selected = inAudit
          ? prefix === "/audit"
          : pathname === prefix || pathname.startsWith(prefix + "/");

        return (
          <Link
            key={href}
            href={href}
            aria-current={selected ? "location" : undefined}
            className="rounded-control px-2.5 py-2 text-xs font-semibold text-nav-text hover:bg-selected hover:text-white focus-visible:outline-accent aria-[current=location]:bg-selected aria-[current=location]:text-white md:px-3 md:text-sm"
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalSection() {
  const pathname = usePathname();
  const label =
    pathname === "/workers/new"
      ? "Workers / Add worker"
      : /^\/workers\/[^/]+\/audit\/?$/.test(pathname)
        ? "Audit / Worker history"
        : pathname.startsWith("/workers/")
          ? "Workers / Profile"
          : pathname === "/workers"
            ? "Workers"
            : pathname.startsWith("/sites/")
              ? "Access / On site"
              : pathname === "/gates"
                ? "Access"
                : pathname === "/alerts"
                  ? "Alerts"
                  : pathname === "/audit"
                    ? "Audit"
                    : "Dashboard";

  return <span>{label}</span>;
}
