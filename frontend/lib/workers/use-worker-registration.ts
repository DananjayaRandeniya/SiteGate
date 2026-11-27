"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  getWorkerFieldErrors,
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
      let placed = false;
      for (const [key, messages] of Object.entries(
        getWorkerFieldErrors(error),
      )) {
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
      if (!placed) form.setError("root", { message: error.message });
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
