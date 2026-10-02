import { BaseRepository, PaginatedResult, PaginationInput } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { ProjectStatus, ProjectPriority, Prisma, UserRole } from '@prisma/client';

export interface CreateProjectRepoInput {
  clientId: string;
  managerId: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: Date | null;
  dueDate?: Date | null;
}

export interface UpdateProjectRepoInput {
  clientId?: string;
  managerId?: string;
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: Date | null;
  dueDate?: Date | null;
}

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
  client: {
    select: { id: true, companyName: true, contactName: true, email: true },
  },
  manager: {
    select: { id: true, name: true, email: true, role: true },
  },
  _count: {
    select: {
      tasks: true,
      milestones: true,
      members: true,
    },
  },
} satisfies Prisma.ProjectSelect;

export class ProjectRepository extends BaseRepository {
  /**
   * List projects for this agency.
   * AGENCY_ADMIN / SUPER_ADMIN (support mode): all projects.
   * AGENCY_MEMBER: only projects where they are assigned or manager.
   */
  async list(
    pagination: PaginationInput,
    filters?: {
      userId?: string;
      role?: string;
      clientId?: string;
      status?: ProjectStatus;
      q?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const where: Prisma.ProjectWhereInput = {
      agencyId: this.agencyId,
    };

    if (filters?.clientId) {
      where.clientId = filters.clientId;
    }

    // AGENCY_MEMBER: only assigned projects or managed projects
    if (filters?.role === 'AGENCY_MEMBER' && filters?.userId) {
      where.OR = [
        { managerId: filters.userId },
        {
          members: {
            some: {
              userId: filters.userId,
              agencyId: this.agencyId,
            },
          },
        },
      ];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.q) {
      where.name = { contains: filters.q };
    }

    const result = await this.paginate<any>(this.db.project, where, pagination, {
      select: PROJECT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    if (result.data.length > 0) {
      const projectIds = result.data.map((p: any) => p.id);
      const taskGroups = await this.db.task.groupBy({
        by: ['projectId', 'status'],
        where: {
          projectId: { in: projectIds },
          agencyId: this.agencyId,
        },
        _count: { id: true },
      });

      const progressByProject = new Map<string, { done: number; nonCancelled: number }>();
      for (const g of taskGroups) {
        if (!progressByProject.has(g.projectId)) {
          progressByProject.set(g.projectId, { done: 0, nonCancelled: 0 });
        }
        const stats = progressByProject.get(g.projectId)!;
        if (g.status === 'DONE') stats.done += g._count.id;
        if (g.status !== 'CANCELLED') stats.nonCancelled += g._count.id;
      }

      result.data = result.data.map((p: any) => {
        const stats = progressByProject.get(p.id);
        const progress = stats && stats.nonCancelled > 0 ? Math.round((stats.done / stats.nonCancelled) * 100) : 0;
        return { ...p, progress };
      });
    }

    return result;
  }

  /**
   * Find a specific project, verifying agency ownership and member access.
   */
  async findById(projectId: string, requestingUserId?: string, role?: string): Promise<any> {
    const where: Prisma.ProjectWhereInput = {
      id: projectId,
      agencyId: this.agencyId,
    };

    if (role === 'AGENCY_MEMBER' && requestingUserId) {
      where.OR = [
        { managerId: requestingUserId },
        {
          members: {
            some: {
              userId: requestingUserId,
              agencyId: this.agencyId,
            },
          },
        },
      ];
    }

    const project = await this.db.project.findFirst({
      where,
      select: {
        ...PROJECT_SELECT,
        members: {
          select: {
            id: true,
            userId: true,
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw Errors.NOT_FOUND('Project');
    }

    const taskGroups = await this.db.task.groupBy({
      by: ['status'],
      where: {
        projectId,
        agencyId: this.agencyId,
      },
      _count: { id: true },
    });

    let done = 0;
    let nonCancelled = 0;
    for (const g of taskGroups) {
      if (g.status === 'DONE') done += g._count.id;
      if (g.status !== 'CANCELLED') nonCancelled += g._count.id;
    }
    const progress = nonCancelled > 0 ? Math.round((done / nonCancelled) * 100) : 0;

    return {
      ...project,
      progress,
    };
  }

  /**
   * Create a new project in this agency.
   * Validates client and manager belong to this agency, and manager is an active AGENCY_* user.
   */
  async create(input: CreateProjectRepoInput): Promise<any> {
    const client = await this.db.client.findFirst({
      where: { id: input.clientId, agencyId: this.agencyId },
    });
    if (!client) {
      throw Errors.NOT_FOUND('Client');
    }

    // Validate manager is an active AGENCY_* user in this agency
    const manager = await this.db.user.findFirst({
      where: {
        id: input.managerId,
        agencyId: this.agencyId,
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
        isActive: true,
      },
    });
    if (!manager) {
      const anyUserInAgency = await this.db.user.findFirst({
        where: { id: input.managerId, agencyId: this.agencyId },
      });
      if (anyUserInAgency) {
        throw Errors.VALIDATION('Project manager must be an active agency staff member.');
      }
      throw Errors.NOT_FOUND('Manager');
    }

    return this.db.project.create({
      data: {
        agencyId: this.agencyId,
        clientId: input.clientId,
        managerId: input.managerId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? ProjectStatus.PLANNING,
        priority: input.priority ?? ProjectPriority.MEDIUM,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
      },
      select: PROJECT_SELECT,
    });
  }

  /**
   * Update a project using updateMany scoped by agencyId with count check.
   */
  async update(projectId: string, input: UpdateProjectRepoInput): Promise<any> {
    if (input.clientId) {
      const client = await this.db.client.findFirst({
        where: { id: input.clientId, agencyId: this.agencyId },
      });
      if (!client) {
        throw Errors.NOT_FOUND('Client');
      }
    }

    if (input.managerId) {
      const manager = await this.db.user.findFirst({
        where: {
          id: input.managerId,
          agencyId: this.agencyId,
          role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
          isActive: true,
        },
      });
      if (!manager) {
        const anyUserInAgency = await this.db.user.findFirst({
          where: { id: input.managerId, agencyId: this.agencyId },
        });
        if (anyUserInAgency) {
          throw Errors.VALIDATION('Project manager must be an active agency staff member.');
        }
        throw Errors.NOT_FOUND('Manager');
      }
    }

    const result = await this.db.project.updateMany({
      where: { id: projectId, agencyId: this.agencyId },
      data: input,
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Project');
    }

    return this.findById(projectId);
  }

  /**
   * Delete a project using deleteMany scoped by agencyId.
   */
  async delete(projectId: string): Promise<void> {
    const result = await this.db.project.deleteMany({
      where: { id: projectId, agencyId: this.agencyId },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Project');
    }
  }

  /**
   * Replace project members in one transaction, verifying every user is an active AGENCY_* user
   * in the same agency, writing agency_id on every row.
   */
  async setMembers(projectId: string, userIds: string[]): Promise<void> {
    const existing = await this.db.project.findFirst({
      where: { id: projectId, agencyId: this.agencyId },
    });
    if (!existing) {
      throw Errors.NOT_FOUND('Project');
    }

    if (userIds.length > 0) {
      const validUsers = await this.db.user.findMany({
        where: {
          id: { in: userIds },
          agencyId: this.agencyId,
          role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
          isActive: true,
        },
        select: { id: true },
      });

      if (validUsers.length !== userIds.length) {
        throw Errors.VALIDATION('Every project member must be an active agency user in this agency.');
      }
    }

    // Atomic replace in one transaction, stamping agencyId on every row
    await this.db.$transaction([
      this.db.projectMember.deleteMany({
        where: { projectId, agencyId: this.agencyId },
      }),
      ...userIds.map((userId) =>
        this.db.projectMember.create({
          data: { projectId, userId, agencyId: this.agencyId },
        }),
      ),
    ]);
  }

  /**
   * Remove a single member from a project.
   */
  async removeMember(projectId: string, userId: string): Promise<void> {
    const existing = await this.db.project.findFirst({
      where: { id: projectId, agencyId: this.agencyId },
    });
    if (!existing) {
      throw Errors.NOT_FOUND('Project');
    }

    await this.db.projectMember.deleteMany({
      where: { projectId, userId, agencyId: this.agencyId },
    });
  }
}
