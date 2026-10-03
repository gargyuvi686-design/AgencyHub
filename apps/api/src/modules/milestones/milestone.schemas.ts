import { z } from 'zod';
import { MilestoneStatus, ApprovalStatus } from '@prisma/client';

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().optional(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  sortOrder: z.number().int().optional(),
  requiresClientApproval: z.boolean().optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  sortOrder: z.number().int().optional(),
  requiresClientApproval: z.boolean().optional(),
  approvalStatus: z.enum([ApprovalStatus.NONE, ApprovalStatus.PENDING]).optional(),
}).refine(
  (input) => input.approvalStatus !== ApprovalStatus.PENDING || input.requiresClientApproval !== false,
  'Client approval must be enabled before requesting approval.',
);

export const approveMilestoneSchema = z.object({
  decision: z.enum([ApprovalStatus.APPROVED, ApprovalStatus.CHANGES_REQUESTED]),
  comment: z.string().trim().max(5000).optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
