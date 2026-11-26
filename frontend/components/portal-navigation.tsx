"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Workers", href: "/workers", includes: ["/workers"] },
  { label: "Access", href: "/gates", includes: ["/gates", "/sites"] },
  { label: "Audit", href: "/alerts", includes: ["/alerts"] },
];

export function PortalNavigation() {
  const pathname = usePathname();
  const inAudit = /^\/workers\/[^/]+\/audit\/?$/.test(pathname);

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-wrap gap-2 md:flex-col md:gap-4"
    >
      {navigation.map(({ href, label, includes }) => {
        const selected =
          (label === "Audit" && inAudit) ||
          (!inAudit &&
            includes.some(
              (path) => pathname === path || pathname.startsWith(path + "/"),
            ));

        return (
          <Link
            key={href}
            href={href}
            aria-current={selected ? "location" : undefined}
            className="min-w-[86px] rounded-control px-3 py-2.5 text-sm font-semibold text-nav-text hover:bg-selected hover:text-white focus-visible:outline-accent aria-[current=location]:bg-selected aria-[current=location]:text-white"
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
                  ? "Audit"
                  : "Dashboard";

  return <span>{label}</span>;
}
