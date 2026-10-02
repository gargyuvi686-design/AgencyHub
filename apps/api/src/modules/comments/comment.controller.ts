import { Request, Response, NextFunction } from 'express';
import { commentService } from './comment.service';
import type { ServiceContext } from '../activity/activity.service';

function buildContext(req: Request): ServiceContext {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    agencyId: req.effectiveAgencyId ?? req.user!.agencyId ?? null,
    clientId: req.user!.clientId ?? null,
  };
}

export class CommentController {
  async listByTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const comments = await commentService.listByTask(ctx, req.params.taskId || req.params.id);
      res.json({ data: comments });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const comment = await commentService.create(ctx, req.params.taskId || req.params.id, req.body.body);
      res.status(201).json({ data: comment });
    } catch (err) {
      next(err);
    }
  }
}

export const commentController = new CommentController();
