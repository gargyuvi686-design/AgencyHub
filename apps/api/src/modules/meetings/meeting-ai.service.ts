import Anthropic from '@anthropic-ai/sdk';
import { Prisma, UserRole } from '@prisma/client';
import { env } from '../../config/env';
import { Errors } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { activityService, type ServiceContext } from '../activity/activity.service';
import { taskService } from '../tasks/task.service';
import type { CreateTaskInput } from '../tasks/task.schemas';
import { MeetingRepository } from './meeting.repository';
import { resolveProjectAccess } from '../projects/resolveProjectAccess';
import type { AiActionItem, AiSummary } from './meeting-ai.schemas';
import { aiSummarySchema } from './meeting-ai.schemas';

const SYSTEM_PROMPT = [
  'Summarize the supplied meeting notes for the supplied project.',
  'Return only strict JSON with exactly these keys: summary, decisions, actionItems.',
  'summary must be a string; decisions must be an array of strings.',
  'actionItems must be an array of objects with exactly title, assigneeHint, dueDate.',
  'assigneeHint must be a string or null. dueDate must be YYYY-MM-DD or null.',
].join(' ');

function isTimeout(error: unknown): boolean {
  return error instanceof Error && /timeout|timed out|abort/i.test(error.message);
}

function getText(response: Anthropic.Messages.Message): string | null {
  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : null;
}

export class MeetingAiService {
  private async findMeeting(ctx: ServiceContext, meetingId: string) {
    if (!ctx.agencyId) throw Errors.UNAUTHORIZED();
    const meeting = await new MeetingRepository(ctx.agencyId).findById(meetingId);
    if (ctx.role === 'AGENCY_MEMBER') await resolveProjectAccess(ctx, meeting.projectId);
    return meeting;
  }

  async summarize(ctx: ServiceContext, meetingId: string): Promise<AiSummary> {
    const meeting = await this.findMeeting(ctx, meetingId);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw Errors.AI_NOT_CONFIGURED();

    const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 0 });
    const input = JSON.stringify({ projectName: meeting.project.name, notes: meeting.notes ?? '' });
    const repository = new MeetingRepository(ctx.agencyId!);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let text: string | null;
      try {
        const response = await client.messages.create({
          model: env.AI_MODEL,
          max_tokens: 1600,
          system: attempt === 0 ? SYSTEM_PROMPT : `${SYSTEM_PROMPT} Correct the previous response to satisfy this exact schema.`,
          messages: [{ role: 'user', content: input }],
        });
        text = getText(response);
      } catch (error) {
        throw Errors.AI_ERROR(isTimeout(error) ? 'AI summary timed out. Please try again.' : 'AI summary could not be generated. Please try again.');
      }

      let summary: AiSummary | null = null;
      try {
        summary = aiSummarySchema.parse(JSON.parse(text ?? ''));
      } catch {
        if (attempt === 1) throw Errors.AI_ERROR('AI returned an invalid summary. Please try again.');
      }

      if (!summary) continue;
      await repository.saveAiSummary(meetingId, summary as unknown as Prisma.InputJsonValue);
      await activityService.log({
        ctx,
        eventType: 'meeting.ai_summarized',
        entityType: 'meeting',
        entityId: meeting.id,
        projectId: meeting.projectId,
        visibleToClient: meeting.visibleToClient,
      });
      return summary;
    }

    throw Errors.AI_ERROR();
  }

  async createSelectedTasks(ctx: ServiceContext, meetingId: string, items: AiActionItem[]) {
    const meeting = await this.findMeeting(ctx, meetingId);
    const staff = await prisma.user.findMany({
      where: {
        agencyId: ctx.agencyId!,
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
        isActive: true,
      },
      select: { id: true, name: true },
    });

    const data = [];
    for (const item of items) {
      const hint = item.assigneeHint?.trim().toLocaleLowerCase();
      const assignee = hint ? staff.find((user) => user.name.trim().toLocaleLowerCase() === hint) : undefined;
      const taskInput: CreateTaskInput = {
        title: item.title,
        assigneeId: assignee?.id ?? null,
        dueDate: item.dueDate,
      };
      data.push(await taskService.create(ctx, meeting.projectId, taskInput));
    }
    return { data };
  }
}

export const meetingAiService = new MeetingAiService();