import { Request, Response, NextFunction } from 'express';
import { activityService } from './activity.service';
import type { ServiceContext } from './activity.service';
import { Errors } from '../../lib/errors';

function buildContext(req: Request): ServiceContext {
  return {
    userId: req.user!.userId,
    role: req.user!.role,
    agencyId: req.effectiveAgencyId ?? req.user!.agencyId ?? null,
    clientId: req.user!.clientId ?? null,
  };
}

class ActivityController {
  /**
   * GET /projects/:id/activity
   */
  async listForProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      if (!ctx.agencyId) throw Errors.UNAUTHORIZED();

      const result = await activityService.listForProject(ctx, req.params.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /clients/:id/activity
   */
  async listForClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      if (!ctx.agencyId) throw Errors.UNAUTHORIZED();

      const result = await activityService.listForClient(ctx, req.params.id, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const activityController = new ActivityController();
