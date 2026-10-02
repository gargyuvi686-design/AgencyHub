import { ProjectRepository } from './project.repository';
import { resolveProjectAccess } from './resolveProjectAccess';
import { activityService, ServiceContext } from '../activity/activity.service';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  SetProjectMembersInput,
} from './project.schemas';
import { ProjectStatus } from '@prisma/client';

export class ProjectService {
  /**
   * POST /projects — Create project.
   * Logs project.created.
   */
  async create(ctx: ServiceContext, input: CreateProjectInput) {
    const agencyId = ctx.agencyId!;
    const repo = new ProjectRepository(agencyId, ctx.clientId);

    const managerId = input.managerId || ctx.userId;

    const project = await repo.create({
      clientId: input.clientId,
      managerId,
      name: input.name,
      description: input.description,
      status: input.status,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
    });

    await activityService.log({
      ctx,
      eventType: 'project.created',
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      metadata: { name: project.name, clientId: project.clientId },
    });

    return project;
  }

  /**
   * GET /projects — List projects.
   */
  async list(
    ctx: ServiceContext,
    opts: {
      clientId?: string;
      status?: ProjectStatus;
      q?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const agencyId = ctx.agencyId!;
    const repo = new ProjectRepository(agencyId, ctx.clientId);

    return repo.list(
      { page: opts.page, limit: opts.limit },
      {
        userId: ctx.userId,
        role: ctx.role,
        clientId: opts.clientId,
        status: opts.status,
        q: opts.q,
      },
    );
  }

  /**
   * GET /projects/:id — Get project details with access check.
   */
  async get(ctx: ServiceContext, projectId: string) {
    return resolveProjectAccess(ctx, projectId);
  }

  /**
   * PATCH /projects/:id — Update project details.
   * Logs project.updated.
   */
  async update(ctx: ServiceContext, projectId: string, input: UpdateProjectInput) {
    // Verify access first
    await resolveProjectAccess(ctx, projectId);

    const agencyId = ctx.agencyId!;
    const repo = new ProjectRepository(agencyId, ctx.clientId);

    const updated = await repo.update(projectId, {
      clientId: input.clientId,
      managerId: input.managerId ?? undefined,
      name: input.name,
      description: input.description,
      status: input.status,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
    });

    await activityService.log({
      ctx,
      eventType: 'project.updated',
      entityType: 'project',
      entityId: projectId,
      projectId,
      metadata: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  /**
   * DELETE /projects/:id — Delete project.
   * Logs project.deleted.
   */
  async delete(ctx: ServiceContext, projectId: string) {
    const project = await resolveProjectAccess(ctx, projectId);

    const agencyId = ctx.agencyId!;
    const repo = new ProjectRepository(agencyId, ctx.clientId);

    await repo.delete(projectId);

    await activityService.log({
      ctx,
      eventType: 'project.deleted',
      entityType: 'project',
      entityId: projectId,
      metadata: { name: project.name },
    });
  }

  /**
   * POST /projects/:id/members — Sync project members.
   */
  async setMembers(ctx: ServiceContext, projectId: string, input: SetProjectMembersInput) {
    await resolveProjectAccess(ctx, projectId);

    const agencyId = ctx.agencyId!;
    const repo = new ProjectRepository(agencyId, ctx.clientId);

    await repo.setMembers(projectId, input.userIds);

    await activityService.log({
      ctx,
      eventType: 'project.members_updated',
      entityType: 'project',
      entityId: projectId,
      projectId,
      metadata: { memberCount: input.userIds.length },
    });
  }

  /**
   * DELETE /projects/:id/members/:userId — Remove member from project.
   */
  async removeMember(ctx: ServiceContext, projectId: string, userId: string) {
    await resolveProjectAccess(ctx, projectId);

    const agencyId = ctx.agencyId!;
    const repo = new ProjectRepository(agencyId, ctx.clientId);

    await repo.removeMember(projectId, userId);

    await activityService.log({
      ctx,
      eventType: 'project.member_removed',
      entityType: 'project',
      entityId: projectId,
      projectId,
      metadata: { removedUserId: userId },
    });
  }
}

export const projectService = new ProjectService();
