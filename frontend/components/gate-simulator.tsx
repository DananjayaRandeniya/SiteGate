"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitGateRequest } from "@/app/(portal)/gates/actions";
import { readableCode, sites } from "@/lib/operations";
import {
  buttonClass,
  fieldClass,
  Panel,
  secondaryClass,
} from "./operations-ui";

const reasons: Record<string, string> = {
  UNKNOWN_CREDENTIAL: "This credential is unknown.",
  CREDENTIAL_REVOKED: "This credential was revoked.",
  WORKER_INACTIVE: "This worker is inactive.",
  NOT_ASSIGNED_TO_SITE: "This worker is not assigned to the site.",
  INDUCTION_INVALID: "The worker’s induction is invalid.",
  TICKET_EXPIRED: "The worker’s safety ticket has expired.",
};

export function GateSimulator() {
  const [state, action, pending] = useActionState(submitGateRequest, {});
  const [site, setSite] = useState(sites[0].id);
  const denied = state.decision?.result === "DENIED";
  const reason = state.decision?.reasonCode;
  return (
    <>
      <Panel>
        <h2 className="text-lg font-semibold">Simulate a gate tap</h2>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Site
            <select
              name="siteId"
              className={fieldClass}
              value={site}
              onChange={(event) => setSite(event.target.value)}
            >
              {sites.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name} · {id}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Gate ID
            <input
              name="gateId"
              className={fieldClass}
              required
              maxLength={100}
              placeholder="e.g. G-01"
              defaultValue={state.input?.gateId}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Credential number
            <input
              name="credentialNumber"
              className={fieldClass}
              required
              maxLength={100}
              placeholder="e.g. SG-2042"
              defaultValue={state.input?.credentialNumber}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Direction
            <select
              name="direction"
              className={fieldClass}
              defaultValue={state.input?.direction ?? "ENTRY"}
            >
              <option value="ENTRY">Entry</option>
              <option value="EXIT">Exit</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className={buttonClass} disabled={pending}>
              {pending ? "Checking…" : "Test credential"}
            </button>
            <Link
              className={secondaryClass}
              href={`/sites/${encodeURIComponent(site)}/on-site`}
            >
              See who’s on site
            </Link>
          </div>
        </form>
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold">Last result</h2>
        <div aria-live="polite">
          {state.error ? (
            <p className="rounded-control bg-error-bg p-3 text-sm text-danger">
              {state.error}
            </p>
          ) : state.decision ? (
            <div
              className={
                denied
                  ? "rounded-control bg-error-bg p-3 text-danger"
                  : "rounded-control bg-success-bg p-3 text-success"
              }
            >
              <p className="font-semibold">
                {denied ? "Access denied" : "Access granted"}
              </p>
              <p className="mt-1 text-sm">
                {reason
                  ? (reasons[reason] ?? readableCode(reason))
                  : state.input?.credentialNumber}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Test a credential to see the gate decision.
            </p>
          )}
        </div>
      </Panel>
    </>
  );
}
