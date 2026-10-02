import { Request, Response, NextFunction } from 'express';
import { DashboardRepository } from './dashboard.repository';
import { Errors } from '../../lib/errors';

class DashboardController {
  /**
   * GET /dashboard
   * AGENCY_ADMIN: whole-agency stats.
   * AGENCY_MEMBER: stats scoped to their assigned/managed projects.
   * Super Admin in support mode: treated as AGENCY_ADMIN of the target agency.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, role } = req.user!;
      const agencyId = req.effectiveAgencyId ?? req.user!.agencyId;

      if (!agencyId) {
        throw Errors.FORBIDDEN('No agency context.');
      }

      // Support mode: treat as admin-level view of the target agency
      const effectiveRole = req.support ? 'AGENCY_ADMIN' : role;

      const repo = new DashboardRepository(agencyId);
      const stats = await repo.getAgencyDashboard(userId, effectiveRole);

      res.json({ data: stats });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /my-work
   * Returns tasks assigned to the caller, projects they manage, and upcoming meetings.
   */
  async myWork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user!;
      const agencyId = req.effectiveAgencyId ?? req.user!.agencyId;

      if (!agencyId) {
        throw Errors.FORBIDDEN('No agency context.');
      }

      const repo = new DashboardRepository(agencyId);
      const data = await repo.getMyWork(userId);

      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
