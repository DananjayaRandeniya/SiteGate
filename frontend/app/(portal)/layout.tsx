import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  PortalNavigation,
  PortalSection,
} from "@/components/portal-navigation";
import { getPortalRole } from "@/lib/auth/session";
import { signOut } from "../(auth)/login/actions";

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const role = await getPortalRole();
  if (!role) redirect("/login");
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-10 focus:rounded-control focus:bg-surface focus:p-2"
      >
        Skip to main content
      </a>
      <aside className="flex flex-col gap-2 bg-nav p-4 md:gap-4 md:px-[22px] md:pt-8">
        <Link
          href="/"
          aria-label="SiteGate dashboard"
          className="inline-flex w-fit items-center gap-2.5 text-[21px] font-bold text-white focus-visible:outline-accent"
        >
          <span
            aria-hidden="true"
            className="grid size-[34px] place-items-center rounded-control bg-accent text-sm text-ink"
          >
            SG
          </span>
          SiteGate
        </Link>
        <PortalNavigation />
      </aside>
      <div className="min-w-0">
        <header className="flex h-12 items-center justify-between gap-3 bg-surface px-4 text-xs text-muted md:h-[68px] md:px-8">
          <PortalSection />
          <form action={signOut} className="flex items-center gap-3">
            <span>Site {role}</span>
            <button
              type="submit"
              className="min-h-11 min-w-fit font-semibold text-ink hover:underline"
            >
              Sign out
            </button>
          </form>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="grid min-w-0 content-start gap-4 px-4 pt-5 pb-7 md:gap-6 md:px-8 md:pt-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
