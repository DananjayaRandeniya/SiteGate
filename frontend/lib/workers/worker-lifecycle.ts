import { z } from "zod";
import { workerRegistrationSchema } from "./worker-registration";
import { workerIdSchema } from "./worker-schemas";

const revokeReason = z.enum(["LOST", "STOLEN", "DAMAGED", "OTHER"], {
  error: "Choose a revocation reason.",
});
const deactivationReason = z.enum(
  ["LEFT_COMPANY", "SAFETY_BREACH", "CONTRACT_ENDED", "OTHER"],
  { error: "Choose a deactivation reason." },
);
const optionalNote = z
  .string()
  .trim()
  .min(1, "Enter a note or leave it blank.")
  .optional();

export const updateWorkerSchema = workerRegistrationSchema
  .pick({
    fullName: true,
    contractorId: true,
    inductionDate: true,
    safetyTicketExpiry: true,
  })
  .partial();

export const issueCredentialSchema = workerRegistrationSchema.pick({
  credentialNumber: true,
});
export const revokeCredentialSchema = issueCredentialSchema.extend({
  reason: revokeReason,
  note: optionalNote,
});
export const deactivateWorkerSchema = z.strictObject({
  reason: deactivationReason.optional(),
  note: optionalNote,
});
export const deactivatedWorkerSchema = z.object({
  id: workerIdSchema,
  status: z.literal("Inactive"),
});
export const workerSiteChangeSchema = z.strictObject({
  siteId: z.string().trim().min(1, "Choose a site."),
});
export const workerSitesSchema = workerRegistrationSchema
  .required()
  .pick({ assignedSiteIds: true });
export const archiveWorkerSchema = z.strictObject({});
export const issuedCredentialSchema = z.object({
  ...issueCredentialSchema.shape,
  issuedAt: z.iso.datetime(),
});
export const revokedCredentialSchema = z.object({
  ...revokeCredentialSchema.shape,
  revokedAt: z.iso.datetime(),
});
