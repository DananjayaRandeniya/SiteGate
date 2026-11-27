"use server";

import { z } from "zod";
import { getPortalRole } from "@/lib/auth/session";
import { runGateRequest } from "@/lib/operations-service";

const gateInput = z.object({
  credentialNumber: z.string().trim().min(1).max(100),
  siteId: z.string().trim().min(1).max(100),
  gateId: z.string().trim().min(1).max(100),
  direction: z.enum(["ENTRY", "EXIT"]),
});

export type GateState = {
  input?: z.infer<typeof gateInput>;
  decision?: Awaited<ReturnType<typeof runGateRequest>>;
  error?: string;
};

export async function submitGateRequest(
  _: GateState,
  data: FormData,
): Promise<GateState> {
  if ((await getPortalRole()) !== "Admin")
    return { error: "Sign in as a Site Admin to run a gate test." };
  const parsed = gateInput.safeParse(Object.fromEntries(data));
  if (!parsed.success)
    return { error: "Enter a credential, site, gate and direction." };
  try {
    return { input: parsed.data, decision: await runGateRequest(parsed.data) };
  } catch {
    return {
      input: parsed.data,
      error:
        "Could not confirm the gate result. Check who is on site before submitting again.",
    };
  }
}
