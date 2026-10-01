import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/errors';
import { AgencyStatus } from '@prisma/client';

/**
 * Loads the current agency status for any tenant/workspace route.
 * If the agency is SUSPENDED, blocks the request with 403:
 * "This agency account is suspended."
 *
 * Super admins managing agencies in /admin are unscoped and bypass this.
 */
export async function loadAgencyStatus(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const agencyId = req.effectiveAgencyId || req.user?.agencyId;

    if (!agencyId) {
      // Super admin outside of support mode or user without agency
      return next();
    }

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
      },
    });

    if (!agency) {
      throw Errors.NOT_FOUND('Agency');
    }

    // If suspended, block tenant users
    if (agency.status === AgencyStatus.SUSPENDED) {
      // Allow Super Admin in support mode to view (read-only), but block agency users
      if (req.user?.role !== 'SUPER_ADMIN') {
        throw Errors.SUSPENDED();
      }
    }

    req.agency = {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      status: agency.status,
      plan: agency.plan,
    };

    next();
  } catch (err) {
    next(err);
  }
}
