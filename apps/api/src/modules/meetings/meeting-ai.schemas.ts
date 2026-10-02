import { z } from 'zod';

export const aiActionItemSchema = z.object({
  title: z.string().trim().min(1).max(255),
  assigneeHint: z.string().trim().max(255).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).strict();

export const aiSummarySchema = z.object({
  summary: z.string().trim().min(1).max(8000),
  decisions: z.array(z.string().trim().min(1).max(1000)).max(30),
  actionItems: z.array(aiActionItemSchema).max(50),
}).strict();

export const createAiTasksSchema = z.object({
  items: z.array(aiActionItemSchema).min(1).max(50),
}).strict();

export type AiActionItem = z.infer<typeof aiActionItemSchema>;
export type AiSummary = z.infer<typeof aiSummarySchema>;