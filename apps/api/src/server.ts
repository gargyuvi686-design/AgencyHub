import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

async function main() {
  // Verify DB connectivity before accepting traffic
  await prisma.$connect();
  logger.info('Database connected');

  app.listen(env.PORT, () => {
    logger.info(`AgencyHub API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
