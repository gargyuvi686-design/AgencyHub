import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';
import { authRouter } from './modules/auth/auth.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { teamRouter } from './modules/team/team.routes';
import { clientsRouter } from './modules/clients/client.routes';
import { projectRouter } from './modules/projects/project.routes';
import { milestoneRouter } from './modules/milestones/milestone.routes';
import { taskRouter } from './modules/tasks/task.routes';
import { meetingRouter } from './modules/meetings/meeting.routes';
import { dashboardRouter, myWorkRouter } from './modules/dashboard/dashboard.routes';
import { portalRouter } from './modules/portal/portal.routes';
import { feedbackRouter } from './modules/feedback/feedback.routes';
import { fileRouter } from './modules/files/file.routes';

const app: Express = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — strict: only the configured frontend origin, with credentials ─────
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true, // required for httpOnly cookie forwarding
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health check (unauthenticated, used by Railway/Render probe) ─────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/portal', portalRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/team', teamRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/feedback', feedbackRouter);
apiRouter.use('/files', fileRouter);
apiRouter.use('/projects', projectRouter);
// Standalone resource routes (/milestones/:id, /tasks/:id, /meetings/:id)
apiRouter.use('/milestones', milestoneRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/meetings', meetingRouter);
// Dashboard (/dashboard) and My Work (/my-work)
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/my-work', myWorkRouter);

app.use('/api/v1', apiRouter);
logger.info('API routes mounted at /api/v1');

// ─── Central error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

export { app };
