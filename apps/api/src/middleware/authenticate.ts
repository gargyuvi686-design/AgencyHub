import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/errors';
import {
  AUTH_COOKIE_NAME,
  SUPPORT_COOKIE_NAME,
  verifyAuthToken,
  verifySupportToken,
} from '../lib/jwt';
import { logger } from '../lib/logger';

/**
 * Authenticate middleware:
 * 1. Verifies the primary JWT from httpOnly cookie or Authorization Bearer header.
 * 2. Fetches user from DB to ensure user is active and data is current.
 * 3. For SUPER_ADMIN on workspace/tenant routes: inspects support_token cookie.
 *    If present, sets req.support and req.effectiveAgencyId.
 *    (Admin routes explicitly ignore support_token so Super Admin stays Super Admin in /admin).
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract token from cookie or Authorization header
    let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      throw Errors.UNAUTHORIZED();
    }

    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      throw Errors.UNAUTHORIZED();
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        agencyId: true,
        clientId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw Errors.UNAUTHORIZED();
    }

    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      agencyId: user.agencyId,
      clientId: user.clientId,
    };

    // Default effective agency ID is user's own agencyId
    if (user.agencyId) {
      req.effectiveAgencyId = user.agencyId;
    }

    // Support mode processing: ONLY for SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN') {
      const supportToken = req.cookies?.[SUPPORT_COOKIE_NAME];
      if (supportToken) {
        try {
          const supportPayload = verifySupportToken(supportToken);
          // Verify that this support token was indeed issued for this Super Admin
          if (supportPayload.superAdminId === user.id && supportPayload.supportAgencyId) {
            req.support = {
              superAdminId: supportPayload.superAdminId,
              supportAgencyId: supportPayload.supportAgencyId,
              supportAgencyName: supportPayload.supportAgencyName,
            };

            // Admin routes ignore support scoping; workspace routes adopt supportAgencyId
            const isAdminRoute =
              req.originalUrl.includes('/api/v1/admin') ||
              req.path.startsWith('/admin');

            if (!isAdminRoute) {
              req.effectiveAgencyId = supportPayload.supportAgencyId;
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Invalid support token encountered; ignoring');
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
