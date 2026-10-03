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
    const mine = query.mine === true || query.mine === 'true';

    return repo.listForProject(projectId, pagination, {
      status: query.status,
      priority: query.priority,
      assignee: mine ? ctx.userId : query.assignee,
      sort: query.sort,
      overdue,
      dueThisWeek,
      q: query.q,
    });
  }

  async listAssignees(ctx: ServiceContext, projectId: string) {
    await resolveProjectAccess(ctx, projectId);
    return new TaskRepository(ctx.agencyId!).listAssignees(projectId);
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

    if (task.assigneeId && task.assignee) {
      await activityService.log({
        ctx,
        eventType: 'task.assigned',
        entityType: 'task',
        entityId: task.id,
        projectId,
        visibleToClient: false,
        metadata: { oldAssignee: null, newAssignee: { id: task.assignee.id, name: task.assignee.name } },
      });
    }

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

    await activityService.log({
      ctx,
      eventType: 'task.updated',
      entityType: 'task',
      entityId: taskId,
      projectId: updated.projectId,
      visibleToClient: false,
      metadata: { title: updated.title, projectName: updated.project?.name },
    });

    if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
      await activityService.log({
        ctx,
        eventType: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId: updated.projectId,
        visibleToClient: false,
        metadata: {
          oldAssignee: current.assignee ? { id: current.assignee.id, name: current.assignee.name } : null,
          newAssignee: updated.assignee ? { id: updated.assignee.id, name: updated.assignee.name } : null,
        },
      });
    }

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
    let memberId: string | undefined;
    if (ctx.role === 'AGENCY_MEMBER') {
      const current = await repo.findById(taskId);
      await resolveProjectAccess(ctx, current.projectId);
      memberId = ctx.userId;
    }
    const deleted = await repo.delete(taskId, memberId);
    await activityService.log({
      ctx,
      eventType: 'task.deleted',
      entityType: 'task',
      entityId: deleted.id,
      projectId: deleted.projectId,
      visibleToClient: false,
      metadata: { title: deleted.title, projectName: deleted.project?.name },
    });
  }
}

export const taskService = new TaskService();
