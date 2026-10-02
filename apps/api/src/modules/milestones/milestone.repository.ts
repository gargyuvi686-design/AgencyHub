import { BaseRepository } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { MilestoneStatus, ApprovalStatus, Prisma } from '@prisma/client';
import type { CreateMilestoneInput, UpdateMilestoneInput } from './milestone.schemas';

export class MilestoneRepository extends BaseRepository {
  async listByProject(projectId: string): Promise<any[]> {
    return this.db.milestone.findMany({
      where: {
        projectId,
        agencyId: this.agencyId,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string): Promise<any> {
    const milestone = await this.db.milestone.findFirst({
      where: {
        id,
        agencyId: this.agencyId,
      },
      include: {
        project: {
          select: { id: true, name: true, agencyId: true, clientId: true, managerId: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!milestone) {
      throw Errors.NOT_FOUND('Milestone');
    }

    return milestone;
  }

  async create(projectId: string, input: CreateMilestoneInput): Promise<any> {
    const requiresApproval = input.requiresClientApproval ?? false;
    const approvalStatus = requiresApproval ? ApprovalStatus.PENDING : ApprovalStatus.NONE;

    return this.db.milestone.create({
      data: {
        agencyId: this.agencyId,
        projectId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: input.status ?? MilestoneStatus.PENDING,
        sortOrder: input.sortOrder ?? 0,
        requiresClientApproval: requiresApproval,
        approvalStatus,
      },
    });
  }

  async update(id: string, input: UpdateMilestoneInput): Promise<any> {
    const data: Prisma.MilestoneUpdateManyMutationInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.status !== undefined) data.status = input.status;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    if (input.requiresClientApproval !== undefined) {
      data.requiresClientApproval = input.requiresClientApproval;
      if (input.approvalStatus === undefined) {
        data.approvalStatus = input.requiresClientApproval ? ApprovalStatus.PENDING : ApprovalStatus.NONE;
      }
    }

    if (input.approvalStatus !== undefined) {
      data.approvalStatus = input.approvalStatus;
    }

    const result = await this.db.milestone.updateMany({
      where: { id, agencyId: this.agencyId },
      data,
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Milestone');
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.milestone.deleteMany({
      where: { id, agencyId: this.agencyId },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Milestone');
    }
  }
}
