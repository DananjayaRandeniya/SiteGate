"use client";

import Link from "next/link";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { useWorkerRegistration } from "@/lib/workers/use-worker-registration";
import { todayAtSite } from "@/lib/workers/worker-registration";
import {
  WorkerField,
  workerButtonClass,
  workerInputClass,
  workerSecondaryClass,
} from "./worker-ui";

export function WorkerRegistrationForm({
  contractors,
}: {
  contractors: { id: string; name: string }[];
}) {
  const { form, submit } = useWorkerRegistration();
  const { errors, isSubmitting } = form.formState;
  const fields = form.register;
  const selected =
    useWatch({ control: form.control, name: "assignedSiteIds" }) ?? [];
  const [otherSite, setOtherSite] = useState("");
  const sites = [...new Set(["S-01", "S-02", ...selected])];
  const errorProps = (id: string, message?: string) => ({
    "aria-invalid": message ? true : undefined,
    "aria-describedby": message ? `${id}-error` : undefined,
  });

  function toggleSite(site: string, checked: boolean) {
    form.setValue(
      "assignedSiteIds",
      checked
        ? [...new Set([...selected, site])]
        : selected.filter((id) => id !== site),
      { shouldDirty: true },
    );
  }

  function addSite() {
    const site = otherSite.trim();
    if (!site) return;
    toggleSite(site, true);
    setOtherSite("");
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="grid max-w-3xl gap-6 rounded-panel border border-line bg-surface p-5 md:p-7"
    >
      {errors.root?.message && (
        <p
          role="alert"
          className="rounded-control bg-error-bg p-3 text-sm font-semibold text-danger"
        >
          {errors.root.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <WorkerField
          id="full-name"
          label="Full name"
          error={errors.fullName?.message}
        >
          <input
            id="full-name"
            required
            autoComplete="off"
            {...fields("fullName")}
            {...errorProps("full-name", errors.fullName?.message)}
            className={workerInputClass}
          />
        </WorkerField>
        <WorkerField
          id="contractor"
          label="Contractor"
          error={errors.contractorId?.message}
        >
          <select
            id="contractor"
            required
            {...fields("contractorId")}
            {...errorProps("contractor", errors.contractorId?.message)}
            className={workerInputClass}
          >
            <option value="">Choose a contractor</option>
            {contractors.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </WorkerField>
        <WorkerField
          id="credential"
          label="Credential number"
          error={errors.credentialNumber?.message}
        >
          <input
            id="credential"
            required
            autoComplete="off"
            {...fields("credentialNumber")}
            {...errorProps("credential", errors.credentialNumber?.message)}
            className={workerInputClass}
          />
        </WorkerField>
        <WorkerField
          id="induction-date"
          label="Induction date"
          error={errors.inductionDate?.message}
        >
          <input
            id="induction-date"
            required
            type="date"
            max={todayAtSite()}
            {...fields("inductionDate")}
            {...errorProps("induction-date", errors.inductionDate?.message)}
            className={workerInputClass}
          />
        </WorkerField>
        <WorkerField
          id="ticket-expiry"
          label="Safety ticket expiry"
          error={errors.safetyTicketExpiry?.message}
        >
          <input
            id="ticket-expiry"
            required
            type="date"
            {...fields("safetyTicketExpiry")}
            {...errorProps("ticket-expiry", errors.safetyTicketExpiry?.message)}
            className={workerInputClass}
          />
        </WorkerField>
      </div>

      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-2 text-sm font-semibold">
          Assigned sites{" "}
          <span className="font-normal text-muted">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {sites.map((site) => (
            <label
              key={site}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-control border border-line px-3 text-sm break-words"
            >
              <input
                type="checkbox"
                checked={selected.includes(site)}
                onChange={(event) => toggleSite(site, event.target.checked)}
              />
              {site}
            </label>
          ))}
        </div>
        <div className="grid items-end gap-2 sm:max-w-sm sm:grid-cols-[1fr_auto]">
          <WorkerField id="other-worker-site" label="Another site ID">
            <input
              id="other-worker-site"
              value={otherSite}
              onChange={(event) => setOtherSite(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSite();
                }
              }}
              className={workerInputClass}
            />
          </WorkerField>
          <button
            type="button"
            onClick={addSite}
            className={workerSecondaryClass}
          >
            Add site
          </button>
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
        <Link href="/workers" className={workerSecondaryClass}>
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className={workerButtonClass}
        >
          {isSubmitting ? "Saving…" : "Save worker"}
        </button>
      </div>
    </form>
  );
}
