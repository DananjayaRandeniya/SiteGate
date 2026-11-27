"use server";

import { revalidatePath } from "next/cache";
import { getPortalRole } from "@/lib/auth/session";
import { changeAlertStatus } from "@/lib/operations-service";
import { workerIdSchema } from "@/lib/workers/worker-schemas";

export async function updateAlert(_: string, data: FormData) {
  if ((await getPortalRole()) !== "Admin")
    return "Sign in as a Site Admin to update an alert.";
  const id = workerIdSchema.safeParse(data.get("id"));
  const status = data.get("status");
  if (!id.success || (status !== "Acknowledged" && status !== "Resolved")) {
    return "Choose an available action for this alert.";
  }
  try {
    await changeAlertStatus(id.data, status);
  } catch {
    return "Could not update the alert. Refresh the list and try again.";
  }
  revalidatePath("/alerts");
  revalidatePath("/");
  return "";
}
