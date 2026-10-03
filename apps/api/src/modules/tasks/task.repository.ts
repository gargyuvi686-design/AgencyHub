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
  sort?: 'priority' | 'dueDate';
}

const PRIORITY_RANK: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function compareTasks(left: any, right: any, sort: 'priority' | 'dueDate' = 'priority'): number {
  const priorityDifference = (PRIORITY_RANK[right.priority] ?? 0) - (PRIORITY_RANK[left.priority] ?? 0);
  const leftDueDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const rightDueDate = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const dueDifference = leftDueDate - rightDueDate;
  if (sort === 'dueDate') return dueDifference || priorityDifference;
  return priorityDifference || dueDifference;
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
  assigneeId: true,
  createdBy: true,
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

    const { skip, take, page, limit } = this.parsePagination(pagination);
    const [allMatching, total] = await Promise.all([
      this.db.task.findMany({ where, select: TASK_SELECT }),
      this.db.task.count({ where }),
    ]);
    const sorted = allMatching.sort((left: any, right: any) => compareTasks(left, right, filters.sort));
    return {
      data: sorted.slice(skip, skip + take).map((task: any) => computeTaskDerivedFields(task)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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
  async validateAssignee(assigneeId: string, projectId: string): Promise<void> {
    const user = await this.db.user.findFirst({
      where: {
        id: assigneeId,
        agencyId: this.agencyId,
        isActive: true,
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
        OR: [
          { projectMemberships: { some: { projectId, agencyId: this.agencyId } } },
          { managedProjects: { some: { id: projectId, agencyId: this.agencyId } } },
        ],
      },
    });

    if (!user) {
      throw Errors.VALIDATION('Task assignee must be an active agency staff member assigned to this project.');
    }
  }

  async listAssignees(projectId: string): Promise<any[]> {
    const project = await this.db.project.findFirst({
      where: { id: projectId, agencyId: this.agencyId },
      select: { managerId: true },
    });
    if (!project) throw Errors.NOT_FOUND('Project');

    const memberships = await this.db.projectMember.findMany({
      where: { projectId, agencyId: this.agencyId },
      select: { userId: true },
    });
    const userIds = [...new Set([project.managerId, ...memberships.map((member) => member.userId)])];
    return this.db.user.findMany({
      where: {
        id: { in: userIds },
        agencyId: this.agencyId,
        isActive: true,
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
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
      await this.validateAssignee(input.assigneeId, input.projectId);
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
    const existing = await this.findById(taskId);
    if (input.assigneeId) {
      await this.validateAssignee(input.assigneeId, existing.projectId);
    }

    if (input.milestoneId) {
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
  * Delete a task scoped by agencyId and optional member ownership.
   */
  async delete(taskId: string, memberId?: string): Promise<any> {
    try {
      return await this.db.task.delete({
        where: {
          id: taskId,
          agencyId: this.agencyId,
          ...(memberId ? { OR: [{ createdBy: memberId }, { assigneeId: memberId }] } : {}),
        },
        select: TASK_SELECT,
      });
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        throw Errors.NOT_FOUND('Task');
      }
      throw err;
    }
  }
}
