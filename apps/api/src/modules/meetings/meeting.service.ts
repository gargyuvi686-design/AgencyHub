import { MeetingRepository } from './meeting.repository';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import { activityService, ServiceContext } from '../activity/activity.service';
import type { CreateMeetingInput, UpdateMeetingInput } from './meeting.schemas';

export class MeetingService {
  async listByProject(ctx: ServiceContext, projectId: string) {
    await resolveProjectAccess(ctx, projectId);
    const repo = new MeetingRepository(ctx.agencyId!);
    return repo.listByProject(projectId);
  }

  async create(ctx: ServiceContext, projectId: string, input: CreateMeetingInput) {
    const project = await resolveProjectAccess(ctx, projectId);
    const repo = new MeetingRepository(ctx.agencyId!);

    const meeting = await repo.create(projectId, ctx.userId, input);

    await activityService.log({
      ctx,
      eventType: 'meeting.recorded',
      entityType: 'meeting',
      entityId: meeting.id,
      projectId,
      visibleToClient: input.visibleToClient ?? false,
      metadata: { title: meeting.title, projectName: project.name },
    });

    return meeting;
  }

  async getById(ctx: ServiceContext, id: string) {
    const repo = new MeetingRepository(ctx.agencyId!);
    const meeting = await repo.findById(id);
    await resolveProjectAccess(ctx, meeting.projectId);
    return meeting;
  }

  async update(ctx: ServiceContext, id: string, input: UpdateMeetingInput) {
    const repo = new MeetingRepository(ctx.agencyId!);
    const current = await repo.findById(id);
    await resolveProjectAccess(ctx, current.projectId);
    return repo.update(id, input);
  }

  async delete(ctx: ServiceContext, id: string) {
    const repo = new MeetingRepository(ctx.agencyId!);
    const current = await repo.findById(id);
    await resolveProjectAccess(ctx, current.projectId);
    await repo.delete(id);
  }
}

export const meetingService = new MeetingService();
