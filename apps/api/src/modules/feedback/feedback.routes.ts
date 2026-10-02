import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { feedbackController } from './feedback.controller';

export const feedbackRouter: Router = Router();

feedbackRouter.use(authenticate);
feedbackRouter.use(supportGuard);
feedbackRouter.use(loadAgencyStatus);
feedbackRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

feedbackRouter.patch('/:id', (req, res, next) => feedbackController.updateStatus(req, res, next));
feedbackRouter.get('/:id/comments', (req, res, next) => feedbackController.listComments(req, res, next));
feedbackRouter.post('/:id/comments', (req, res, next) => feedbackController.addComment(req, res, next));