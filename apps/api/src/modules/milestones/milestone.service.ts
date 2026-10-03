import { MilestoneRepository } from './milestone.repository';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import { activityService, ServiceContext } from '../activity/activity.service';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import { ApprovalStatus, MilestoneStatus } from '@prisma/client';
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

    const needsApproval = input.requiresClientApproval ?? current.requiresClientApproval;
    const completed = (input.status ?? current.status) === MilestoneStatus.DONE;
    const enteringDone = input.status === MilestoneStatus.DONE && current.status !== MilestoneStatus.DONE;
    if (input.approvalStatus === ApprovalStatus.PENDING && !needsApproval) {
      throw Errors.BAD_REQUEST('Enable client approval before requesting approval.');
    }
    const approvalStatus = !needsApproval
      ? ApprovalStatus.NONE
      : input.approvalStatus === ApprovalStatus.PENDING || (completed && (enteringDone || input.requiresClientApproval === true))
        ? ApprovalStatus.PENDING
        : undefined;
    const updated = await repo.update(id, { ...input, approvalStatus });

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

  async listPortalMilestones(ctx: ServiceContext, projectId: string) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const project = await prisma.project.findFirst({
      where: { id: projectId, agencyId: ctx.agencyId!, clientId: ctx.clientId },
      select: { id: true },
    });
    if (!project) throw Errors.NOT_FOUND('Project');

    return prisma.milestone.findMany({
      where: { projectId: project.id, agencyId: ctx.agencyId! },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async decidePortalApproval(
    ctx: ServiceContext,
    milestoneId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED',
    comment?: string,
  ) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const milestone = await prisma.milestone.findFirst({
      where: {
        id: milestoneId,
        agencyId: ctx.agencyId!,
        project: { is: { agencyId: ctx.agencyId!, clientId: ctx.clientId } },
      },
      select: { id: true, projectId: true, title: true, approvalStatus: true },
    });
    if (!milestone) throw Errors.NOT_FOUND('Milestone');
    if (milestone.approvalStatus !== ApprovalStatus.PENDING) {
      throw Errors.CONFLICT('This milestone is not awaiting approval.');
    }

    const result = await prisma.milestone.updateMany({
      where: { id: milestone.id, agencyId: ctx.agencyId!, approvalStatus: ApprovalStatus.PENDING },
      data: { approvalStatus: decision, approvedBy: ctx.userId, approvedAt: new Date() },
    });
    if (result.count === 0) throw Errors.CONFLICT('This milestone is not awaiting approval.');

    await activityService.log({
      ctx,
      eventType: decision === ApprovalStatus.APPROVED ? 'milestone.approved' : 'milestone.changes_requested',
      entityType: 'milestone',
      entityId: milestone.id,
      projectId: milestone.projectId,
      visibleToClient: true,
      metadata: { title: milestone.title, ...(comment ? { comment } : {}) },
    });

    return prisma.milestone.findFirstOrThrow({ where: { id: milestone.id, agencyId: ctx.agencyId! } });
  }
}

export const milestoneService = new MilestoneService();
