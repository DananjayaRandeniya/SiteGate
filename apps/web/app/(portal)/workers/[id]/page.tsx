import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export default async function WorkerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageHeading
      title="Worker profile"
      action={
        <Link
          href={`/workers/${encodeURIComponent(id)}/audit`}
          className="text-sm text-brand underline"
        >
          View activity
        </Link>
      }
    />
  );
}
