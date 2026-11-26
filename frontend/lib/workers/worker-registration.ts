import { z } from "zod";
import { workerIdSchema } from "./worker-schemas";

export const demoWorkerSiteIds = ["S-01", "S-02"];

const siteDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayAtSite() {
  const { year, month, day } = Object.fromEntries(
    siteDateFormatter.formatToParts().map(({ type, value }) => [type, value]),
  );
  return `${year}-${month}-${day}`;
}

export const workerRegistrationSchema = z.strictObject({
  fullName: z.string().trim().min(1, "Enter the worker’s full name."),
  contractorId: z
    .string()
    .refine(
      (id) => workerIdSchema.safeParse(id).success,
      "Choose an active contractor.",
    ),
  credentialNumber: z.string().trim().min(1, "Enter a credential number."),
  inductionDate: z.iso
    .date("Enter a valid induction date.")
    .refine(
      (date) => date <= todayAtSite(),
      "Induction date must be today or earlier.",
    ),
  safetyTicketExpiry: z.iso.date("Enter a valid safety ticket expiry date."),
  assignedSiteIds: z.array(z.string().trim().min(1)).optional(),
});
