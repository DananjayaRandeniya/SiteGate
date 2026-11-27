import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { WorkerProfileActions } from "@/components/workers/worker-profile-actions";
import { WorkerRetry } from "@/components/workers/worker-retry";
import {
  WorkerNotice,
  WorkerSignIn,
  WorkerStatus,
  workerSecondaryClass,
} from "@/components/workers/worker-ui";
import { getWorkerPortalRole } from "@/lib/workers/worker-access";
import {
  getContractors,
  getWorkerProfile,
  WorkerServiceError,
} from "@/lib/workers/worker-service";

export default async function WorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const role = await getWorkerPortalRole();
  if (!role)
    return (
      <>
        <PageHeading title="Worker profile" />
        <WorkerSignIn />
      </>
    );

  let worker: Awaited<ReturnType<typeof getWorkerProfile>>;
  let contractors: Awaited<ReturnType<typeof getContractors>>;
  try {
    [worker, contractors] = await Promise.all([
      getWorkerProfile(id),
      getContractors(),
    ]);
  } catch (error) {
    if (
      error instanceof WorkerServiceError &&
      error.status === 404 &&
      error.code === "WORKER_NOT_FOUND"
    )
      notFound();
    return (
      <>
        <PageHeading title="Worker profile" />
        <WorkerNotice title="Could not load the worker profile">
          <WorkerRetry />
        </WorkerNotice>
      </>
    );
  }

  const info = [
    [
      "Contractor",
      contractors.find(({ id }) => id === worker.contractorId)?.name ??
        "Unavailable",
    ],
    ["Credential number", worker.credentialNumber ?? "Unassigned"],
    ["Induction date", worker.inductionDate],
    ["Safety ticket expiry", worker.safetyTicketExpiry],
    ["Assigned sites", worker.assignedSiteIds.join(", ") || "Unassigned"],
  ];
  return (
    <>
      <PageHeading
        title={worker.fullName}
        description="Worker profile"
        action={
          <Link href="/workers" className={workerSecondaryClass}>
            Back to workers
          </Link>
        }
      />
      {role === "Admin" && (await searchParams).registered === "1" && (
        <p
          role="status"
          className="rounded-control bg-success-bg p-3 text-sm font-semibold text-success"
        >
          Worker registered
        </p>
      )}
      <section
        className="grid max-w-4xl gap-5 rounded-panel border border-line bg-surface p-5 md:p-7"
        aria-labelledby="worker-profile-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="worker-profile-title" className="text-lg font-semibold">
            Worker details
          </h2>
          <WorkerStatus status={worker.status} />
        </div>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 text-sm font-semibold break-words">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/workers/${worker.id}/audit`}
          className="w-fit text-sm font-semibold text-brand underline underline-offset-4"
        >
          View activity
        </Link>
      </section>
      {role === "Admin" && (
        <WorkerProfileActions worker={worker} contractors={contractors} />
      )}
    </>
  );
}
