import { BaseRepository, PaginatedResult, PaginationInput } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { Prisma, TaskStatus, TaskPriority } from '@prisma/client';

interface CreateTaskInput {
  projectId: string;
  milestoneId?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  createdBy: string; // maps to schema field createdBy
}

interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  milestoneId?: string | null;
  dueDate?: Date | null;
  completedAt?: Date | null;
}

const TASK_SELECT = {
  id: true,
  agencyId: true,
  projectId: true,
  milestoneId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true } },
  creator: { select: { id: true, name: true } },
  milestone: { select: { id: true, title: true, status: true } },
} satisfies Prisma.TaskSelect;

export class TaskRepository extends BaseRepository {
  /**
   * List tasks for a project, verifying project is in this agency.
   * AGENCY_MEMBER: must also be a member of the project.
   */
  async listForProject(
    projectId: string,
    pagination: PaginationInput,
    filters: {
      status?: TaskStatus;
      assigneeId?: string;
      milestoneId?: string;
    },
    memberCheck?: { userId: string; role: string },
  ): Promise<PaginatedResult<any>> {
    // Verify project belongs to this agency (and member if needed)
    const projectWhere: Prisma.ProjectWhereInput = {
      id: projectId,
      agencyId: this.agencyId,
    };
    if (memberCheck?.role === 'AGENCY_MEMBER') {
      projectWhere.members = {
        some: { userId: memberCheck.userId, agencyId: this.agencyId },
      };
    }

    const project = await this.db.project.findFirst({ where: projectWhere });
    if (!project) {
      throw Errors.NOT_FOUND('Project');
    }

    const where: Prisma.TaskWhereInput = {
      projectId,
      agencyId: this.agencyId,
      ...(filters.status && { status: filters.status }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.milestoneId && { milestoneId: filters.milestoneId }),
    };

    return this.paginate<any>(this.db.task, where, pagination, {
      select: TASK_SELECT,
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  /**
   * Find a specific task by ID, always checking agencyId.
   */
  async findById(taskId: string): Promise<any> {
    const task = await this.db.task.findFirst({
      where: { id: taskId, agencyId: this.agencyId },
      select: TASK_SELECT,
    });

    if (!task) {
      throw Errors.NOT_FOUND('Task');
    }

    return task;
  }

  /**
   * Create a task in a project.
   * Tenancy rule §3.5: child resources validated through parent (task → project → agency).
   */
  async create(input: CreateTaskInput): Promise<any> {
    // Validate project belongs to this agency
    const project = await this.db.project.findFirst({
      where: { id: input.projectId, agencyId: this.agencyId },
    });
    if (!project) {
      throw Errors.NOT_FOUND('Project');
    }

    // Validate assignee (if supplied) belongs to this agency
    if (input.assigneeId) {
      const assignee = await this.db.user.findFirst({
        where: { id: input.assigneeId, agencyId: this.agencyId },
      });
      if (!assignee) {
        throw Errors.VALIDATION('Assignee does not belong to this agency.');
      }
    }

    // Validate milestone belongs to this project+agency
    if (input.milestoneId) {
      const milestone = await this.db.milestone.findFirst({
        where: {
          id: input.milestoneId,
          projectId: input.projectId,
          agencyId: this.agencyId,
        },
      });
      if (!milestone) {
        throw Errors.VALIDATION('Milestone does not belong to this project.');
      }
    }

    return this.db.task.create({
      data: {
        agencyId: this.agencyId,
        projectId: input.projectId,
        milestoneId: input.milestoneId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? TaskStatus.TODO,
        priority: input.priority ?? TaskPriority.MEDIUM,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        createdBy: input.createdBy,
      },
      select: TASK_SELECT,
    });
  }

  /**
   * Update a task using updateMany scoped by agencyId with count check.
   * Throws 404 NOT_FOUND on 0 affected rows (tenancy invariant).
   */
  async update(taskId: string, input: UpdateTaskInput): Promise<any> {
    if (input.assigneeId) {
      const assignee = await this.db.user.findFirst({
        where: { id: input.assigneeId, agencyId: this.agencyId },
      });
      if (!assignee) {
        throw Errors.VALIDATION('Assignee does not belong to this agency.');
      }
    }

    // Auto-set completedAt when transitioning to DONE
    const data: Prisma.TaskUpdateManyMutationInput = { ...input };
    if (input.status === TaskStatus.DONE) {
      data.completedAt = new Date();
    } else if (input.status) {
      data.completedAt = null;
    }

    const result = await this.db.task.updateMany({
      where: { id: taskId, agencyId: this.agencyId },
      data,
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Task');
    }

    return this.findById(taskId);
  }

  /**
   * Delete a task using deleteMany scoped by agencyId with count check.
   * Throws 404 NOT_FOUND on 0 affected rows (tenancy invariant).
   */
  async delete(taskId: string): Promise<void> {
    const result = await this.db.task.deleteMany({
      where: { id: taskId, agencyId: this.agencyId },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Task');
    }
  }
}
