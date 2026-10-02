import type { Request, Response, NextFunction } from 'express';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';
import { createAiTasksSchema } from './meeting-ai.schemas';
import { meetingAiService } from './meeting-ai.service';

function buildContext(req: Request): ServiceContext {
  if (!req.user) throw Errors.UNAUTHORIZED();
  return {
    userId: req.user.userId,
    role: req.user.role,
    agencyId: req.effectiveAgencyId ?? req.user.agencyId ?? null,
    clientId: req.user.clientId ?? null,
  };
}

export class MeetingAiController {
  async summarize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await meetingAiService.summarize(buildContext(req), req.params.id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  async createSelectedTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createAiTasksSchema.parse(req.body);
      const result = await meetingAiService.createSelectedTasks(buildContext(req), req.params.id, input.items);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const meetingAiController = new MeetingAiController();