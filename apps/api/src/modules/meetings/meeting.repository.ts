import { BaseRepository } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { Prisma } from '@prisma/client';
import type { CreateMeetingInput, UpdateMeetingInput } from './meeting.schemas';

export const MEETING_SELECT = {
  id: true,
  agencyId: true,
  projectId: true,
  title: true,
  meetingDate: true,
  notes: true,
  visibleToClient: true,
  aiSummary: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true, agencyId: true, clientId: true, managerId: true } },
} satisfies Prisma.MeetingSelect;

export class MeetingRepository extends BaseRepository {
  async listByProject(projectId: string): Promise<any[]> {
    return this.db.meeting.findMany({
      where: {
        projectId,
        agencyId: this.agencyId,
      },
      select: MEETING_SELECT,
      orderBy: { meetingDate: 'desc' },
    });
  }

  async findById(id: string): Promise<any> {
    const meeting = await this.db.meeting.findFirst({
      where: {
        id,
        agencyId: this.agencyId,
      },
      select: MEETING_SELECT,
    });

    if (!meeting) {
      throw Errors.NOT_FOUND('Meeting');
    }

    return meeting;
  }

  async create(projectId: string, createdBy: string, input: CreateMeetingInput): Promise<any> {
    return this.db.meeting.create({
      data: {
        agencyId: this.agencyId,
        projectId,
        title: input.title,
        meetingDate: new Date(input.meetingDate),
        notes: input.notes ?? null,
        visibleToClient: input.visibleToClient ?? false,
        createdBy,
      },
      select: MEETING_SELECT,
    });
  }

  async update(id: string, input: UpdateMeetingInput): Promise<any> {
    const data: Prisma.MeetingUpdateManyMutationInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.meetingDate !== undefined) data.meetingDate = new Date(input.meetingDate);
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.visibleToClient !== undefined) data.visibleToClient = input.visibleToClient;

    const result = await this.db.meeting.updateMany({
      where: { id, agencyId: this.agencyId },
      data,
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Meeting');
    }

    return this.findById(id);
  }

  async saveAiSummary(id: string, aiSummary: Prisma.InputJsonValue): Promise<any> {
    const result = await this.db.meeting.updateMany({
      where: { id, agencyId: this.agencyId },
      data: { aiSummary },
    });
    if (result.count === 0) throw Errors.NOT_FOUND('Meeting');
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.meeting.deleteMany({
      where: { id, agencyId: this.agencyId },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Meeting');
    }
  }
}
