import { BaseRepository, PaginatedResult, PaginationInput } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { Prisma, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import type { CreateTaskInput, UpdateTaskInput } from './task.schemas';

export interface CreateTaskRepoInput extends CreateTaskInput {
  projectId: string;
  createdBy: string;
}

export interface UpdateTaskRepoInput extends UpdateTaskInput {}

export interface TaskFilterOptions {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  overdue?: boolean;
  dueThisWeek?: boolean;
  q?: string;
}

export const TASK_SELECT = {
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
  assignee: { select: { id: true, name: true, email: true, role: true } },
  creator: { select: { id: true, name: true } },
  milestone: { select: { id: true, title: true, status: true, projectId: true } },
  project: { select: { id: true, name: true, agencyId: true, clientId: true, managerId: true } },
} satisfies Prisma.TaskSelect;

export function computeTaskDerivedFields<T extends { dueDate?: Date | null; status?: TaskStatus }>(task: T): T & { isOverdue: boolean; isDueSoon: boolean } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  let isOverdue = false;
  let isDueSoon = false;

  if (task.dueDate && task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED) {
    const due = new Date(task.dueDate);
    const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (startOfDue < startOfToday) {
      isOverdue = true;
    } else if (startOfDue <= in7Days) {
      isDueSoon = true;
    }
  }

  return {
    ...task,
    isOverdue,
    isDueSoon,
  };
}

export class TaskRepository extends BaseRepository {
  /**
   * List tasks for a project, verifying project is in this agency.
   */
  async listForProject(
    projectId: string,
    pagination: PaginationInput,
    filters: TaskFilterOptions,
  ): Promise<PaginatedResult<any>> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const where: Prisma.TaskWhereInput = {
      projectId,
      agencyId: this.agencyId,
    };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.assignee) {
      where.assigneeId = filters.assignee;
    }
    if (filters.q) {
      where.title = { contains: filters.q };
    }

    if (filters.overdue) {
      where.dueDate = { lt: startOfToday };
      where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
    } else if (filters.dueThisWeek) {
      where.dueDate = { gte: startOfToday, lte: in7Days };
      where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
    }

    const result = await this.paginate<any>(this.db.task, where, pagination, {
      select: TASK_SELECT,
      orderBy: [{ createdAt: 'asc' }],
    });

    result.data = result.data.map((task: any) => computeTaskDerivedFields(task));
    return result;
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

    return computeTaskDerivedFields(task);
  }

  /**
   * Validate assignee is an active AGENCY_* user in this agency.
   */
  async validateAssignee(assigneeId: string): Promise<void> {
    const user = await this.db.user.findFirst({
      where: { id: assigneeId, agencyId: this.agencyId },
    });

    if (!user) {
      throw Errors.NOT_FOUND('Assignee');
    }

    if (user.role === UserRole.CLIENT || !user.isActive) {
      throw Errors.VALIDATION('Task assignee must be an active agency staff member.');
    }
  }

  /**
   * Validate milestone belongs to this project and agency.
   */
  async validateMilestone(milestoneId: string, projectId: string): Promise<void> {
    const milestone = await this.db.milestone.findFirst({
      where: { id: milestoneId, agencyId: this.agencyId },
    });

    if (!milestone || milestone.projectId !== projectId) {
      throw Errors.NOT_FOUND('Milestone');
    }
  }

  /**
   * Create a task in a project.
   */
  async create(input: CreateTaskRepoInput): Promise<any> {
    // Validate project belongs to this agency
    const project = await this.db.project.findFirst({
      where: { id: input.projectId, agencyId: this.agencyId },
    });
    if (!project) {
      throw Errors.NOT_FOUND('Project');
    }

    // Validate assignee if provided
    if (input.assigneeId) {
      await this.validateAssignee(input.assigneeId);
    }

    // Validate milestone if provided
    if (input.milestoneId) {
      await this.validateMilestone(input.milestoneId, input.projectId);
    }

    const status = input.status ?? TaskStatus.TODO;
    const completedAt = status === TaskStatus.DONE ? new Date() : null;

    const task = await this.db.task.create({
      data: {
        agencyId: this.agencyId,
        projectId: input.projectId,
        milestoneId: input.milestoneId ?? null,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? TaskPriority.MEDIUM,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        completedAt,
        createdBy: input.createdBy,
      },
      select: TASK_SELECT,
    });

    return computeTaskDerivedFields(task);
  }

  /**
   * Update a task using updateMany scoped by agencyId.
   */
  async update(taskId: string, input: UpdateTaskRepoInput): Promise<any> {
    if (input.assigneeId) {
      await this.validateAssignee(input.assigneeId);
    }

    if (input.milestoneId) {
      const existing = await this.findById(taskId);
      await this.validateMilestone(input.milestoneId, existing.projectId);
    }

    const data: Prisma.TaskUncheckedUpdateManyInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
    if (input.milestoneId !== undefined) data.milestoneId = input.milestoneId;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === TaskStatus.DONE) {
        data.completedAt = new Date();
      } else {
        data.completedAt = null;
      }
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
   * Delete a task using deleteMany scoped by agencyId.
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
