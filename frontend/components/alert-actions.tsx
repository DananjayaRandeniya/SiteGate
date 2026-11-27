"use client";

import { useActionState } from "react";
import { updateAlert } from "@/app/(portal)/alerts/actions";
import { buttonClass, secondaryClass } from "./operations-ui";

export function AlertActions({
  id,
  status,
}: {
  id: string;
  status: "Open" | "Acknowledged";
}) {
  const [error, action, pending] = useActionState(updateAlert, "");
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        {status === "Open" && (
          <button
            name="status"
            value="Acknowledged"
            className={buttonClass}
            disabled={pending}
          >
            Acknowledge
          </button>
        )}
        <button
          name="status"
          value="Resolved"
          className={status === "Open" ? secondaryClass : buttonClass}
          disabled={pending}
        >
          Resolve
        </button>
      </div>
      {pending && (
        <p role="status" className="text-sm text-muted">
          Updating alert…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
