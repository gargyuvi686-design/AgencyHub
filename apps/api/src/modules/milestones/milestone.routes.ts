import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { milestoneController } from './milestone.controller';
import { updateMilestoneSchema } from './milestone.schemas';

export const milestoneRouter: Router = Router();

milestoneRouter.use(authenticate);
milestoneRouter.use(supportGuard);
milestoneRouter.use(loadAgencyStatus);

// All milestone routes restricted to AGENCY_ADMIN and AGENCY_MEMBER (Scenario 4 blocks CLIENT with 403)
milestoneRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

milestoneRouter.get('/:id', (req, res, next) => milestoneController.get(req, res, next));

milestoneRouter.patch(
  '/:id',
  validateBody(updateMilestoneSchema),
  (req, res, next) => milestoneController.update(req, res, next),
);

milestoneRouter.delete('/:id', (req, res, next) => milestoneController.delete(req, res, next));
