import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { teamController } from './team.controller';
import { inviteSchema, updateTeamMemberSchema } from './team.schemas';

export const teamRouter: Router = Router();

// ── Router-level middleware ───────────────────────────────────────────────────
teamRouter.use(authenticate);
teamRouter.use(supportGuard);
teamRouter.use(loadAgencyStatus);

// ── Team routes — AGENCY_ADMIN only ──────────────────────────────────────────
// Members calling /team → 403 (requireRole enforces this)

const inviteHandler = (req: any, res: any, next: any) => teamController.invite(req, res, next);

teamRouter.post(
  ['/invite', '/invites'],
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(inviteSchema),
  inviteHandler,
);

teamRouter.get(
  '/',
  requireRole(UserRole.AGENCY_ADMIN),
  (req, res, next) => teamController.list(req, res, next),
);

teamRouter.patch(
  '/:userId',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(updateTeamMemberSchema),
  (req, res, next) => teamController.update(req, res, next),
);

teamRouter.delete(
  '/:userId',
  requireRole(UserRole.AGENCY_ADMIN),
  (req, res, next) => teamController.deactivate(req, res, next),
);
