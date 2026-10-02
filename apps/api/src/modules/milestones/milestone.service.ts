import { MilestoneRepository } from './milestone.repository';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import { activityService, ServiceContext } from '../activity/activity.service';
import { MilestoneStatus } from '@prisma/client';
import type { CreateMilestoneInput, UpdateMilestoneInput } from './milestone.schemas';

export class MilestoneService {
  async listByProject(ctx: ServiceContext, projectId: string) {
    await resolveProjectAccess(ctx, projectId);
    const repo = new MilestoneRepository(ctx.agencyId!);
    return repo.listByProject(projectId);
  }

  async create(ctx: ServiceContext, projectId: string, input: CreateMilestoneInput) {
    const project = await resolveProjectAccess(ctx, projectId);
    const repo = new MilestoneRepository(ctx.agencyId!);
    const milestone = await repo.create(projectId, input);

    if (milestone.status === MilestoneStatus.DONE) {
      await activityService.log({
        ctx,
        eventType: 'milestone.completed',
        entityType: 'milestone',
        entityId: milestone.id,
        projectId,
        visibleToClient: true,
        metadata: { title: milestone.title, projectName: project.name },
      });
    }

    return milestone;
  }

  async getById(ctx: ServiceContext, id: string) {
    const repo = new MilestoneRepository(ctx.agencyId!);
    const milestone = await repo.findById(id);
    await resolveProjectAccess(ctx, milestone.projectId);
    return milestone;
  }

  async update(ctx: ServiceContext, id: string, input: UpdateMilestoneInput) {
    const repo = new MilestoneRepository(ctx.agencyId!);
    const current = await repo.findById(id);
    const project = await resolveProjectAccess(ctx, current.projectId);

    const updated = await repo.update(id, input);

    if (input.status === MilestoneStatus.DONE && current.status !== MilestoneStatus.DONE) {
      await activityService.log({
        ctx,
        eventType: 'milestone.completed',
        entityType: 'milestone',
        entityId: id,
        projectId: current.projectId,
        visibleToClient: true,
        metadata: { title: updated.title, projectName: project.name },
      });
    }

    return updated;
  }

  async delete(ctx: ServiceContext, id: string) {
    const repo = new MilestoneRepository(ctx.agencyId!);
    const current = await repo.findById(id);
    await resolveProjectAccess(ctx, current.projectId);
    await repo.delete(id);
  }
}

export const milestoneService = new MilestoneService();
