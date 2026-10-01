import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './lib/logger';

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

// ─── API routes (mounted in Phase 1+) ────────────────────────────────────────
// Routes will be registered here as: app.use('/api/v1', router)
logger.info('Express app initialized — routes will be added in Phase 1');

// ─── Central error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

export { app };
