"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  submitWorkerRegistration,
  WorkerPortalApiError,
} from "./worker-portal-client";
import { workerRegistrationSchema } from "./worker-registration";

type Registration = z.infer<typeof workerRegistrationSchema>;

const registrationFields = workerRegistrationSchema.keyof();

export function useWorkerRegistration() {
  const router = useRouter();
  const pending = useRef<Promise<void> | null>(null);
  const form = useForm<Registration>({
    resolver: zodResolver(workerRegistrationSchema),
    defaultValues: {
      fullName: "",
      contractorId: "",
      credentialNumber: "",
      inductionDate: "",
      safetyTicketExpiry: "",
      assignedSiteIds: [],
    },
  });

  async function register(values: Registration) {
    let workerId: string;
    try {
      workerId = (await submitWorkerRegistration(values)).id;
    } catch (error) {
      if (!(error instanceof WorkerPortalApiError)) {
        form.setError("root", {
          message: "Could not submit the registration.",
        });
        return;
      }
      const { code, fieldErrors, message } = error.details;
      if (error.status === 409 && code === "CREDENTIAL_IN_USE") {
        form.setError(
          "credentialNumber",
          { message: "This credential is already in use" },
          { shouldFocus: true },
        );
        return;
      }
      if (error.status === 404 && code === "CONTRACTOR_NOT_FOUND") {
        form.setError(
          "contractorId",
          { message: "Choose an active contractor." },
          { shouldFocus: true },
        );
        return;
      }
      if (error.status === 400 && fieldErrors) {
        let placed = false;
        for (const [key, messages] of Object.entries(fieldErrors)) {
          const field = registrationFields.safeParse(key);
          if (field.success && messages[0]) {
            form.setError(
              field.data,
              { message: messages[0] },
              { shouldFocus: !placed },
            );
            placed = true;
          }
        }
        if (placed) return;
      }
      form.setError("root", { message });
      return;
    }

    router.push(`/workers/${workerId}?registered=1`);
  }

  function submit(event?: BaseSyntheticEvent) {
    return form.handleSubmit((values) => {
      if (pending.current) return pending.current;
      pending.current = register(values).finally(() => {
        pending.current = null;
      });
      return pending.current;
    })(event);
  }

  return { form, submit };
}
