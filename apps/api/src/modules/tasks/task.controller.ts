import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';
import type { ServiceContext } from '../activity/activity.service';

function buildContext(req: Request): ServiceContext {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    agencyId: req.effectiveAgencyId ?? req.user!.agencyId ?? null,
    clientId: req.user!.clientId ?? null,
  };
}

export class TaskController {
  async listForProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const result = await taskService.listForProject(ctx, req.params.projectId || req.params.id, req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const task = await taskService.create(ctx, req.params.projectId || req.params.id, req.body);
      res.status(201).json({ data: task });
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const task = await taskService.getById(ctx, req.params.id);
      res.json({ data: task });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const task = await taskService.update(ctx, req.params.id, req.body);
      res.json({ data: task });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      await taskService.delete(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const taskController = new TaskController();
