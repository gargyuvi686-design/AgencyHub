import { Request, Response, NextFunction } from 'express';
import { meetingService } from './meeting.service';
import type { ServiceContext } from '../activity/activity.service';

function buildContext(req: Request): ServiceContext {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    agencyId: req.effectiveAgencyId ?? req.user!.agencyId ?? null,
    clientId: req.user!.clientId ?? null,
  };
}

export class MeetingController {
  async listByProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const meetings = await meetingService.listByProject(ctx, req.params.projectId || req.params.id);
      res.json({ data: meetings });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const meeting = await meetingService.create(ctx, req.params.projectId || req.params.id, req.body);
      res.status(201).json({ data: meeting });
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const meeting = await meetingService.getById(ctx, req.params.id);
      res.json({ data: meeting });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const meeting = await meetingService.update(ctx, req.params.id, req.body);
      res.json({ data: meeting });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      await meetingService.delete(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const meetingController = new MeetingController();
