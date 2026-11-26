"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { workerDirectoryQuery } from "@/lib/workers/directory-query";
import { WorkerField, workerButtonClass, workerInputClass } from "./worker-ui";

export function WorkerDirectoryFilters({
  search,
  status,
  contractorId,
  siteId,
  limit,
  contractors,
}: {
  search: string;
  status: string;
  contractorId: string;
  siteId: string;
  limit: string;
  contractors: { id: string; name: string }[];
}) {
  const router = useRouter();
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const filter = (name: string) => String(fields.get(name) ?? "");
    const query = workerDirectoryQuery({
      search: filter("search"),
      status: filter("status"),
      contractorId: filter("contractorId"),
      siteId: filter("siteId"),
      limit,
    });
    router.push(`/workers?${query}`);
  }

  return (
    <form
      onSubmit={applyFilters}
      role="search"
      aria-label="Filter workers"
      className="grid gap-3 rounded-panel border border-line bg-surface p-4 lg:grid-cols-[minmax(150px,2fr)_minmax(100px,1fr)_minmax(125px,1.4fr)_minmax(100px,1fr)_auto] lg:items-end"
    >
      <WorkerField id="worker-search" label="Search workers">
        <input
          id="worker-search"
          name="search"
          type="search"
          defaultValue={search}
          maxLength={120}
          placeholder="Name or credential"
          className={workerInputClass}
        />
      </WorkerField>
      <WorkerField id="worker-status" label="Status">
        <select
          id="worker-status"
          name="status"
          defaultValue={status}
          className={workerInputClass}
        >
          <option value="">All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </WorkerField>
      <WorkerField id="worker-contractor" label="Contractor">
        <select
          id="worker-contractor"
          name="contractorId"
          defaultValue={contractorId}
          className={workerInputClass}
        >
          <option value="">All contractors</option>
          {contractorId &&
            !contractors.some(
              (contractor) => contractor.id === contractorId,
            ) && <option value={contractorId}>Selected contractor</option>}
          {contractors.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </WorkerField>
      <WorkerField id="worker-site" label="Site ID">
        <input
          id="worker-site"
          name="siteId"
          defaultValue={siteId}
          placeholder="All sites"
          className={workerInputClass}
        />
      </WorkerField>
      <button type="submit" className={workerButtonClass}>
        Apply filters
      </button>
    </form>
  );
}
