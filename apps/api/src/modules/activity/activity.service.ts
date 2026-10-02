import { prisma } from '../../lib/prisma';
import { ActorType } from '@prisma/client';

/**
 * Request context passed to every service call.
 * Matches req.user shape from authenticate middleware.
 */
export interface ServiceContext {
  userId: string;
  role: string;
  agencyId: string | null;
  clientId: string | null;
}

export interface LogActivityInput {
  /** Resolved from ctx.agencyId — never from caller-supplied metadata. */
  ctx: ServiceContext;
  eventType: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  visibleToClient?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Activity service — centralised event logging.
 *
 * Called from SERVICE layer ONLY — never from controllers.
 * Agency context (agencyId) is ALWAYS taken from ctx, not from metadata.
 * In support mode, the Super Admin can only perform GETs, so there are
 * no mutation events to log for support-mode requests.
 *
 * Actor type resolution:
 *   SUPER_ADMIN  → ActorType.SUPER_ADMIN
 *   CLIENT       → ActorType.CLIENT
 *   Otherwise    → ActorType.USER (AGENCY_ADMIN / AGENCY_MEMBER)
 */
export class ActivityService {
  async log(input: LogActivityInput): Promise<void> {
    const { ctx, eventType, entityType, entityId, projectId, visibleToClient = false, metadata } =
      input;

    // agencyId ALWAYS comes from ctx — never from metadata.
    // If metadata contains an agencyId key, it is silently removed to prevent overriding.
    const safeMetadata = metadata ? { ...metadata } : undefined;
    if (safeMetadata && 'agencyId' in safeMetadata) {
      delete safeMetadata['agencyId'];
    }

    const actorType =
      ctx.role === 'SUPER_ADMIN'
        ? ActorType.SUPER_ADMIN
        : ctx.role === 'CLIENT'
          ? ActorType.CLIENT
          : ActorType.USER;

    await prisma.activityLog.create({
      data: {
        agencyId: ctx.agencyId,
        actorType,
        actorId: ctx.userId,
        eventType,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        projectId: projectId ?? null,
        visibleToClient,
        metadata: (safeMetadata ?? null) as any,
      },
    });
  }

  async listForProject(ctx: ServiceContext, projectId: string, pagination?: { page?: number; limit?: number }) {
    const { resolveProjectAccess } = await import('../projects/resolveProjectAccess');
    await resolveProjectAccess(ctx, projectId);

    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(pagination?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      agencyId: ctx.agencyId,
      projectId,
    };

    if (ctx.role === 'CLIENT') {
      where.visibleToClient = true;
    }

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listForClient(ctx: ServiceContext, clientId: string, pagination?: { page?: number; limit?: number }) {
    const { Errors } = await import('../../lib/errors');
    if (!ctx.agencyId) throw Errors.UNAUTHORIZED();

    const client = await prisma.client.findFirst({
      where: { id: clientId, agencyId: ctx.agencyId },
    });
    if (!client) throw Errors.NOT_FOUND('Client');

    // For agency members, ensure they are assigned to at least one project for this client
    if (ctx.role === 'AGENCY_MEMBER') {
      const assigned = await prisma.project.findFirst({
        where: {
          clientId,
          agencyId: ctx.agencyId,
          OR: [
            { managerId: ctx.userId },
            { members: { some: { userId: ctx.userId, agencyId: ctx.agencyId } } },
          ],
        },
      });
      if (!assigned) {
        throw Errors.NOT_FOUND('Client');
      }
    }

    const page = Math.max(1, Number(pagination?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(pagination?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      agencyId: ctx.agencyId,
      OR: [
        { entityType: 'client', entityId: clientId },
        {
          project: {
            clientId,
          },
        },
      ],
    };

    if (ctx.role === 'CLIENT') {
      where.visibleToClient = true;
    }

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const activityService = new ActivityService();
