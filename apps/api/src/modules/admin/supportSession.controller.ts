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
   *
   * Super Admin initiates a read-only support session into an agency.
   * Issues a separate 30-min httpOnly support_token cookie.
   * Does NOT overwrite the main SUPER_ADMIN token.
   * Logs support.entered event.
   * Returns 404 if the agency does not exist.
   */
  async enter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agencyId = req.params.id || req.body?.agencyId;

      if (!agencyId) {
        throw Errors.VALIDATION('agencyId is required.');
      }

      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { id: true, name: true, slug: true, status: true },
      });

      if (!agency) {
        throw Errors.NOT_FOUND('Agency');
      }

      // Issue short-lived support token (30 minutes)
      const supportToken = signSupportToken({
        superAdminId: req.user!.userId,
        supportAgencyId: agency.id,
        supportAgencyName: agency.name,
      });

      // Set support_token cookie — does NOT replace the main session cookie
      res.cookie(
        SUPPORT_COOKIE_NAME,
        supportToken,
        getCookieOptions(30 * 60 * 1000), // 30 minutes
      );

      // Audit log
      await prisma.activityLog.create({
        data: {
          agencyId: agency.id,
          actorType: ActorType.SUPER_ADMIN,
          actorId: req.user!.userId,
          eventType: 'support.entered',
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
          agency: {
            id: agency.id,
            name: agency.name,
            slug: agency.slug,
            status: agency.status,
          },
          expiresInSeconds: 30 * 60,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/support-session/exit
   *
   * Clears the support_token cookie. Works even while support token is active
   * (the main SUPER_ADMIN token remains valid throughout).
   * Logs support.exited event.
   */
  async exit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supportAgencyId = req.support?.supportAgencyId;

      res.clearCookie(SUPPORT_COOKIE_NAME, { path: '/' });

      // Audit log if a support session was actually active
      if (supportAgencyId) {
        await prisma.activityLog.create({
          data: {
            agencyId: supportAgencyId,
            actorType: ActorType.SUPER_ADMIN,
            actorId: req.user!.userId,
            eventType: 'support.exited',
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
