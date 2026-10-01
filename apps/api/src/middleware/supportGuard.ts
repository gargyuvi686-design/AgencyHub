import { Request, Response, NextFunction } from 'express';
import { Errors } from '../lib/errors';

/**
 * Support Guard middleware:
 * If the caller is a Super Admin operating in Support Mode (req.support is set),
 * blocks any mutation methods (POST, PUT, PATCH, DELETE) with 403 SUPPORT_MODE_READ_ONLY.
 */
export function supportGuard(req: Request, _res: Response, next: NextFunction): void {
  if (req.support) {
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
    if (!isSafeMethod) {
      throw Errors.SUPPORT_READ_ONLY();
    }
  }
  next();
}
