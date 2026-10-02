import { z } from 'zod';
import { ProjectStatus, ProjectPriority } from '@prisma/client';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(255),
  description: z.string().trim().max(5000).optional().nullable(),
  clientId: z.string().min(1, 'Client ID is required'),
  managerId: z.string().optional().nullable(),
  status: z.nativeEnum(ProjectStatus).optional().default(ProjectStatus.PLANNING),
  priority: z.nativeEnum(ProjectPriority).optional().default(ProjectPriority.MEDIUM),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  clientId: z.string().min(1).optional(),
  managerId: z.string().optional().nullable(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectListQuerySchema = z.object({
  clientId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const setProjectMembersSchema = z.object({
  userIds: z.array(z.string()).default([]),
});

export type SetProjectMembersInput = z.infer<typeof setProjectMembersSchema>;
