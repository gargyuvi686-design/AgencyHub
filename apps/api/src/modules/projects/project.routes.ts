import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { projectController } from './project.controller';
import {
  createProjectSchema,
  updateProjectSchema,
  setProjectMembersSchema,
} from './project.schemas';

export const projectRouter: Router = Router();

// ── Router-level middleware ───────────────────────────────────────────────────
projectRouter.use(authenticate);
projectRouter.use(supportGuard);
projectRouter.use(loadAgencyStatus);

// ── Project routes ────────────────────────────────────────────────────────────

// Create project — Agency Admin only
projectRouter.post(
  '/',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(createProjectSchema),
  (req, res, next) => projectController.create(req, res, next),
);

// List projects — Agency Admin, Member (own projects), Super Admin (support mode)
// CLIENT token callers receive 403 FORBIDDEN (Scenario 4)
projectRouter.get(
  '/',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => projectController.list(req, res, next),
);

// Get single project — Matrix access control handled in service
// CLIENT token callers receive 403 FORBIDDEN (Scenario 4)
projectRouter.get(
  '/:id',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => projectController.get(req, res, next),
);

// Update project — Agency Admin only
projectRouter.patch(
  '/:id',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(updateProjectSchema),
  (req, res, next) => projectController.update(req, res, next),
);

// Delete project — Agency Admin only
projectRouter.delete(
  '/:id',
  requireRole(UserRole.AGENCY_ADMIN),
  (req, res, next) => projectController.delete(req, res, next),
);

// Canonical contract endpoint: PUT /projects/:id/members (replaces full member set)
projectRouter.put(
  '/:id/members',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(setProjectMembersSchema),
  (req, res, next) => projectController.setMembers(req, res, next),
);


