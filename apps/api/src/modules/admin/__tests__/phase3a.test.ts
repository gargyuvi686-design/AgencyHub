/**
 * Phase 3A Integration Tests — Super Admin + Support Mode
 *
 * Doc 02 §5 scenarios covered:
 *   Scenario 6:  suspended agency user cannot log in; already-issued token blocked after suspension;
 *                reactivation restores access
 *   Scenario 7:  agency admin / client / unauthenticated calling /admin/* → 403/401
 *   Scenario 10: support mode POST/PATCH/DELETE on workspace routes → 403 SUPPORT_READ_ONLY
 *                GET of supported agency's project → 200
 *                GET of a different agency's project (cross-tenant in support mode) → 404
 *
 * Additional:
 *   - Super Admin without support claim on workspace route → 403 FORBIDDEN
 *   - Expired support token handling → 401 (tested at middleware unit level)
 *   - Activity log rows written for suspend, activate, support.entered, support.exited
 *
 * Tests FAIL (not skip) on missing seed data or DB issues.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { SUPPORT_COOKIE_NAME } from '../../../lib/jwt';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';

const PASSWORD = 'Password123!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function loginAs(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status} — ${JSON.stringify(res.body)}`);
  }

  const cookies: string[] = Array.isArray(res.headers['set-cookie'])
    ? res.headers['set-cookie']
    : [res.headers['set-cookie']];

  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie for ${email}`);
  return tokenCookie.split(';')[0];
}

let cachedSuperAdminCookie: string;
let cachedAgencyAdminCookie: string;
let cachedAgencyMemberCookie: string;
let cachedClientCookie: string;

async function loginAsAdmin(): Promise<string> {
  if (!cachedSuperAdminCookie) {
    cachedSuperAdminCookie = await loginAs('superadmin@agencyhub.test');
  }
  return cachedSuperAdminCookie;
}

// ── Setup: ensure seed data exists ────────────────────────────────────────────

beforeAll(async () => {
  await prisma.$connect();

  const superAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@agencyhub.test' },
  });
  if (!superAdmin) throw new Error('[Phase3A] Seed missing: superadmin@agencyhub.test');

  const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
  if (!agencyA) throw new Error('[Phase3A] Seed missing: Agency A (acme-digital)');

  const agencyB = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });
  if (!agencyB) throw new Error('[Phase3A] Seed missing: Agency B (apex-creative)');

  // Login once per role in beforeAll and reuse cookies
  cachedSuperAdminCookie = await loginAs('superadmin@agencyhub.test');
  cachedAgencyAdminCookie = await loginAs('admin@acme.test');
  cachedAgencyMemberCookie = await loginAs('member@acme.test');
  cachedClientCookie = await loginAs('client@nike.test');
});

afterAll(async () => {
  // Restore suspended agencies if tests left them in bad state
  await prisma.agency.updateMany({
    where: { slug: 'acme-digital', status: 'SUSPENDED' },
    data: { status: 'ACTIVE', suspendedReason: null },
  });
  await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 7: Agency users / unauthenticated cannot access /admin/*
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario 7 — Admin route access control', () => {
  it('7a — unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('7b (positive) — Super Admin can access /admin/stats → 200', async () => {
    const cookie = await loginAsAdmin();
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalAgencies: expect.any(Number),
      activeAgencies: expect.any(Number),
      suspendedAgencies: expect.any(Number),
    });
  });

  it('7c — Agency admin calling /admin/agencies returns 403', async () => {
    const cookie = cachedAgencyAdminCookie;
    const res = await request(app)
      .get('/api/v1/admin/agencies')
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('7d — Agency member calling /admin/stats returns 403', async () => {
    const cookie = cachedAgencyMemberCookie;
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('7e — Client user calling /admin/* returns 403', async () => {
    const cookie = cachedClientCookie;
    const res = await request(app)
      .get('/api/v1/admin/agencies')
      .set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin agency management endpoints
// ═══════════════════════════════════════════════════════════════════════════════

describe('Admin — agency management endpoints', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
  });

  it('GET /admin/agencies returns paginated list with counts', async () => {
    const res = await request(app)
      .get('/api/v1/admin/agencies')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
    });
    // Each item should have counts
    if (res.body.data.length > 0) {
      expect(res.body.data[0]._count).toMatchObject({
        users: expect.any(Number),
        clients: expect.any(Number),
        projects: expect.any(Number),
      });
    }
  });

  it('GET /admin/agencies?status=ACTIVE returns only active agencies', async () => {
    const res = await request(app)
      .get('/api/v1/admin/agencies?status=ACTIVE')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    for (const agency of res.body.data) {
      expect(agency.status).toBe('ACTIVE');
    }
  });

  it('GET /admin/agencies/:id returns agency detail with counts', async () => {
    const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const res = await request(app)
      .get(`/api/v1/admin/agencies/${agencyA!.id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(agencyA!.id);
    expect(res.body.data._count).toBeDefined();
  });

  it('GET /admin/agencies/:id returns 404 for missing agency', async () => {
    const res = await request(app)
      .get('/api/v1/admin/agencies/00000000-0000-0000-0000-000000000000')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH /admin/agencies/:id/status requires reason when suspending', async () => {
    const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const res = await request(app)
      .patch(`/api/v1/admin/agencies/${agencyA!.id}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'SUSPENDED' }); // no reason

    expect(res.status).toBe(422);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 6: Suspended agency blocking + reactivation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario 6 — Suspended agency access + reactivation', () => {
  let adminCookie: string;
  let agencyAId: string;
  let agencyACookie: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
    const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    if (!agencyA) throw new Error('[Scenario 6] Seed missing: Agency A');
    agencyAId = agencyA.id;

    // Agency A must be ACTIVE before these tests
    await prisma.agency.update({
      where: { id: agencyAId },
      data: { status: 'ACTIVE', suspendedReason: null },
    });
    agencyACookie = await loginAs('admin@acme.test');
  });

  afterAll(async () => {
    // Always restore agency A to ACTIVE so other tests are not affected
    await prisma.agency.update({
      where: { id: agencyAId },
      data: { status: 'ACTIVE', suspendedReason: null },
    });
  });

  it('6a — Suspended agency user cannot log in (403 AGENCY_SUSPENDED)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@suspended.test', password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AGENCY_SUSPENDED');
    expect(res.body.error.message).toContain('suspended');
  });

  it('6b — Valid token blocked immediately after admin suspends the agency', async () => {
    // Verify positive: agency A admin can currently access workspace routes
    const beforeRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', agencyACookie);
    expect(beforeRes.status).toBe(200);

    // Super Admin suspends Agency A
    const suspendRes = await request(app)
      .patch(`/api/v1/admin/agencies/${agencyAId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'SUSPENDED', reason: 'Test suspension for integration test' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status).toBe('SUSPENDED');

    // Activity log row must exist for this suspension
    const logEntry = await prisma.activityLog.findFirst({
      where: { agencyId: agencyAId, eventType: 'agency.suspended' },
      orderBy: { createdAt: 'desc' },
    });
    expect(logEntry).not.toBeNull();
    expect(logEntry!.eventType).toBe('agency.suspended');

    // Existing token is now blocked — loadAgencyStatus runs per-request
    const afterRes = await request(app)
      .get('/api/v1/projects/some-project-id')
      .set('Cookie', agencyACookie);
    // Must be 403 AGENCY_SUSPENDED (not 401 or 404)
    expect(afterRes.status).toBe(403);
    expect(afterRes.body.error.code).toBe('AGENCY_SUSPENDED');
  });

  it('6c — Reactivation restores access', async () => {
    // Reactivate Agency A
    const reactivateRes = await request(app)
      .patch(`/api/v1/admin/agencies/${agencyAId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'ACTIVE' });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('ACTIVE');

    // Activity log row for activation
    const logEntry = await prisma.activityLog.findFirst({
      where: { agencyId: agencyAId, eventType: 'agency.activated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(logEntry).not.toBeNull();

    // Existing token now works again
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', agencyACookie);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 10: Support mode enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('Scenario 10 — Support mode constraints', () => {
  let adminCookie: string;
  let superAdminUser: { id: string; email: string; role: any; agencyId: null; clientId: null };
  let agencyA: { id: string };
  let agencyAProjectId: string;
  let agencyBProjectId: string;

  function makeSupportCookie(agencyId: string, expiresIn: any = '30m'): string {
    const token = jwt.sign(
      {
        superAdminId: superAdminUser.id,
        supportAgencyId: agencyId,
        supportAgencyName: 'Test Agency',
        isSupportMode: true,
      },
      env.JWT_SECRET,
      { expiresIn, issuer: 'agencyhub-support', audience: 'agencyhub-app' },
    );
    return `${SUPPORT_COOKIE_NAME}=${token}`;
  }

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();

    const sa = await prisma.user.findUnique({
      where: { email: 'superadmin@agencyhub.test' },
    });
    if (!sa) throw new Error('[Scenario 10] superadmin seed missing');
    superAdminUser = {
      id: sa.id,
      email: sa.email,
      role: sa.role,
      agencyId: null,
      clientId: null,
    };

    const a = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const b = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });
    if (!a || !b) throw new Error('[Scenario 10] Agency seed missing');
    agencyA = a;

    const aProject = await prisma.project.findFirst({ where: { agencyId: a.id } });
    const bProject = await prisma.project.findFirst({ where: { agencyId: b.id } });
    if (!aProject) throw new Error('[Scenario 10] Agency A has no project in seed');
    if (!bProject) throw new Error('[Scenario 10] Agency B has no project in seed');

    agencyAProjectId = aProject.id;
    agencyBProjectId = bProject.id;
  });

  it('10a — Super Admin WITHOUT support claim on workspace route → 403 FORBIDDEN', async () => {
    // adminCookie has no support_token
    const res = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('10b — Support mode GET of supported agency project → 200', async () => {
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(agencyAProjectId);
  });

  it('10c — Support mode GET of a DIFFERENT agency project → 404', async () => {
    // Support token scoped to agencyA; trying to access agencyB project
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .get(`/api/v1/projects/${agencyBProjectId}`)
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('10d — Support mode POST on a workspace route → 403 SUPPORT_READ_ONLY', async () => {
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .post('/api/v1/projects/some-id/tasks')
      .set('Cookie', `${adminCookie}; ${supportCookie}`)
      .send({ title: 'Hijacked task' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUPPORT_READ_ONLY');
  });

  it('10e — Support mode PATCH on workspace route → 403 SUPPORT_READ_ONLY', async () => {
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .patch(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${supportCookie}`)
      .send({ name: 'Renamed project' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUPPORT_READ_ONLY');
  });

  it('10f — Support mode DELETE on workspace route → 403 SUPPORT_READ_ONLY', async () => {
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .delete(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUPPORT_READ_ONLY');
  });

  it('10g — Support mode POST on a NON-EXISTENT workspace route → 403 SUPPORT_READ_ONLY (guard fires first)', async () => {
    // Route /projects/nonexistent-sub-route does not exist; guard must block before matching
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .post('/api/v1/projects/anything/nonexistent-endpoint')
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUPPORT_READ_ONLY');
  });

  it('10h — Support mode can inspect a SUSPENDED agency project (GET only)', async () => {
    // Suspend agencyA temporarily
    await prisma.agency.update({
      where: { id: agencyA.id },
      data: { status: 'SUSPENDED', suspendedReason: 'test' },
    });

    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    // Super Admin in support mode is exempt from the SUSPENDED check in loadAgencyStatus
    expect(res.status).toBe(200);

    // Restore
    await prisma.agency.update({
      where: { id: agencyA.id },
      data: { status: 'ACTIVE', suspendedReason: null },
    });
  });

  it('10i — Support session enter/exit writes activity log rows', async () => {
    // Enter support mode via HTTP
    const enterRes = await request(app)
      .post(`/api/v1/admin/agencies/${agencyA.id}/support-session`)
      .set('Cookie', adminCookie);
    expect(enterRes.status).toBe(200);

    const enterLog = await prisma.activityLog.findFirst({
      where: { agencyId: agencyA.id, eventType: 'support.entered' },
      orderBy: { createdAt: 'desc' },
    });
    expect(enterLog).not.toBeNull();

    // Extract support cookie from response (ah_support or support_token)
    const setCookies: string[] = Array.isArray(enterRes.headers['set-cookie'])
      ? enterRes.headers['set-cookie']
      : [enterRes.headers['set-cookie']];
    const supportCookieStr = setCookies.find(
      (c) => c.startsWith(`${SUPPORT_COOKIE_NAME}=`) || c.startsWith('support_token=') || c.startsWith('ah_support='),
    );
    const supportCookieHeader = supportCookieStr ? supportCookieStr.split(';')[0] : '';

    // Exit support mode
    const exitRes = await request(app)
      .post('/api/v1/admin/support-session/exit')
      .set('Cookie', `${adminCookie}; ${supportCookieHeader}`);
    expect(exitRes.status).toBe(200);

    const exitLog = await prisma.activityLog.findFirst({
      where: { agencyId: agencyA.id, eventType: 'support.exited' },
      orderBy: { createdAt: 'desc' },
    });
    expect(exitLog).not.toBeNull();
  });



  it('10k — ah_support cookie sent with AGENCY_ADMIN or CLIENT token is ignored and never changes tenant scope', async () => {
    // Agency A admin logs in (reused cached cookie)
    const agencyACookie = cachedAgencyAdminCookie;
    // Forged support token claiming agency B scope
    const forgedSupportCookie = makeSupportCookie(agencyBProjectId);

    // Agency A admin attempts to access Agency B's project with the support cookie attached
    const res = await request(app)
      .get(`/api/v1/projects/${agencyBProjectId}`)
      .set('Cookie', `${agencyACookie}; ${forgedSupportCookie}`);

    // Must return 404 NOT_FOUND because agencyId scope remained Agency A (never changed)
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('10l — ah_support with mismatched sub is ignored (Super Admin without matching claim gets 403)', async () => {
    // Support token with a random mismatched sub/superAdminId
    const mismatchedSupportToken = jwt.sign(
      {
        sub: '00000000-0000-0000-0000-000000000000',
        superAdminId: '00000000-0000-0000-0000-000000000000',
        supportAgencyId: agencyA.id,
        isSupportMode: true,
      },
      env.JWT_SECRET,
      { expiresIn: '30m', issuer: 'agencyhub-support', audience: 'agencyhub-app' },
    );
    const mismatchedCookie = `${SUPPORT_COOKIE_NAME}=${mismatchedSupportToken}`;

    const res = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${mismatchedCookie}`);

    // Mismatched sub ignored -> no valid support context -> 403 FORBIDDEN
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('10m — Expired or tampered ah_support cookie never grants access', async () => {
    // 1. Expired token
    const expiredCookie = makeSupportCookie(agencyA.id, '-1s');
    const expiredRes = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${expiredCookie}`);

    expect(expiredRes.status).toBe(403);
    expect(expiredRes.body.error.code).toBe('FORBIDDEN');

    // 2. Tampered token (invalid signature)
    const tamperedToken = jwt.sign(
      {
        sub: superAdminUser.id,
        superAdminId: superAdminUser.id,
        supportAgencyId: agencyA.id,
        isSupportMode: true,
      },
      'wrong-secret-key-12345678901234567890',
      { expiresIn: '30m', issuer: 'agencyhub-support', audience: 'agencyhub-app' },
    );
    const tamperedCookie = `${SUPPORT_COOKIE_NAME}=${tamperedToken}`;

    const tamperedRes = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', `${adminCookie}; ${tamperedCookie}`);

    expect(tamperedRes.status).toBe(403);
    expect(tamperedRes.body.error.code).toBe('FORBIDDEN');
  });

  it('10n — POST /auth/logout clears ah_support cookie', async () => {
    const supportCookie = makeSupportCookie(agencyA.id);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(res.status).toBe(200);
    const setCookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie']
      : [res.headers['set-cookie'] || ''];

    // ah_support or SUPPORT_COOKIE_NAME should be cleared
    const clearedSupportCookie = setCookies.some(
      (c) => (c.startsWith(`${SUPPORT_COOKIE_NAME}=`) || c.startsWith('ah_support=')) &&
             (c.includes('Max-Age=0') || c.includes('Expires=')),
    );
    expect(clearedSupportCookie).toBe(true);
  });

  it('10o — GET /admin/stats with ?x=/projects behaves identically with or without ah_support, and tenant scope is never taken from URL', async () => {
    const supportCookie = makeSupportCookie(agencyA.id);

    // Call without support cookie
    const resWithout = await request(app)
      .get('/api/v1/admin/stats?x=/projects')
      .set('Cookie', adminCookie);

    expect(resWithout.status).toBe(200);

    // Call with support cookie
    const resWith = await request(app)
      .get('/api/v1/admin/stats?x=/projects')
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(resWith.status).toBe(200);
    // Platform stats identical; never affected by query string or support cookie
    expect(resWith.body.data).toEqual(resWithout.body.data);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Activity feed endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('Admin — activity feed', () => {
  it('GET /admin/activity returns paginated platform events', async () => {
    const adminCookie = await loginAsAdmin();
    const res = await request(app)
      .get('/api/v1/admin/activity')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: expect.any(Number),
      total: expect.any(Number),
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 0 — Contract route integration tests
// Canonical routes per doc 04:
//   POST /admin/agencies/:id/support-session  (primary)
//   POST /admin/support-session/exit           (primary)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Contract routes — POST /admin/agencies/:id/support-session', () => {
  let adminCookie: string;
  let agencyAId: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
    const agency = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    if (!agency) throw new Error('[Contract] Seed missing: acme-digital');
    agencyAId = agency.id;
  });

  afterAll(async () => {
    // Clean up any support cookies from this describe block (best-effort)
  });

  it('positive control — enters support mode and writes activity.entered row', async () => {
    const before = await prisma.activityLog.count({
      where: { eventType: 'support.entered', agencyId: agencyAId },
    });

    const res = await request(app)
      .post(`/api/v1/admin/agencies/${agencyAId}/support-session`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      message: expect.stringContaining('Support mode entered'),
      agency: { id: agencyAId },
      expiresInSeconds: 30 * 60,
    });

    // ah_support cookie must be set
    const cookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie']
      : [res.headers['set-cookie'] ?? ''];
    expect(cookies.some((c) => c.startsWith('ah_support='))).toBe(true);

    const after = await prisma.activityLog.count({
      where: { eventType: 'support.entered', agencyId: agencyAId },
    });
    expect(after).toBe(before + 1);
  });

  it('404 when agency does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/api/v1/admin/agencies/${fakeId}/support-session`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('401 without authentication', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/agencies/${agencyAId}/support-session`);
    expect(res.status).toBe(401);
  });
});

describe('Contract routes — POST /admin/support-session/exit', () => {
  let adminCookie: string;
  let agencyAId: string;
  let supportCookie: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
    const agency = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    if (!agency) throw new Error('[Contract] Seed missing: acme-digital');
    agencyAId = agency.id;

    // Enter support mode to get the ah_support cookie
    const enterRes = await request(app)
      .post(`/api/v1/admin/agencies/${agencyAId}/support-session`)
      .set('Cookie', adminCookie);

    const cookies: string[] = Array.isArray(enterRes.headers['set-cookie'])
      ? enterRes.headers['set-cookie']
      : [enterRes.headers['set-cookie'] ?? ''];
    const sc = cookies.find((c) => c.startsWith('ah_support='));
    if (!sc) throw new Error('[Contract] ah_support cookie not set after entering support mode');
    supportCookie = sc.split(';')[0];
  });

  it('positive control — exits support mode and writes support.exited row', async () => {
    const before = await prisma.activityLog.count({
      where: { eventType: 'support.exited', agencyId: agencyAId },
    });

    const res = await request(app)
      .post('/api/v1/admin/support-session/exit')
      .set('Cookie', `${adminCookie}; ${supportCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/exited/i);

    // ah_support must be cleared
    const setCookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie']
      : [res.headers['set-cookie'] ?? ''];
    expect(
      setCookies.some(
        (c) => c.startsWith('ah_support=') && (c.includes('Max-Age=0') || c.includes('Expires=')),
      ),
    ).toBe(true);

    const after = await prisma.activityLog.count({
      where: { eventType: 'support.exited', agencyId: agencyAId },
    });
    expect(after).toBe(before + 1);
  });

  it('exits cleanly even with no active support session (idempotent)', async () => {
    // Call without a support cookie — should still 200
    const res = await request(app)
      .post('/api/v1/admin/support-session/exit')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/exited/i);
  });
});
