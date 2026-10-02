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
import { milestoneController } from '../milestones/milestone.controller';
import { createMilestoneSchema } from '../milestones/milestone.schemas';
import { taskController } from '../tasks/task.controller';
import { createTaskSchema } from '../tasks/task.schemas';
import { meetingController } from '../meetings/meeting.controller';
import { createMeetingSchema } from '../meetings/meeting.schemas';
import { activityController } from '../activity/activity.controller';

export const projectRouter: Router = Router();

// ── Router-level middleware ───────────────────────────────────────────────────
projectRouter.use(authenticate);
projectRouter.use(supportGuard);
projectRouter.use(loadAgencyStatus);

// ── Project CRUD ──────────────────────────────────────────────────────────────

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

// Canonical contract endpoint: PUT /projects/:id/members (transactional full replace)
projectRouter.put(
  '/:id/members',
  requireRole(UserRole.AGENCY_ADMIN),
  validateBody(setProjectMembersSchema),
  (req, res, next) => projectController.setMembers(req, res, next),
);

// ── Milestones sub-routes (/projects/:id/milestones) ─────────────────────────
projectRouter.get(
  '/:id/milestones',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => milestoneController.listByProject(req, res, next),
);

projectRouter.post(
  '/:id/milestones',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  validateBody(createMilestoneSchema),
  (req, res, next) => milestoneController.create(req, res, next),
);

// ── Tasks sub-routes (/projects/:id/tasks) ────────────────────────────────────
projectRouter.get(
  '/:id/tasks',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => taskController.listForProject(req, res, next),
);

projectRouter.post(
  '/:id/tasks',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  validateBody(createTaskSchema),
  (req, res, next) => taskController.create(req, res, next),
);

// ── Meetings sub-routes (/projects/:id/meetings) ──────────────────────────────
projectRouter.get(
  '/:id/meetings',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => meetingController.listByProject(req, res, next),
);

projectRouter.post(
  '/:id/meetings',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  validateBody(createMeetingSchema),
  (req, res, next) => meetingController.create(req, res, next),
);

// ── Activity sub-route (/projects/:id/activity) ───────────────────────────────
projectRouter.get(
  '/:id/activity',
  requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER),
  (req, res, next) => activityController.listForProject(req, res, next),
);
