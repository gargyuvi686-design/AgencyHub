import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  AUTH_COOKIE_NAME,
  SUPPORT_COOKIE_NAME,
  getCookieOptions,
} from '../../lib/jwt';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, agency, token } = await authService.login(req.body);

      // Set 7-day httpOnly session cookie
      res.cookie(
        AUTH_COOKIE_NAME,
        token,
        getCookieOptions(7 * 24 * 60 * 60 * 1000),
      );

      res.json({
        data: {
          user,
          agency,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      res.clearCookie(SUPPORT_COOKIE_NAME, { path: '/' });

      res.json({
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await authService.getMe(req.user!.userId, req.support);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/register-agency
   */
  async registerAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, agency, token } = await authService.registerAgency(req.body);

      res.cookie(
        AUTH_COOKIE_NAME,
        token,
        getCookieOptions(7 * 24 * 60 * 60 * 1000),
      );

      res.status(201).json({
        data: {
          user,
          agency,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/accept-invite
   */
  async acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await authService.acceptInvite(req.body);

      res.cookie(
        AUTH_COOKIE_NAME,
        token,
        getCookieOptions(7 * 24 * 60 * 60 * 1000),
      );

      res.json({
        data: {
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
