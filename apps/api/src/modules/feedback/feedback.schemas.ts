import { z } from 'zod';
import { FeedbackStatus } from '@prisma/client';

export const createFeedbackSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.nativeEnum(FeedbackStatus),
});

export const createFeedbackCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;
export type CreateFeedbackCommentInput = z.infer<typeof createFeedbackCommentSchema>;