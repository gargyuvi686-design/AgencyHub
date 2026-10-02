import { TaskRepository } from './task.repository';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import { activityService, ServiceContext } from '../activity/activity.service';
import { TaskStatus } from '@prisma/client';
import type { CreateTaskInput, UpdateTaskInput, ListTasksQuery } from './task.schemas';
import type { PaginationInput } from '../../lib/baseRepository';

export class TaskService {
  async listForProject(ctx: ServiceContext, projectId: string, query: ListTasksQuery) {
    await resolveProjectAccess(ctx, projectId);
    const repo = new TaskRepository(ctx.agencyId!);

    const pagination: PaginationInput = {
      page: query.page,
      limit: query.limit,
    };

    const overdue = query.overdue === true || query.overdue === 'true';
    const dueThisWeek = query.dueThisWeek === true || query.dueThisWeek === 'true';

    return repo.listForProject(projectId, pagination, {
      status: query.status,
      priority: query.priority,
      assignee: query.assignee,
      overdue,
      dueThisWeek,
      q: query.q,
    });
  }

  async create(ctx: ServiceContext, projectId: string, input: CreateTaskInput) {
    await resolveProjectAccess(ctx, projectId);
    const repo = new TaskRepository(ctx.agencyId!);

    const task = await repo.create({
      ...input,
      projectId,
      createdBy: ctx.userId,
    });

    await activityService.log({
      ctx,
      eventType: 'task.created',
      entityType: 'task',
      entityId: task.id,
      projectId,
      visibleToClient: false,
      metadata: { title: task.title, projectName: task.project?.name },
    });

    if (task.status === TaskStatus.DONE) {
      await activityService.log({
        ctx,
        eventType: 'task.completed',
        entityType: 'task',
        entityId: task.id,
        projectId,
        visibleToClient: false,
        metadata: { title: task.title, projectName: task.project?.name },
      });
    }

    return task;
  }

  async getById(ctx: ServiceContext, taskId: string) {
    const repo = new TaskRepository(ctx.agencyId!);
    const task = await repo.findById(taskId);
    if (ctx.role === 'AGENCY_MEMBER') {
      await resolveProjectAccess(ctx, task.projectId);
    }
    return task;
  }

  async update(ctx: ServiceContext, taskId: string, input: UpdateTaskInput) {
    const repo = new TaskRepository(ctx.agencyId!);
    const current = await repo.findById(taskId);

    if (ctx.role === 'AGENCY_MEMBER') {
      await resolveProjectAccess(ctx, current.projectId);
    }

    const updated = await repo.update(taskId, input);

    if (input.status === TaskStatus.DONE && current.status !== TaskStatus.DONE) {
      await activityService.log({
        ctx,
        eventType: 'task.completed',
        entityType: 'task',
        entityId: taskId,
        projectId: updated.projectId,
        visibleToClient: false,
        metadata: { title: updated.title, projectName: updated.project?.name },
      });
    }

    return updated;
  }

  async delete(ctx: ServiceContext, taskId: string) {
    const repo = new TaskRepository(ctx.agencyId!);
    if (ctx.role === 'AGENCY_MEMBER') {
      const current = await repo.findById(taskId);
      await resolveProjectAccess(ctx, current.projectId);
    }
    await repo.delete(taskId);
  }
}

export const taskService = new TaskService();
