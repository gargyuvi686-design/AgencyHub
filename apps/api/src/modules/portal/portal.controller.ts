import { Request, Response, NextFunction } from 'express';
import { portalService } from './portal.service';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';

function buildContext(req: Request): ServiceContext {
  if (!req.user || !req.user.clientId || !req.effectiveAgencyId) {
    throw Errors.FORBIDDEN('Client portal users must be linked to a client account.');
  }

  return {
    userId: req.user.userId,
    role: req.user.role,
    agencyId: req.effectiveAgencyId,
    clientId: req.user.clientId,
  };
}

export class PortalController {
  async getClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const result = await portalService.getClient(ctx, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async overview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const result = await portalService.getOverview(ctx);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const result = await portalService.listProjects(ctx);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const result = await portalService.getProject(ctx, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async listMeetings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = buildContext(req);
      const result = await portalService.listMeetings(ctx, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const portalController = new PortalController();
