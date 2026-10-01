import express, { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { UserRole } from '@prisma/client';
import { supportSessionController } from './supportSession.controller';

const router: express.Router = Router();

// All /admin routes strictly require authenticated SUPER_ADMIN
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN));

// Support session management
router.post(
  '/agencies/:id/support-session',
  (req, res, next) => supportSessionController.enter(req, res, next),
);

router.post(
  '/support-session/exit',
  (req, res, next) => supportSessionController.exit(req, res, next),
);

export { router as adminRouter };
