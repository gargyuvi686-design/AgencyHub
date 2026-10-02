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
}

export const activityService = new ActivityService();
