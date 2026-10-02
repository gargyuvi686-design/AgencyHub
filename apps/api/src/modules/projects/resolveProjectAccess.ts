import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';

/**
 * Resolves and enforces project access matrix:
 *
 * 1. Cross-agency access: ALWAYS throws 404 NOT_FOUND (doc 02 §3.4: never leak existence).
 * 2. SUPER_ADMIN (in active support session): access to projects in the supported agency.
 * 3. AGENCY_ADMIN: access to all projects in their agency.
 * 4. AGENCY_MEMBER: access ONLY if assigned as a member or designated manager. Otherwise 404.
 * 5. CLIENT (portal user): access ONLY if project.clientId matches ctx.clientId. Otherwise 404.
 */
export async function resolveProjectAccess(ctx: ServiceContext, projectId: string) {
  if (!ctx.agencyId) {
    throw Errors.UNAUTHORIZED();
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      agencyId: ctx.agencyId,
    },
    include: {
      client: {
        select: { id: true, companyName: true, contactName: true, email: true },
      },
      manager: {
        select: { id: true, name: true, email: true },
      },
      members: {
        select: {
          id: true,
          userId: true,
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      _count: {
        select: {
          tasks: true,
          milestones: true,
          members: true,
        },
      },
    },
  });

  if (!project) {
    throw Errors.NOT_FOUND('Project');
  }

  if (ctx.role === 'AGENCY_ADMIN' || ctx.role === 'SUPER_ADMIN') {
    return project;
  }

  if (ctx.role === 'AGENCY_MEMBER') {
    const isAssigned =
      project.managerId === ctx.userId ||
      project.members.some((m) => m.userId === ctx.userId);

    if (!isAssigned) {
      throw Errors.NOT_FOUND('Project');
    }
    return project;
  }

  if (ctx.role === 'CLIENT') {
    if (!ctx.clientId || project.clientId !== ctx.clientId) {
      throw Errors.NOT_FOUND('Project');
    }
    return project;
  }

  throw Errors.NOT_FOUND('Project');
}
