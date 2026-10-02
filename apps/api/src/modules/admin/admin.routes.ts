import express, { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { supportSessionController } from './supportSession.controller';
import { adminController } from './admin.controller';
import { updateAgencyStatusSchema } from './admin.schemas';

const router: express.Router = Router();

// ── All /admin routes: authenticated SUPER_ADMIN only ───────────────────────
// Note: admin routes intentionally do NOT use loadAgencyStatus — Super Admin
// has no agency scope. supportGuard is also NOT applied here (admin routes
// are exempt per TRD §4 and doc 02 §3.8).
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN));

// ── Platform stats ────────────────────────────────────────────────────────────
router.get('/stats', (req, res, next) => adminController.getStats(req, res, next));

// ── Agency management ─────────────────────────────────────────────────────────
router.get('/agencies', (req, res, next) => adminController.listAgencies(req, res, next));

router.get('/agencies/:id', (req, res, next) => adminController.getAgency(req, res, next));

router.patch(
  '/agencies/:id/status',
  validateBody(updateAgencyStatusSchema),
  (req, res, next) => adminController.updateAgencyStatus(req, res, next),
);

// ── Support session — canonical routes per doc 04 ─────────────────────────────
router.post(
  '/agencies/:id/support-session',
  (req, res, next) => supportSessionController.enter(req, res, next),
);

router.post(
  '/support-session/exit',
  (req, res, next) => supportSessionController.exit(req, res, next),
);



// ── Platform activity feed ────────────────────────────────────────────────────
router.get('/activity', (req, res, next) => adminController.getActivity(req, res, next));

export { router as adminRouter };
