import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { activityController } from './activity.controller';

export const activityRouter: Router = Router();

activityRouter.use(authenticate, supportGuard, loadAgencyStatus);
activityRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));
activityRouter.get('/', (req, res, next) => activityController.listForAgency(req, res, next));