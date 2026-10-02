import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { clientController } from './client.controller';
import {
  createClientSchema,
  updateClientSchema,
  portalInviteSchema,
} from './client.schemas';

export const clientsRouter: Router = Router();

// ── Router-level middleware ───────────────────────────────────────────────────
clientsRouter.use(authenticate);
clientsRouter.use(supportGuard);
clientsRouter.use(loadAgencyStatus);

// ── Client routes ─────────────────────────────────────────────────────────────
// Agency Admins have full access. Agency Members have read access (scoped to assigned projects).
// CLIENT token callers receive 403 FORBIDDEN.

clientsRouter.post(
  '/',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(createClientSchema),
  (req, res, next) => clientController.create(req, res, next),
);

clientsRouter.get(
  '/',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => clientController.list(req, res, next),
);

clientsRouter.get(
  '/:id',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => clientController.get(req, res, next),
);

clientsRouter.patch(
  '/:id',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(updateClientSchema),
  (req, res, next) => clientController.update(req, res, next),
);

// Canonical contract endpoint per spec: POST /clients/:id/portal-users
clientsRouter.post(
  '/:id/portal-users',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(portalInviteSchema),
  (req, res, next) => clientController.inviteUser(req, res, next),
);



clientsRouter.delete(
  '/:id',
  requireRole(UserRole.AGENCY_ADMIN),
  (req, res, next) => clientController.delete(req, res, next),
);
