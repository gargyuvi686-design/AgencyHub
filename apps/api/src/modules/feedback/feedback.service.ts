import { FeedbackStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import { activityService, type ServiceContext } from '../activity/activity.service';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import type {
  CreateFeedbackCommentInput,
  CreateFeedbackInput,
  UpdateFeedbackStatusInput,
} from './feedback.schemas';

const FEEDBACK_SELECT = {
  id: true,
  agencyId: true,
  projectId: true,
  clientId: true,
  submittedBy: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  submitter: { select: { id: true, name: true, role: true } },
};

export class FeedbackService {
  async listForAgency(ctx: ServiceContext, status?: FeedbackStatus) {
    if (!ctx.agencyId) throw Errors.UNAUTHORIZED();
    const where: any = { agencyId: ctx.agencyId, ...(status ? { status } : {}) };
    if (ctx.role === 'AGENCY_MEMBER') {
      where.project = {
        is: {
          OR: [
            { managerId: ctx.userId },
            { members: { some: { userId: ctx.userId, agencyId: ctx.agencyId } } },
          ],
        },
      };
    }
    const data = await prisma.feedback.findMany({
      where,
      select: {
        ...FEEDBACK_SELECT,
        project: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  async listForPortal(ctx: ServiceContext) {
    if (!ctx.agencyId || !ctx.clientId) throw Errors.FORBIDDEN();
    const data = await prisma.feedback.findMany({
      where: {
        agencyId: ctx.agencyId,
        clientId: ctx.clientId,
        project: { is: { agencyId: ctx.agencyId, clientId: ctx.clientId } },
      },
      select: {
        ...FEEDBACK_SELECT,
        project: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  async listForProject(ctx: ServiceContext, projectId: string) {
    const project = await resolveProjectAccess(ctx, projectId);
    const where = {
      agencyId: ctx.agencyId!,
      projectId,
      ...(ctx.role === 'CLIENT' ? { clientId: ctx.clientId! } : {}),
    };

    const data = await prisma.feedback.findMany({
      where,
      select: FEEDBACK_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return { data, projectClientId: project.clientId };
  }

  async submit(ctx: ServiceContext, projectId: string, input: CreateFeedbackInput) {
    if (ctx.role !== 'CLIENT' || !ctx.clientId) throw Errors.FORBIDDEN();

    const project = await resolveProjectAccess(ctx, projectId);
    const feedback = await prisma.feedback.create({
      data: {
        agencyId: ctx.agencyId!,
        projectId,
        clientId: project.clientId,
        submittedBy: ctx.userId,
        title: input.title,
        description: input.description,
      },
      select: FEEDBACK_SELECT,
    });

    await activityService.log({
      ctx,
      eventType: 'feedback.submitted',
      entityType: 'feedback',
      entityId: feedback.id,
      projectId,
      visibleToClient: true,
      metadata: { title: feedback.title },
    });

    return { data: feedback };
  }

  private async findAccessible(ctx: ServiceContext, feedbackId: string) {
    if (!ctx.agencyId) throw Errors.UNAUTHORIZED();
    const feedback = await prisma.feedback.findFirst({
      where: {
        id: feedbackId,
        agencyId: ctx.agencyId,
        ...(ctx.role === 'CLIENT' ? { clientId: ctx.clientId ?? '__none__' } : {}),
      },
      select: FEEDBACK_SELECT,
    });

    if (!feedback) throw Errors.NOT_FOUND('Feedback');
    if (ctx.role !== 'CLIENT') {
      await resolveProjectAccess(ctx, feedback.projectId);
    }
    return feedback;
  }

  async listComments(ctx: ServiceContext, feedbackId: string) {
    await this.findAccessible(ctx, feedbackId);
    const data = await prisma.feedbackComment.findMany({
      where: { agencyId: ctx.agencyId!, feedbackId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        feedbackId: true,
        authorId: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });
    return { data };
  }

  async addComment(ctx: ServiceContext, feedbackId: string, input: CreateFeedbackCommentInput) {
    await this.findAccessible(ctx, feedbackId);
    const data = await prisma.feedbackComment.create({
      data: {
        agencyId: ctx.agencyId!,
        feedbackId,
        authorId: ctx.userId,
        body: input.body,
      },
      select: {
        id: true,
        feedbackId: true,
        authorId: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });
    return { data };
  }

  async updateStatus(ctx: ServiceContext, feedbackId: string, input: UpdateFeedbackStatusInput) {
    if (ctx.role !== 'AGENCY_ADMIN' && ctx.role !== 'AGENCY_MEMBER' && ctx.role !== 'SUPER_ADMIN') {
      throw Errors.FORBIDDEN();
    }

    const current = await this.findAccessible(ctx, feedbackId);
    if (current.status !== input.status) {
      const result = await prisma.feedback.updateMany({
        where: { id: feedbackId, agencyId: ctx.agencyId! },
        data: { status: input.status as FeedbackStatus },
      });
      if (result.count === 0) throw Errors.NOT_FOUND('Feedback');

      await activityService.log({
        ctx,
        eventType: 'feedback.status_changed',
        entityType: 'feedback',
        entityId: feedbackId,
        projectId: current.projectId,
        visibleToClient: true,
        metadata: { from: current.status, to: input.status },
      });
    }

    const data = await prisma.feedback.findFirst({
      where: { id: feedbackId, agencyId: ctx.agencyId! },
      select: FEEDBACK_SELECT,
    });
    if (!data) throw Errors.NOT_FOUND('Feedback');
    return { data };
  }
}

export const feedbackService = new FeedbackService();