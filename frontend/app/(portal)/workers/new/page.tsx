import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { WorkerRegistrationForm } from "@/components/workers/worker-registration-form";
import { WorkerRetry } from "@/components/workers/worker-retry";
import {
  WorkerNotice,
  WorkerSignIn,
  workerSecondaryClass,
} from "@/components/workers/worker-ui";
import { getWorkerPortalRole } from "@/lib/workers/worker-access";
import { getContractors } from "@/lib/workers/worker-service";

export default async function NewWorkerPage() {
  const role = await getWorkerPortalRole();
  const heading = (
    <PageHeading
      title="Add worker"
      description="Register a worker and issue their first credential."
      action={
        <Link href="/workers" className={workerSecondaryClass}>
          Back to workers
        </Link>
      }
    />
  );
  if (!role)
    return (
      <>
        {heading}
        <WorkerSignIn />
      </>
    );
  if (role !== "Admin")
    return (
      <>
        {heading}
        <WorkerNotice title="Admin access is required">
          <p>Only an Admin can register workers.</p>
        </WorkerNotice>
      </>
    );

  let contractors: Awaited<ReturnType<typeof getContractors>>;
  try {
    contractors = await getContractors();
  } catch {
    return (
      <>
        {heading}
        <WorkerNotice title="Could not load contractors">
          <WorkerRetry />
        </WorkerNotice>
      </>
    );
  }
  return (
    <>
      {heading}
      {contractors.length ? (
        <WorkerRegistrationForm contractors={contractors} />
      ) : (
        <WorkerNotice title="No active contractors">
          <p>An active contractor is needed to register a worker.</p>
          <WorkerRetry />
        </WorkerNotice>
      )}
    </>
  );
}
