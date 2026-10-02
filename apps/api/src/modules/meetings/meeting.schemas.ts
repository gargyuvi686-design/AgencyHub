import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  meetingDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().trim().optional().nullable(),
  visibleToClient: z.boolean().optional().default(false),
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  meetingDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().trim().optional().nullable(),
  visibleToClient: z.boolean().optional(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
