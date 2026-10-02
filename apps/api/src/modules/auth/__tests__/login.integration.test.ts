/**
 * Integration tests: POST /api/v1/auth/login
 *
 * Runs against the agencyhub_test database (configured via vitest.config.ts).
 * Fails if the database is unreachable or seed data is missing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';

const ACTIVE_ADMIN_EMAIL = 'admin@acme.test';
const SUSPENDED_ADMIN_EMAIL = 'admin@suspended.test';
const DEMO_PASSWORD = 'Password123!';
const WRONG_PASSWORD = 'WrongPassword999';

describe('POST /api/v1/auth/login (integration)', () => {
  beforeAll(async () => {
    // Assert seed data is present in the test database; fails if DB unreachable
    const user = await prisma.user.findUnique({ where: { email: ACTIVE_ADMIN_EMAIL } });
    if (!user) {
      throw new Error(`Seed data missing in test database for ${ACTIVE_ADMIN_EMAIL}`);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('✅ login success — returns 200, user data, and sets token cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ACTIVE_ADMIN_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    // Response shape
    expect(res.body.data).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(ACTIVE_ADMIN_EMAIL);
    expect(res.body.data.user.role).toBe('AGENCY_ADMIN');
    expect(res.body.data.user.agencyId).toBeTruthy();

    // Password hash must NOT be exposed
    expect(res.body.data.user.passwordHash).toBeUndefined();

    // Agency info returned
    expect(res.body.data.agency).toBeDefined();
    expect(res.body.data.agency.status).toBe('ACTIVE');

    // httpOnly token cookie is set
    const setCookieHeader = res.headers['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    const tokenCookie = (Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader])
      .find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie).toContain('HttpOnly');
    expect(tokenCookie).toContain('Path=/');
  });

  it('❌ wrong password — returns 401 with generic error (no email enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ACTIVE_ADMIN_EMAIL, password: WRONG_PASSWORD })
      .expect(401);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    // Generic message — does NOT say "wrong password" or reveal the account exists
    expect(res.body.error.message).not.toContain('password');
    expect(res.body.error.message).not.toContain('exist');
    expect(res.body.data).toBeUndefined();

    // No token cookie set
    const setCookieHeader = res.headers['set-cookie'];
    const hasToken = (Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader])
      .some((c: string) => c?.startsWith('token='));
    expect(hasToken).toBe(false);
  });

  it('❌ unknown email — returns 401, same shape as wrong password (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nosuchuser@notexist.test', password: DEMO_PASSWORD })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('❌ suspended agency user login — returns 403 AGENCY_SUSPENDED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: SUSPENDED_ADMIN_EMAIL, password: DEMO_PASSWORD })
      .expect(403);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('AGENCY_SUSPENDED');
    expect(res.body.error.message).toContain('suspended');

    // No token cookie for suspended user
    const setCookieHeader = res.headers['set-cookie'];
    const hasToken = (Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader])
      .some((c: string) => c?.startsWith('token='));
    expect(hasToken).toBe(false);
  });

  it('❌ invalid email format — returns 422 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'notanemail', password: DEMO_PASSWORD })
      .expect(422);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('❌ missing password — returns 422 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ACTIVE_ADMIN_EMAIL })
      .expect(422);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
