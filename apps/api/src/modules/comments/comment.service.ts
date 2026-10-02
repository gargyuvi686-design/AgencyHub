import { CommentRepository } from './comment.repository';
import { TaskRepository } from '../tasks/task.repository';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import type { ServiceContext } from '../activity/activity.service';

export class CommentService {
  async listByTask(ctx: ServiceContext, taskId: string) {
    const taskRepo = new TaskRepository(ctx.agencyId!);
    const task = await taskRepo.findById(taskId);
    await resolveProjectAccess(ctx, task.projectId);

    const repo = new CommentRepository(ctx.agencyId!);
    return repo.listByTask(taskId);
  }

  async create(ctx: ServiceContext, taskId: string, body: string) {
    const taskRepo = new TaskRepository(ctx.agencyId!);
    const task = await taskRepo.findById(taskId);
    await resolveProjectAccess(ctx, task.projectId);

    const repo = new CommentRepository(ctx.agencyId!);
    return repo.create(taskId, ctx.userId, body);
  }
}

export const commentService = new CommentService();
