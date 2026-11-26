import { WorkerNotice } from "@/components/workers/worker-ui";

export default function Loading() {
  return (
    <div role="status">
      <WorkerNotice title="Loading worker data…" />
    </div>
  );
}
