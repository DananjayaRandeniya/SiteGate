import { z } from "zod";

export const workerIdSchema = z
  .string()
  .length(24)
  .regex(/^[a-f0-9]{24}$/i);

const workerStatusSchema = z.enum(["Active", "Inactive"]);

export const workerProfileSchema = z.object({
  id: workerIdSchema,
  fullName: z.string(),
  contractorId: workerIdSchema,
  credentialNumber: z.string().nullable(),
  inductionDate: z.iso.date(),
  safetyTicketExpiry: z.iso.date(),
  assignedSiteIds: z.array(z.string()),
  status: workerStatusSchema,
});

export const workerDirectorySchema = z.object({
  items: z.array(
    workerProfileSchema.extend({ contractorName: z.string().nullable() }),
  ),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const contractorListSchema = z.array(
  z.object({
    id: workerIdSchema,
    name: z.string(),
  }),
);
