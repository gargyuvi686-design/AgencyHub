import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

/**
 * Central error handler — the only place that writes error responses.
 * Must be registered as the LAST middleware in app.ts.
 *
 * Response shape (always):
 *   { error: { code: string, message: string, details?: unknown } }
 *
 * Stack traces are NEVER included in production responses.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Known application error — structured, safe to expose
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Zod validation failure — include field-level details
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      },
    });
    return;
  }

  // Unknown error — log full details server-side, return generic message to client
  logger.error(err, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      // Only include stack in development for local debugging
      ...(env.NODE_ENV === 'development' && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
}
