import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadAgencyStatus } from '../../middleware/agencyStatus';
import { requireRole } from '../../middleware/requireRole';
import { supportGuard } from '../../middleware/supportGuard';
import { validateBody } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import { meetingController } from './meeting.controller';
import { updateMeetingSchema } from './meeting.schemas';
import rateLimit from 'express-rate-limit';
import { meetingAiController } from './meeting-ai.controller';

const aiSummaryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.effectiveAgencyId ?? req.user?.agencyId ?? 'no-agency',
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'AI summary limit reached for this agency. Try again later.' },
    });
  },
});

export const meetingRouter: Router = Router();

meetingRouter.use(authenticate);
meetingRouter.use(supportGuard);
meetingRouter.use(loadAgencyStatus);

// All meeting routes restricted to AGENCY_ADMIN and AGENCY_MEMBER (Scenario 4 blocks CLIENT with 403)
meetingRouter.use(requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER));

meetingRouter.post('/:id/ai-summary', aiSummaryLimiter, (req, res, next) => meetingAiController.summarize(req, res, next));
meetingRouter.post('/:id/ai-summary/create-tasks', (req, res, next) => meetingAiController.createSelectedTasks(req, res, next));

meetingRouter.get('/:id', (req, res, next) => meetingController.get(req, res, next));

meetingRouter.patch(
  '/:id',
  validateBody(updateMeetingSchema),
  (req, res, next) => meetingController.update(req, res, next),
);

meetingRouter.delete('/:id', (req, res, next) => meetingController.delete(req, res, next));
