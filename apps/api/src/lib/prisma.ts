import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Raw Prisma client — only accessible from:
 *   1. scopedPrisma.ts (wraps it in the tenant-scoping extension)
 *   2. prisma/seed.ts
 *   3. Admin-only repositories (PlatformActivityRepo, AdminAgencyRepo)
 *
 * Controllers and business services NEVER import this directly.
 */
export const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
});

if (env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Prisma query');
  });
}

prisma.$on('warn', (e) => logger.warn(e, 'Prisma warning'));
prisma.$on('error', (e) => logger.error(e, 'Prisma error'));

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
});
