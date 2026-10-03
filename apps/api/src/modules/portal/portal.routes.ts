import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { portalController } from './portal.controller';
import { feedbackController } from '../feedback/feedback.controller';
import { createFeedbackCommentSchema, createFeedbackSchema } from '../feedback/feedback.schemas';
import { validateBody } from '../../middleware/validate';
import { fileController } from '../files/file.controller';
import { milestoneController } from '../milestones/milestone.controller';
import { approveMilestoneSchema } from '../milestones/milestone.schemas';

export const portalRouter: ReturnType<typeof Router> = Router();

portalRouter.use(authenticate);
portalRouter.use(loadAgencyStatus);
portalRouter.use(requireRole(UserRole.CLIENT));

portalRouter.get('/clients/:id', (req, res, next) => portalController.getClient(req, res, next));
portalRouter.get('/overview', (req, res, next) => portalController.overview(req, res, next));
portalRouter.get('/projects', (req, res, next) => portalController.listProjects(req, res, next));
portalRouter.get('/feedback', (req, res, next) => feedbackController.listPortal(req, res, next));
portalRouter.get('/projects/:id', (req, res, next) => portalController.getProject(req, res, next));
portalRouter.get('/projects/:id/milestones', (req, res, next) => milestoneController.listPortal(req, res, next));
portalRouter.post('/milestones/:id/approve', validateBody(approveMilestoneSchema), (req, res, next) => milestoneController.approvePortal(req, res, next));
portalRouter.get('/projects/:id/meetings', (req, res, next) => portalController.listMeetings(req, res, next));
portalRouter.get('/projects/:id/files', (req, res, next) => fileController.listPortal(req, res, next));
portalRouter.get('/files/:id/download', (req, res, next) => fileController.downloadPortal(req, res, next));
portalRouter.get('/projects/:id/feedback', (req, res, next) => feedbackController.listForProject(req, res, next));
portalRouter.post('/projects/:id/feedback', validateBody(createFeedbackSchema), (req, res, next) => feedbackController.submit(req, res, next));
portalRouter.get('/feedback/:id/comments', (req, res, next) => feedbackController.listComments(req, res, next));
portalRouter.post('/feedback/:id/comments', validateBody(createFeedbackCommentSchema), (req, res, next) => feedbackController.addComment(req, res, next));
