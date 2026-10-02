import { Request, Response, NextFunction } from 'express';
import { clientService } from './client.service';
import {
  createClientSchema,
  updateClientSchema,
  clientListQuerySchema,
  portalInviteSchema,
} from './client.schemas';
import { Errors } from '../../lib/errors';
import type { ServiceContext } from '../activity/activity.service';

function getCtx(req: Request): ServiceContext {
  if (!req.user || !req.effectiveAgencyId) throw Errors.UNAUTHORIZED();
  return {
    userId: req.user.userId,
    role: req.user.role,
    agencyId: req.effectiveAgencyId,
    clientId: req.user.clientId,
  };
}

export class ClientController {
  /**
   * POST /clients — Create a new client.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = createClientSchema.parse(req.body);
      const client = await clientService.create(ctx, input);
      res.status(201).json({ data: client });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /clients — List clients with search, pagination, and active project counts.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const query = clientListQuerySchema.parse(req.query);
      const result = await clientService.list(ctx, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /clients/:id — Client detail + projects + stats.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const client = await clientService.get(ctx, req.params.id);
      res.json({ data: client });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /clients/:id — Update client details.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = updateClientSchema.parse(req.body);
      const client = await clientService.update(ctx, req.params.id, input);
      res.json({ data: client });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /clients/:id/invite-user — Invite client user to portal.
   */
  async inviteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      const input = portalInviteSchema.parse(req.body);
      const result = await clientService.inviteUser(ctx, req.params.id, input);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /clients/:id — Delete client.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getCtx(req);
      await clientService.delete(ctx, req.params.id);
      res.json({ data: { message: 'Client deleted successfully.' } });
    } catch (err) {
      next(err);
    }
  }
}

export const clientController = new ClientController();
