/**
 * AppError — the single error class used throughout the API.
 *
 * Controllers throw AppError; errorHandler middleware catches it and formats
 * the response as { error: { code, message } }. Never throw raw Error objects
 * in business logic — always use the Errors factory below.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    // Preserve prototype chain in transpiled TS
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Errors factory — centralised, named error constructors.
 *
 * Security note: 404 is intentionally used for "not found OR not yours" to
 * avoid leaking the existence of resources across tenant boundaries.
 */
export const Errors = {
  BAD_REQUEST: (msg = 'Bad request.') =>
    new AppError('BAD_REQUEST', 400, msg),

  UNAUTHORIZED: () =>
    new AppError('UNAUTHORIZED', 401, 'Authentication required.'),

  FORBIDDEN: (msg = 'Access denied.') =>
    new AppError('FORBIDDEN', 403, msg),

  /**
   * Use this for cross-tenant ID mismatches — never 403, which would leak
   * that the resource exists but belongs to another tenant.
   */
  NOT_FOUND: (resource = 'Resource') =>
    new AppError('NOT_FOUND', 404, `${resource} not found.`),

  VALIDATION: (msg: string) =>
    new AppError('VALIDATION_ERROR', 422, msg),

  CONFLICT: (msg: string) =>
    new AppError('CONFLICT', 409, msg),

  /** Suspended agency — used on login and per-request middleware check */
  SUSPENDED: () =>
    new AppError('AGENCY_SUSPENDED', 403, 'This agency account is suspended.'),

  /**
   * Support mode guard — returned when support-mode token tries to mutate
   */
  SUPPORT_READ_ONLY: () =>
    new AppError('SUPPORT_READ_ONLY', 403, 'Support mode is read-only.'),

  AI_NOT_CONFIGURED: () =>
    new AppError(
      'AI_NOT_CONFIGURED',
      503,
      'AI features are not configured on this server. Set ANTHROPIC_API_KEY.',
    ),

  AI_ERROR: (msg = 'AI service failed. Please try again.') =>
    new AppError('AI_ERROR', 502, msg),

  INTERNAL: () =>
    new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.'),
};
