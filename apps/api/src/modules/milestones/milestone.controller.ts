import { Request, Response, NextFunction } from 'express';
import { milestoneService } from './milestone.service';
import type { ServiceContext } from '../activity/activity.service';

function buildContext(req: Request): ServiceContext {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    agencyId: req.effectiveAgencyId ?? req.user!.agencyId ?? null,
    clientId: req.user!.clientId ?? null,
  };
}

export class MilestoneController {
  async listByProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const data = await milestoneService.listByProject(ctx, req.params.projectId || req.params.id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const data = await milestoneService.create(ctx, req.params.projectId || req.params.id, req.body);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const data = await milestoneService.getById(ctx, req.params.id);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const data = await milestoneService.update(ctx, req.params.id, req.body);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      await milestoneService.delete(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const milestoneController = new MilestoneController();
