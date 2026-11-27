import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import {
  WorkerNotice,
  workerSecondaryClass,
} from "@/components/workers/worker-ui";

export default function WorkerNotFound() {
  return (
    <>
      <PageHeading title="Worker profile" />
      <WorkerNotice title="Worker not found">
        <p>The worker may have been archived or the link may have changed.</p>
        <Link href="/workers" className={workerSecondaryClass}>
          Back to workers
        </Link>
      </WorkerNotice>
    </>
  );
}
