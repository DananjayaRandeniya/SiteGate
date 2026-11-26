import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export default function DashboardPage() {
  return (
    <>
      <PageHeading title="Dashboard" />
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-brand">
        <Link href="/workers" className="underline">
          Workers
        </Link>
        <Link href="/gates" className="underline">
          Gate simulator
        </Link>
        <Link href="/alerts" className="underline">
          Alerts
        </Link>
      </div>
    </>
  );
}
