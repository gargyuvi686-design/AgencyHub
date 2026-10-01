import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Must be long and random — validated at startup so we fail early
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  COOKIE_DOMAIN: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  UPLOAD_DIR: z.string().default('./uploads'),

  // AI is optional — missing key → 503 response, not a crash
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
