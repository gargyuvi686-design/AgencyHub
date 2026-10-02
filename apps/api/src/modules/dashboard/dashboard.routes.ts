import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { UserRole } from '@prisma/client';
import { dashboardController } from './dashboard.controller';

export const dashboardRouter: Router = Router();

dashboardRouter.use(authenticate);
dashboardRouter.use(supportGuard);
dashboardRouter.use(loadAgencyStatus);
dashboardRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

// GET /dashboard — whole-agency or member-scoped stats
dashboardRouter.get('/', (req, res, next) => dashboardController.get(req, res, next));

export const myWorkRouter: Router = Router();

myWorkRouter.use(authenticate);
myWorkRouter.use(supportGuard);
myWorkRouter.use(loadAgencyStatus);
myWorkRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

// GET /my-work — tasks assigned to caller, managed projects, upcoming meetings
myWorkRouter.get('/', (req, res, next) => dashboardController.myWork(req, res, next));
