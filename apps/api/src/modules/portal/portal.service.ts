import { prisma } from '../../lib/prisma';
import { createScopedPrisma } from '../../lib/scopedPrisma';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';

const PROJECT_SELECT = {
  id: true,
  agencyId: true,
  clientId: true,
  managerId: true,
  name: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, companyName: true, contactName: true, email: true } },
  manager: { select: { id: true, name: true, email: true, role: true } },
};

async function computeProjectProgress(projectId: string, agencyId: string) {
  const taskGroups = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId, agencyId },
    _count: { id: true },
  });

  let done = 0;
  let nonCancelled = 0;

  for (const group of taskGroups) {
    if (group.status === 'DONE') done += group._count.id;
    if (group.status !== 'CANCELLED') nonCancelled += group._count.id;
  }

  return nonCancelled > 0 ? Math.round((done / nonCancelled) * 100) : 0;
}

export class PortalService {
  async getClient(ctx: ServiceContext, clientId: string) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const client = await createScopedPrisma(ctx.agencyId!, ctx.clientId).client.findFirst({
      where: { id: clientId },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
      },
    });

    if (!client) throw Errors.NOT_FOUND('Client');
    return { data: client };
  }

  async getOverview(ctx: ServiceContext) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const projects = await prisma.project.findMany({
      where: { agencyId: ctx.agencyId!, clientId: ctx.clientId },
      select: PROJECT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    const withProgress = await Promise.all(
      projects.map(async (project) => ({
        ...project,
        progress: await computeProjectProgress(project.id, ctx.agencyId!),
      })),
    );

    const visibleMeetings = await prisma.meeting.count({
      where: {
        agencyId: ctx.agencyId!,
        visibleToClient: true,
        project: { clientId: ctx.clientId },
      },
    });

    return {
      data: {
        clientId: ctx.clientId,
        totalProjects: withProgress.length,
        activeProjects: withProgress.filter((p) => p.status !== 'COMPLETED').length,
        visibleMeetings,
        projects: withProgress,
      },
    };
  }

  async listProjects(ctx: ServiceContext) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const projects = await prisma.project.findMany({
      where: { agencyId: ctx.agencyId!, clientId: ctx.clientId },
      select: PROJECT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: await Promise.all(
        projects.map(async (project) => ({
          ...project,
          progress: await computeProjectProgress(project.id, ctx.agencyId!),
        })),
      ),
    };
  }

  async getProject(ctx: ServiceContext, projectId: string) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const project = await prisma.project.findFirst({
      where: { id: projectId, agencyId: ctx.agencyId!, clientId: ctx.clientId },
      select: {
        ...PROJECT_SELECT,
        milestones: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            requiresClientApproval: true,
            approvalStatus: true,
            createdAt: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!project) throw Errors.NOT_FOUND('Project');

    return {
      data: {
        ...project,
        progress: await computeProjectProgress(project.id, ctx.agencyId!),
      },
    };
  }

  async listMeetings(ctx: ServiceContext, projectId: string) {
    if (!ctx.clientId) throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');

    const project = await prisma.project.findFirst({
      where: { id: projectId, agencyId: ctx.agencyId!, clientId: ctx.clientId },
      select: { id: true },
    });

    if (!project) throw Errors.NOT_FOUND('Project');

    const meetings = await prisma.meeting.findMany({
      where: {
        projectId: project.id,
        agencyId: ctx.agencyId!,
        visibleToClient: true,
      },
      orderBy: { meetingDate: 'desc' },
      select: {
        id: true,
        projectId: true,
        title: true,
        meetingDate: true,
        notes: true,
        visibleToClient: true,
        createdAt: true,
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    return { data: meetings };
  }
}

export const portalService = new PortalService();
