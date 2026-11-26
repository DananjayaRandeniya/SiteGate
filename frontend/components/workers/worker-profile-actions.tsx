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
  submitCredentialIssue,
  submitCredentialRevocation,
  submitWorkerDeactivation,
  submitWorkerUpdate,
  WorkerPortalApiError,
} from "@/lib/workers/worker-portal-client";
import { todayAtSite } from "@/lib/workers/worker-registration";
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (action && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [action]);

  function open(next: Action) {
    setError("");
    setAction(next);
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || saving) return;
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "");
    const note = value("note").trim() || undefined;
    setSaving(true);
    setError("");
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
      } else {
        await submitWorkerDeactivation(
          worker.id,
          deactivateWorkerSchema.parse({ reason: value("reason"), note }),
        );
        setMessage("Worker deactivated.");
      }
      dialog.current?.close();
      router.refresh();
    } catch (failure) {
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
        onClose={() => setAction(null)}
        aria-labelledby="worker-action-title"
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-panel border border-line bg-surface p-5 text-ink backdrop:bg-nav/45 sm:p-7"
      >
        {action && (
          <form key={action} onSubmit={apply} className="grid gap-4">
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
                <WorkerField id="edit-worker-name" label="Full name">
                  <input
                    id="edit-worker-name"
                    name="fullName"
                    defaultValue={worker.fullName}
                    required
                    className={workerInputClass}
                  />
                </WorkerField>
                <WorkerField id="edit-worker-contractor" label="Contractor">
                  <select
                    id="edit-worker-contractor"
                    name="contractorId"
                    defaultValue={worker.contractorId}
                    required
                    className={workerInputClass}
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
                  <WorkerField
                    id="edit-worker-induction"
                    label="Induction date"
                  >
                    <input
                      id="edit-worker-induction"
                      name="inductionDate"
                      type="date"
                      max={todayAtSite()}
                      defaultValue={worker.inductionDate}
                      required
                      className={workerInputClass}
                    />
                  </WorkerField>
                  <WorkerField
                    id="edit-worker-ticket"
                    label="Safety ticket expiry"
                  >
                    <input
                      id="edit-worker-ticket"
                      name="safetyTicketExpiry"
                      type="date"
                      defaultValue={worker.safetyTicketExpiry}
                      required
                      className={workerInputClass}
                    />
                  </WorkerField>
                </div>
              </>
            )}
            {action === "issue" && (
              <WorkerField
                id="issue-worker-credential"
                label="Credential number"
              >
                <input
                  id="issue-worker-credential"
                  name="credentialNumber"
                  required
                  className={workerInputClass}
                />
              </WorkerField>
            )}
            {(action === "revoke" || action === "deactivate") && (
              <>
                <p className="text-sm text-muted">
                  {action === "revoke"
                    ? `Credential ${worker.credentialNumber} will stop working.`
                    : "The worker will lose site access."}
                </p>
                <WorkerField id="worker-action-reason" label="Reason">
                  <select
                    id="worker-action-reason"
                    name="reason"
                    required
                    defaultValue=""
                    className={workerInputClass}
                  >
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
                <WorkerField id="worker-action-note" label="Note (optional)">
                  <textarea
                    id="worker-action-note"
                    name="note"
                    rows={3}
                    className={workerInputClass}
                  />
                </WorkerField>
              </>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => dialog.current?.close()}
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
