import { z } from 'zod';
import { AgencyStatus } from '@prisma/client';

/**
 * Zod schemas for admin route request bodies.
 */

export const updateAgencyStatusSchema = z.object({
  status: z.nativeEnum(AgencyStatus, {
    errorMap: () => ({ message: 'status must be ACTIVE or SUSPENDED' }),
  }),
  reason: z.string().trim().min(1).max(500).optional(),
});

export type UpdateAgencyStatusInput = z.infer<typeof updateAgencyStatusSchema>;

export const agencyListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.nativeEnum(AgencyStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
