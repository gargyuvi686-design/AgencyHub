import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { taskController } from './task.controller';
import { updateTaskSchema } from './task.schemas';
import { commentController } from '../comments/comment.controller';
import { createCommentSchema } from '../comments/comment.schemas';

export const taskRouter: Router = Router();

taskRouter.use(authenticate);
taskRouter.use(supportGuard);
taskRouter.use(loadAgencyStatus);

// All task routes restricted to AGENCY_ADMIN and AGENCY_MEMBER (Scenario 4 blocks CLIENT with 403)
taskRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

taskRouter.get('/:id', (req, res, next) => taskController.get(req, res, next));

taskRouter.patch(
  '/:id',
  validateBody(updateTaskSchema),
  (req, res, next) => taskController.update(req, res, next),
);

taskRouter.delete('/:id', (req, res, next) => taskController.delete(req, res, next));

// ── Comments on tasks ─────────────────────────────────────────────────────────
taskRouter.get('/:id/comments', (req, res, next) => commentController.listByTask(req, res, next));

taskRouter.post(
  '/:id/comments',
  validateBody(createCommentSchema),
  (req, res, next) => commentController.create(req, res, next),
);
