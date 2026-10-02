import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Load apps/api/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseDbUrl = process.env.DATABASE_URL || '';
const testDbUrl = baseDbUrl.replace(/\/agencyhub(\?|$)/, '/agencyhub_test$1');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    globalSetup: ['./src/test/globalSetup.ts'],
    env: {
      DATABASE_URL: testDbUrl,
    },
    include: ['src/**/*.test.ts'],
  },
});
