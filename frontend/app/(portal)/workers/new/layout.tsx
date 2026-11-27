import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeading } from "@/components/page-heading";
import { getPortalRole } from "@/lib/auth/session";

export default async function NewWorkerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const role = await getPortalRole();
  if (!role) redirect("/login");
  if (role === "Manager") {
    return (
      <>
        <PageHeading
          title="Admin access is required"
          description="Only a Site Admin can register workers."
        />
        <Link href="/workers" className="w-fit text-brand underline">
          Back to workers
        </Link>
      </>
    );
  }
  return children;
}
