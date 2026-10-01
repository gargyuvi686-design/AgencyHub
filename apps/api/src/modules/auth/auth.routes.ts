import express, { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import {
  loginSchema,
  registerAgencySchema,
  acceptInviteSchema,
} from './auth.schemas';

const router: express.Router = Router();

// Public auth routes (rate limited)
router.post('/login', authLimiter, validateBody(loginSchema), (req, res, next) =>
  authController.login(req, res, next),
);

router.post(
  '/register-agency',
  authLimiter,
  validateBody(registerAgencySchema),
  (req, res, next) => authController.registerAgency(req, res, next),
);

router.post(
  '/accept-invite',
  authLimiter,
  validateBody(acceptInviteSchema),
  (req, res, next) => authController.acceptInvite(req, res, next),
);

// Session routes
router.post('/logout', (req, res, next) => authController.logout(req, res, next));

router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next),
);

export { router as authRouter };
