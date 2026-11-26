import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export default function GatesPage() {
  return (
    <PageHeading
      title="Gate simulator"
      action={
        <Link
          href="/sites/S-01/on-site"
          className="text-sm text-brand underline"
        >
          See who is on site
        </Link>
      }
    />
  );
}
