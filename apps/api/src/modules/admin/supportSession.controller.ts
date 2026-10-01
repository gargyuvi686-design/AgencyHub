import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import {
  SUPPORT_COOKIE_NAME,
  signSupportToken,
  getCookieOptions,
} from '../../lib/jwt';
import { ActorType } from '@prisma/client';

export class SupportSessionController {
  /**
   * POST /api/v1/admin/agencies/:id/support-session
   * Super Admin initiates a read-only support session into an agency.
   */
  async enter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agencyId = req.params.id;

      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { id: true, name: true, slug: true, status: true },
      });

      if (!agency) {
        throw Errors.NOT_FOUND('Agency');
      }

      // Generate short-lived support token (2 hours)
      const supportToken = signSupportToken({
        superAdminId: req.user!.userId,
        supportAgencyId: agency.id,
        supportAgencyName: agency.name,
      });

      // Set support_token cookie (does not overwrite main session token)
      res.cookie(
        SUPPORT_COOKIE_NAME,
        supportToken,
        getCookieOptions(2 * 60 * 60 * 1000), // 2 hours
      );

      // Audit log the support session entry
      await prisma.activityLog.create({
        data: {
          agencyId: agency.id,
          actorType: ActorType.SUPER_ADMIN,
          actorId: req.user!.userId,
          eventType: 'admin.support_session_started',
          entityType: 'agency',
          entityId: agency.id,
          visibleToClient: false,
          metadata: {
            superAdminEmail: req.user!.email,
            agencyName: agency.name,
          },
        },
      });

      res.json({
        data: {
          message: `Support mode entered for ${agency.name}`,
          agency,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/support-session/exit
   * Clears the support_token cookie and returns to normal Super Admin scope.
   */
  async exit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supportAgencyId = req.support?.supportAgencyId;

      res.clearCookie(SUPPORT_COOKIE_NAME, { path: '/' });

      // Audit log the support session exit if active
      if (supportAgencyId) {
        await prisma.activityLog.create({
          data: {
            agencyId: supportAgencyId,
            actorType: ActorType.SUPER_ADMIN,
            actorId: req.user!.userId,
            eventType: 'admin.support_session_exited',
            entityType: 'agency',
            entityId: supportAgencyId,
            visibleToClient: false,
            metadata: {
              superAdminEmail: req.user!.email,
            },
          },
        });
      }

      res.json({
        data: {
          message: 'Support mode exited successfully',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const supportSessionController = new SupportSessionController();
