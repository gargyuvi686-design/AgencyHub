import { BaseRepository } from '../../lib/baseRepository';
import { TaskStatus } from '@prisma/client';

export interface DashboardStats {
  projects: {
    total: number;
    byStatus: Record<string, number>;
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
    overdue: number;
    dueSoon: number;
  };
  clients: {
    total: number;
  };
  teamMembers: {
    total: number;
  };
  feedback: {
    pending: number;
  };
  recentActivity: any[];
}

export interface MyWorkStats {
  assignedTasks: {
    total: number;
    byStatus: Record<string, number>;
    overdue: number;
    dueSoon: number;
  };
  managedProjects: {
    total: number;
    byStatus: Record<string, number>;
  };
  upcomingMeetings: any[];
}

export class DashboardRepository extends BaseRepository {
  /**
   * Dashboard for AGENCY_ADMIN: whole-agency stats.
   * Dashboard for AGENCY_MEMBER: only projects they're assigned to.
   */
  async getAgencyDashboard(userId: string, role: string): Promise<DashboardStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Determine project scope for members
    let projectIds: string[] | undefined;
    if (role === 'AGENCY_MEMBER') {
      const memberships = await this.db.projectMember.findMany({
        where: { userId, agencyId: this.agencyId },
        select: { projectId: true },
      });
      const managedProjs = await this.db.project.findMany({
        where: { managerId: userId, agencyId: this.agencyId },
        select: { id: true },
      });
      const ids = new Set([
        ...memberships.map((m) => m.projectId),
        ...managedProjs.map((p) => p.id),
      ]);
      projectIds = [...ids];
    }

    // Project stats
    const projectWhere =
      projectIds !== undefined
        ? { agencyId: this.agencyId, id: { in: projectIds } }
        : { agencyId: this.agencyId };

    const projectGroups = await this.db.project.groupBy({
      by: ['status'],
      where: projectWhere,
      _count: { id: true },
    });

    const projectsByStatus: Record<string, number> = {};
    let totalProjects = 0;
    for (const g of projectGroups) {
      projectsByStatus[g.status] = g._count.id;
      totalProjects += g._count.id;
    }

    // Task stats (scoped to projects for members)
    const taskWhere =
      projectIds !== undefined
        ? { agencyId: this.agencyId, projectId: { in: projectIds } }
        : { agencyId: this.agencyId };

    const taskGroups = await this.db.task.groupBy({
      by: ['status'],
      where: taskWhere,
      _count: { id: true },
    });

    const tasksByStatus: Record<string, number> = {};
    let totalTasks = 0;
    for (const g of taskGroups) {
      tasksByStatus[g.status] = g._count.id;
      totalTasks += g._count.id;
    }

    const overdueCount = await this.db.task.count({
      where: {
        ...taskWhere,
        dueDate: { lt: startOfToday },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
    });

    const dueSoonCount = await this.db.task.count({
      where: {
        ...taskWhere,
        dueDate: { gte: startOfToday, lte: in7Days },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
    });

    const pendingFeedbackCount = await this.db.feedback.count({
      where: {
        agencyId: this.agencyId,
        projectId: projectIds !== undefined ? { in: projectIds } : undefined,
        status: { in: ['OPEN', 'IN_REVIEW', 'IN_PROGRESS'] },
      },
    });

    // Client and team stats (admin only, members get zero)
    let totalClients = 0;
    let totalTeamMembers = 0;
    if (role !== 'AGENCY_MEMBER') {
      totalClients = await this.db.client.count({
        where: { agencyId: this.agencyId },
      });
      totalTeamMembers = await this.db.user.count({
        where: {
          agencyId: this.agencyId,
          role: { in: ['AGENCY_ADMIN', 'AGENCY_MEMBER'] },
          isActive: true,
        },
      });
    }

    // Recent activity (last 10 items visible to agency)
    const recentActivity = await this.db.activityLog.findMany({
      where: { agencyId: this.agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      projects: {
        total: totalProjects,
        byStatus: projectsByStatus,
      },
      tasks: {
        total: totalTasks,
        byStatus: tasksByStatus,
        overdue: overdueCount,
        dueSoon: dueSoonCount,
      },
      clients: { total: totalClients },
      teamMembers: { total: totalTeamMembers },
      feedback: { pending: pendingFeedbackCount },
      recentActivity,
    };
  }

  /**
   * My Work: tasks assigned to the calling user, projects they manage,
   * and upcoming meetings in their projects.
   */
  async getMyWork(userId: string): Promise<MyWorkStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Tasks assigned to this user
    const assignedTaskGroups = await this.db.task.groupBy({
      by: ['status'],
      where: { agencyId: this.agencyId, assigneeId: userId },
      _count: { id: true },
    });

    const assignedByStatus: Record<string, number> = {};
    let totalAssigned = 0;
    for (const g of assignedTaskGroups) {
      assignedByStatus[g.status] = g._count.id;
      totalAssigned += g._count.id;
    }

    const assignedOverdue = await this.db.task.count({
      where: {
        agencyId: this.agencyId,
        assigneeId: userId,
        dueDate: { lt: startOfToday },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
    });

    const assignedDueSoon = await this.db.task.count({
      where: {
        agencyId: this.agencyId,
        assigneeId: userId,
        dueDate: { gte: startOfToday, lte: in7Days },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
    });

    // Projects managed by this user
    const managedProjectGroups = await this.db.project.groupBy({
      by: ['status'],
      where: { agencyId: this.agencyId, managerId: userId },
      _count: { id: true },
    });

    const managedByStatus: Record<string, number> = {};
    let totalManaged = 0;
    for (const g of managedProjectGroups) {
      managedByStatus[g.status] = g._count.id;
      totalManaged += g._count.id;
    }

    // Upcoming meetings in projects this user is assigned to or manages (next 14 days)
    const in14Days = new Date(startOfToday.getTime() + 14 * 24 * 60 * 60 * 1000);
    const memberships = await this.db.projectMember.findMany({
      where: { userId, agencyId: this.agencyId },
      select: { projectId: true },
    });
    const managedProjIds = await this.db.project.findMany({
      where: { managerId: userId, agencyId: this.agencyId },
      select: { id: true },
    });
    const allProjIds = new Set([
      ...memberships.map((m) => m.projectId),
      ...managedProjIds.map((p) => p.id),
    ]);

    const upcomingMeetings = await this.db.meeting.findMany({
      where: {
        agencyId: this.agencyId,
        projectId: { in: [...allProjIds] },
        meetingDate: { gte: startOfToday, lte: in14Days },
      },
      orderBy: { meetingDate: 'asc' },
      take: 10,
      select: {
        id: true,
        title: true,
        meetingDate: true,
        projectId: true,
        project: { select: { id: true, name: true } },
      },
    });

    return {
      assignedTasks: {
        total: totalAssigned,
        byStatus: assignedByStatus,
        overdue: assignedOverdue,
        dueSoon: assignedDueSoon,
      },
      managedProjects: {
        total: totalManaged,
        byStatus: managedByStatus,
      },
      upcomingMeetings,
    };
  }
}
