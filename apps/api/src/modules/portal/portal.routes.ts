import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { portalController } from './portal.controller';

export const portalRouter: ReturnType<typeof Router> = Router();

portalRouter.use(authenticate);
portalRouter.use(loadAgencyStatus);
portalRouter.use(requireRole(UserRole.CLIENT));

portalRouter.get('/clients/:id', (req, res, next) => portalController.getClient(req, res, next));
portalRouter.get('/overview', (req, res, next) => portalController.overview(req, res, next));
portalRouter.get('/projects', (req, res, next) => portalController.listProjects(req, res, next));
portalRouter.get('/projects/:id', (req, res, next) => portalController.getProject(req, res, next));
portalRouter.get('/projects/:id/meetings', (req, res, next) => portalController.listMeetings(req, res, next));
