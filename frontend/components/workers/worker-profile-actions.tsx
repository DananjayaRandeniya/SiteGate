"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  deactivateWorkerSchema,
  issueCredentialSchema,
  revokeCredentialSchema,
  updateWorkerSchema,
} from "@/lib/workers/worker-lifecycle";
import {
  getWorkerFieldErrors,
  submitCredentialIssue,
  submitCredentialRevocation,
  submitWorkerDeactivation,
  submitWorkerArchive,
  submitWorkerSiteChange,
  submitWorkerUpdate,
  WorkerPortalApiError,
} from "@/lib/workers/worker-portal-client";
import {
  demoWorkerSiteIds,
  todayAtSite,
} from "@/lib/workers/worker-registration";
import type { workerProfileSchema } from "@/lib/workers/worker-schemas";
import {
  WorkerField,
  workerButtonClass,
  workerInputClass,
  workerSecondaryClass,
} from "./worker-ui";

const actionLabels = {
  edit: "Edit profile",
  issue: "Issue credential",
  revoke: "Revoke credential",
  deactivate: "Deactivate worker",
  assign: "Assign site",
  unassign: "Remove site",
  archive: "Archive worker",
};
type Action = keyof typeof actionLabels;

export function WorkerProfileActions({
  worker,
  contractors,
}: {
  worker: z.infer<typeof workerProfileSchema>;
  contractors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const unassignedSites = demoWorkerSiteIds.filter(
    (site) => !worker.assignedSiteIds.includes(site),
  );

  useEffect(() => {
    if (action && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [action]);

  function open(next: Action) {
    setError("");
    setFieldErrors({});
    setAction(next);
  }

  function close() {
    dialog.current?.close();
    setAction(null);
  }

  function field(name: string, label: string) {
    const id = `worker-action-${name}`;
    const message = fieldErrors[name];
    return {
      wrapper: { id, label, error: message },
      control: {
        id,
        name,
        className: workerInputClass,
        "aria-invalid": message ? true : undefined,
        "aria-describedby": message ? `${id}-error` : undefined,
        onChange: () => {
          if (message) {
            setFieldErrors((current) => ({ ...current, [name]: "" }));
          }
        },
      },
    };
  }
  const fullNameField = field("fullName", "Full name");
  const contractorField = field("contractorId", "Contractor");
  const inductionField = field("inductionDate", "Induction date");
  const ticketField = field("safetyTicketExpiry", "Safety ticket expiry");
  const credentialField = field("credentialNumber", "Credential number");
  const siteField = field("siteId", action === "assign" ? "Site ID" : "Site");
  const reasonField = field("reason", "Reason");
  const noteField = field("note", "Note (optional)");

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || saving) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const value = (key: string) => String(fields.get(key) ?? "");
    const note = value("note").trim() || undefined;
    setSaving(true);
    setError("");
    setFieldErrors({});
    setMessage("");
    try {
      if (action === "edit") {
        await submitWorkerUpdate(
          worker.id,
          updateWorkerSchema.parse({
            fullName: value("fullName"),
            contractorId: value("contractorId"),
            inductionDate: value("inductionDate"),
            safetyTicketExpiry: value("safetyTicketExpiry"),
          }),
        );
        setMessage("Worker profile updated.");
      } else if (action === "issue") {
        await submitCredentialIssue(
          worker.id,
          issueCredentialSchema.parse({
            credentialNumber: value("credentialNumber"),
          }),
        );
        setMessage("Credential issued.");
      } else if (action === "revoke") {
        await submitCredentialRevocation(
          worker.id,
          revokeCredentialSchema.parse({
            credentialNumber: worker.credentialNumber,
            reason: value("reason"),
            note,
          }),
        );
        setMessage("Credential revoked.");
      } else if (action === "deactivate") {
        await submitWorkerDeactivation(
          worker.id,
          deactivateWorkerSchema.parse({ reason: value("reason"), note }),
        );
        setMessage("Worker deactivated.");
      } else if (action === "assign" || action === "unassign") {
        await submitWorkerSiteChange(
          worker.id,
          action === "assign" ? "POST" : "DELETE",
          value("siteId"),
        );
        setMessage(action === "assign" ? "Site assigned." : "Site removed.");
      } else {
        await submitWorkerArchive(worker.id);
        close();
        router.replace("/workers?archived=1");
        return;
      }
      close();
      router.refresh();
    } catch (failure) {
      const errors = getWorkerFieldErrors(failure);
      const invalid = Array.from(
        form.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input[name], select[name], textarea[name]"),
      ).flatMap((control) => {
        const message = errors[control.name]?.[0];
        return message ? [{ control, message }] : [];
      });
      if (invalid.length) {
        setFieldErrors(
          Object.fromEntries(
            invalid.map(({ control, message }) => [control.name, message]),
          ),
        );
        invalid[0].control.focus();
        return;
      }
      setError(
        failure instanceof WorkerPortalApiError
          ? failure.message
          : failure instanceof z.ZodError
            ? (failure.issues[0]?.message ?? "Check the fields and try again.")
            : "Could not save changes. Check the worker profile before trying again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Worker actions">
        <button
          type="button"
          className={workerSecondaryClass}
          onClick={() => open("edit")}
        >
          {actionLabels.edit}
        </button>
        {worker.credentialNumber ? (
          <button
            type="button"
            className={workerSecondaryClass}
            onClick={() => open("revoke")}
          >
            {actionLabels.revoke}
          </button>
        ) : (
          <button
            type="button"
            className={workerSecondaryClass}
            onClick={() => open("issue")}
          >
            {actionLabels.issue}
          </button>
        )}
        {worker.status === "Active" && (
          <button
            type="button"
            className={workerSecondaryClass}
            onClick={() => open("deactivate")}
          >
            {actionLabels.deactivate}
          </button>
        )}
        <button
          type="button"
          className={workerSecondaryClass}
          onClick={() => open("assign")}
        >
          {actionLabels.assign}
        </button>
        {worker.assignedSiteIds.length > 0 && (
          <button
            type="button"
            className={workerSecondaryClass}
            onClick={() => open("unassign")}
          >
            {actionLabels.unassign}
          </button>
        )}
        <button
          type="button"
          className={workerSecondaryClass}
          onClick={() => open("archive")}
        >
          {actionLabels.archive}
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-control bg-success-bg p-3 text-sm font-semibold text-success"
        >
          {message}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="worker-action-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!saving) close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-panel border border-line bg-surface p-5 text-ink backdrop:bg-nav/45 sm:p-7"
      >
        {action && (
          <form key={action} onSubmit={apply} noValidate className="grid gap-4">
            <h2 id="worker-action-title" className="text-xl font-bold">
              {actionLabels[action]}
            </h2>
            {error && (
              <p
                role="alert"
                className="rounded-control bg-error-bg p-3 text-sm text-danger"
              >
                {error}
              </p>
            )}
            {action === "edit" && (
              <>
                <WorkerField {...fullNameField.wrapper}>
                  <input
                    {...fullNameField.control}
                    defaultValue={worker.fullName}
                    required
                  />
                </WorkerField>
                <WorkerField {...contractorField.wrapper}>
                  <select
                    {...contractorField.control}
                    defaultValue={worker.contractorId}
                    required
                  >
                    {!contractors.some(
                      ({ id }) => id === worker.contractorId,
                    ) && (
                      <option value={worker.contractorId}>
                        Current contractor
                      </option>
                    )}
                    {contractors.map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </WorkerField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <WorkerField {...inductionField.wrapper}>
                    <input
                      {...inductionField.control}
                      type="date"
                      max={todayAtSite()}
                      defaultValue={worker.inductionDate}
                      required
                    />
                  </WorkerField>
                  <WorkerField {...ticketField.wrapper}>
                    <input
                      {...ticketField.control}
                      type="date"
                      defaultValue={worker.safetyTicketExpiry}
                      required
                    />
                  </WorkerField>
                </div>
              </>
            )}
            {action === "issue" && (
              <WorkerField {...credentialField.wrapper}>
                <input {...credentialField.control} required />
              </WorkerField>
            )}
            {action === "assign" && (
              <WorkerField {...siteField.wrapper}>
                <input
                  {...siteField.control}
                  list="worker-site-options"
                  placeholder="e.g. S-02"
                  required
                />
                <datalist id="worker-site-options">
                  {unassignedSites.map((site) => (
                    <option key={site} value={site} />
                  ))}
                </datalist>
              </WorkerField>
            )}
            {action === "unassign" && (
              <WorkerField {...siteField.wrapper}>
                <select {...siteField.control} required defaultValue="">
                  <option value="">Choose a site</option>
                  {worker.assignedSiteIds.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </WorkerField>
            )}
            {action === "archive" && (
              <p className="text-sm text-muted">
                Archiving {worker.fullName} removes them from the Worker
                directory and ends their site access.
              </p>
            )}
            {(action === "revoke" || action === "deactivate") && (
              <>
                <p className="text-sm text-muted">
                  {action === "revoke"
                    ? `Credential ${worker.credentialNumber} will stop working.`
                    : "The worker will lose site access."}
                </p>
                <WorkerField {...reasonField.wrapper}>
                  <select {...reasonField.control} required defaultValue="">
                    <option value="">Choose a reason</option>
                    {action === "revoke" ? (
                      <>
                        <option value="LOST">Lost</option>
                        <option value="STOLEN">Stolen</option>
                        <option value="DAMAGED">Damaged</option>
                      </>
                    ) : (
                      <>
                        <option value="LEFT_COMPANY">Left company</option>
                        <option value="SAFETY_BREACH">Safety breach</option>
                        <option value="CONTRACT_ENDED">Contract ended</option>
                      </>
                    )}
                    <option value="OTHER">Other</option>
                  </select>
                </WorkerField>
                <WorkerField {...noteField.wrapper}>
                  <textarea {...noteField.control} rows={3} />
                </WorkerField>
              </>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={close}
                className={workerSecondaryClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={workerButtonClass}
              >
                {saving
                  ? "Saving…"
                  : action === "edit"
                    ? "Save changes"
                    : actionLabels[action]}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
