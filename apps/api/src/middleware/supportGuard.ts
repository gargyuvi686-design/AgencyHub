import { Request, Response, NextFunction } from 'express';
import { Errors } from '../lib/errors';

/**
 * Support Guard — enforces support-mode constraints on AGENCY WORKSPACE routes.
 *
 * Must be mounted at ROUTER level (before route matching) on workspace routers
 * so it fires for all routes in that router, including non-existent ones.
 *
 * Rules (doc 02 §3.8, §4):
 *   1. SUPER_ADMIN without a support claim on a workspace route → 403 FORBIDDEN.
 *      (Super Admins are not agency users; they may only access workspace routes
 *       in support mode.)
 *   2. SUPER_ADMIN WITH a valid support claim:
 *      a. Only GET / HEAD requests are allowed → anything else → 403 SUPPORT_READ_ONLY.
 *      b. The agencyId context (req.effectiveAgencyId) is ALWAYS set from the support
 *         token's supportAgencyId, never from the request body or URL.
 *         (This is set by the authenticate middleware; supportGuard just enforces it.)
 *   3. Non-SUPER_ADMIN users are not affected by this guard; they proceed normally.
 *
 * Suspended agency inspection: allowed for Super Admin in support mode (GET only).
 * loadAgencyStatus must still be chained AFTER this guard; it already exempts SUPER_ADMIN.
 */
export function supportGuard(req: Request, _res: Response, next: NextFunction): void {
  // Only applies to Super Admin; other roles pass through
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return next();
  }

  // SUPER_ADMIN without a support claim on a workspace route → 403
  if (!req.support) {
    throw Errors.FORBIDDEN(
      'Super Admin must enter support mode to access agency workspace routes.',
    );
  }

  // Support mode is read-only (doc 02 §3.8): only GET, HEAD, OPTIONS allowed
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (!isSafeMethod) {
    throw Errors.SUPPORT_READ_ONLY();
  }

  // Set effective agency ID to the supported agency's ID on workspace routes
  req.effectiveAgencyId = req.support.supportAgencyId;

  // At this point: Super Admin, valid support claim, safe method — proceed
  next();
}
