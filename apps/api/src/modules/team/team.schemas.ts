import { z } from 'zod';

/** Zod schemas for team management routes. */

export const inviteSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  role: z.enum(['AGENCY_ADMIN', 'AGENCY_MEMBER'], {
    errorMap: () => ({ message: 'role must be AGENCY_ADMIN or AGENCY_MEMBER' }),
  }),
});

export type InviteInput = z.infer<typeof inviteSchema>;

export const updateTeamMemberSchema = z
  .object({
    role: z.enum(['AGENCY_ADMIN', 'AGENCY_MEMBER']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, {
    message: 'Provide at least one field: role or isActive',
  });

export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

export const teamListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
