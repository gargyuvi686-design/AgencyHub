import { Request, Response, NextFunction } from 'express';
import { adminRepository } from './admin.repository';
import {
  agencyListQuerySchema,
  updateAgencyStatusSchema,
  activityQuerySchema,
} from './admin.schemas';

export class AdminController {
  /**
   * GET /api/v1/admin/stats
   * Platform-wide aggregate statistics. No N+1 queries.
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminRepository.getPlatformStats();
      res.json({ data: stats });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/agencies
   * Paginated agency list with user/client/project counts.
   */
  async listAgencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = agencyListQuerySchema.parse(req.query);
      const result = await adminRepository.listAgencies(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/agencies/:id
   * Agency details + stats. 404 if missing.
   */
  async getAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agency = await adminRepository.getAgencyById(req.params.id);
      res.json({ data: agency });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/agencies/:id/status
   * Suspend or reactivate an agency.
   * Logs agency.suspended or agency.activated event.
   */
  async updateAgencyStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = updateAgencyStatusSchema.parse(req.body);
      const updated = await adminRepository.updateAgencyStatus(
        req.params.id,
        req.user!.userId,
        req.user!.email,
        input.status,
        input.reason,
      );
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/activity
   * Platform-wide activity feed.
   */
  async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = activityQuerySchema.parse(req.query);
      const feed = await adminRepository.getPlatformActivity(query);
      res.json(feed);
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
