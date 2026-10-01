import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { Errors } from '../lib/errors';

/**
 * Require one or more specific roles.
 * Supports Super Admin operating in Support Mode on workspace routes.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw Errors.UNAUTHORIZED();
    }

    // Direct match
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Super Admin in Support Mode may access workspace routes (AGENCY_ADMIN / AGENCY_MEMBER)
    if (req.user.role === 'SUPER_ADMIN' && req.support) {
      const isWorkspaceRoleAllowed =
        allowedRoles.includes(UserRole.AGENCY_ADMIN) ||
        allowedRoles.includes(UserRole.AGENCY_MEMBER);

      if (isWorkspaceRoleAllowed) {
        return next();
      }
    }

    // Otherwise forbidden
    throw Errors.FORBIDDEN('You do not have permission to access this resource.');
  };
}
