import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  const envPath = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: envPath });

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL is not set in .env');
  }

  // Derive test database URL (replace /agencyhub with /agencyhub_test)
  const testDbUrl = rawUrl.replace(/\/agencyhub(\?|$)/, '/agencyhub_test$1');

  // ── Safety guard: refuse to proceed unless the target DB ends in _test ──────
  const dbName = new URL(testDbUrl.replace('mysql://', 'http://')).pathname.slice(1).split('?')[0];
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `[globalSetup] SAFETY: target database "${dbName}" does not end in "_test". ` +
        'Refusing to migrate/seed to avoid data loss on a non-test database.',
    );
  }

  process.env.DATABASE_URL = testDbUrl;

  console.log(`\n[globalSetup] Preparing test database: ${testDbUrl.replace(/:[^:@]+@/, ':***@')}`);

  // Ensure agencyhub_test database exists
  const rootClient = new PrismaClient({
    datasources: { db: { url: rawUrl } },
  });
  try {
    await rootClient.$executeRawUnsafe(
      'CREATE DATABASE IF NOT EXISTS agencyhub_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
    );
  } finally {
    await rootClient.$disconnect();
  }

  const apiDir = path.resolve(__dirname, '../..');

  // Deploy migrations to agencyhub_test
  execSync('npx prisma migrate deploy', {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });

  // Seed agencyhub_test
  execSync('npx prisma db seed', {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });

  console.log('[globalSetup] agencyhub_test database migrated and seeded successfully.\n');
}
