import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export default function WorkersPage() {
  return (
    <PageHeading
      title="Workers"
      description="Add workers and manage site access."
      action={
        <Link
          href="/workers/new"
          className="inline-flex min-h-11 items-center rounded-control bg-brand px-3.5 text-sm font-semibold text-white"
        >
          + Add worker
        </Link>
      }
    />
  );
}
