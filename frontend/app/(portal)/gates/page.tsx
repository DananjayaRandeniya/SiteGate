import Link from "next/link";
import { GateSimulator } from "@/components/gate-simulator";
import { OperationsMessage, secondaryClass } from "@/components/operations-ui";
import { PageHeading } from "@/components/page-heading";
import { getPortalRole } from "@/lib/auth/session";

export default async function GatesPage() {
  const isAdmin = (await getPortalRole()) === "Admin";
  return (
    <>
      <PageHeading
        title="Gate simulator"
        description="Test whether a credential can pass through a gate."
      />
      {isAdmin ? (
        <GateSimulator />
      ) : (
        <>
          <OperationsMessage
            title="Gate tests need a Site Admin"
            detail="Managers can see who is on site."
          />
          <Link
            className={`${secondaryClass} w-fit`}
            href="/sites/S-01/on-site"
          >
            See who’s on site
          </Link>
        </>
      )}
    </>
  );
}
