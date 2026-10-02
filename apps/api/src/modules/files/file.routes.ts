import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { fileController } from './file.controller';
import { updateFileVisibilitySchema } from './file.schemas';
import { validateBody } from '../../middleware/validate';

export const fileRouter: Router = Router();

fileRouter.use(authenticate);
fileRouter.use(supportGuard);
fileRouter.use(loadAgencyStatus);
fileRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

fileRouter.get('/:id/download', (req, res, next) => fileController.downloadWorkspace(req, res, next));
fileRouter.patch('/:id', validateBody(updateFileVisibilitySchema), (req, res, next) => fileController.updateVisibility(req, res, next));
fileRouter.delete('/:id', (req, res, next) => fileController.delete(req, res, next));