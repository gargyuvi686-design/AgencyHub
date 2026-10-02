/**
 * Tenant Isolation Test Suite — Phase 2
 *
 * Doc 02 §5 scenarios covered:
 *   Scenario 1: Agency A admin GET /projects/{B's project id} → 404 NOT_FOUND
 *               Agency A admin GET /projects/{A's project id} → 200 (positive)
 *   Scenario 2: Agency A user PATCH (repo.update) /tasks/{B's task id} → 404, no change
 *   Scenario 6: Suspended agency user login / API call → 403 + AGENCY_SUSPENDED message
 *   Scenario 7: Agency user calls /admin/* → 403 FORBIDDEN
 *
 * Tests FAIL (not skip) when DB is unreachable or seed data is missing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { TaskStatus, TaskPriority } from '@prisma/client';

const AGENCY_A_EMAIL = 'admin@acme.test';
const SUSPENDED_EMAIL = 'admin@suspended.test';
const PASSWORD = 'Password123!';

/**
 * Helper: log in and return the session cookie string.
 * Throws (fails the test) on any non-200 response.
 */
async function loginAs(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const cookies: string[] = Array.isArray(res.headers['set-cookie'])
    ? res.headers['set-cookie']
    : [res.headers['set-cookie']];

  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) {
    throw new Error(`No token cookie returned for ${email}`);
  }

  return tokenCookie.split(';')[0];
}

// ─── Scenario 1: Cross-Agency Project Access via HTTP ─────────────────────────

describe('Isolation — Scenario 1: Cross-Agency Project Access (HTTP)', () => {
  let agencyACookie: string;
  let agencyAProjectId: string;
  let agencyBProjectId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const agencyB = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });

    if (!agencyA || !agencyB) {
      throw new Error('[Scenario 1] Seed data missing: Agency A or B not found.');
    }

    // Login (asserts 200)
    agencyACookie = await loginAs(AGENCY_A_EMAIL);

    const aProject = await prisma.project.findFirst({ where: { agencyId: agencyA.id } });
    const bProject = await prisma.project.findFirst({ where: { agencyId: agencyB.id } });

    if (!aProject) throw new Error('[Scenario 1] Seed data missing: Agency A has no project.');
    if (!bProject) throw new Error('[Scenario 1] Seed data missing: Agency B has no project.');

    agencyAProjectId = aProject.id;
    agencyBProjectId = bProject.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Scenario 1 — Agency A admin can read their own project → 200', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${agencyAProjectId}`)
      .set('Cookie', agencyACookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(agencyAProjectId);
  });

  it('Scenario 1 — Agency A admin cannot read Agency B project → 404 NOT_FOUND', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${agencyBProjectId}`)
      .set('Cookie', agencyACookie);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Scenario 1 & 2: Repository-level cross-tenant enforcement ────────────────

describe('Isolation — Repository-level cross-tenant enforcement', () => {
  afterAll(async () => {
    // Clean up any task created by this suite
    await prisma.task.deleteMany({ where: { title: 'ISOLATION_TEST_TASK_AGENCY_B' } });
  });

  it('Scenario 1 (repo) — ProjectRepository.findById rejects cross-agency access with 404', async () => {
    const { ProjectRepository } = await import('../../projects/project.repository');

    const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const agencyBProject = await prisma.project.findFirst({
      where: { agency: { slug: 'apex-creative' } },
    });

    if (!agencyA) throw new Error('[Repo Scenario 1] Seed data missing: Agency A not found.');
    if (!agencyBProject)
      throw new Error('[Repo Scenario 1] Seed data missing: Agency B project not found.');

    const repoA = new ProjectRepository(agencyA.id);

    await expect(repoA.findById(agencyBProject.id)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('Scenario 2 (repo) — TaskRepository.update on cross-agency task returns 404, original unchanged', async () => {
    const { TaskRepository } = await import('../../tasks/task.repository');

    const agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const agencyB = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });

    if (!agencyA) throw new Error('[Repo Scenario 2] Seed data missing: Agency A not found.');
    if (!agencyB) throw new Error('[Repo Scenario 2] Seed data missing: Agency B not found.');

    // Find Agency B's project to attach the task
    const agencyBProject = await prisma.project.findFirst({ where: { agencyId: agencyB.id } });
    if (!agencyBProject)
      throw new Error('[Repo Scenario 2] Seed data missing: Agency B project not found.');

    // Find Agency B admin to use as createdBy
    const adminB = await prisma.user.findFirst({
      where: { agencyId: agencyB.id, role: 'AGENCY_ADMIN' },
    });
    if (!adminB) throw new Error('[Repo Scenario 2] Seed data missing: Agency B admin not found.');

    // Create a fresh task under Agency B for this test (idempotent via title)
    let agencyBTask = await prisma.task.findFirst({
      where: { title: 'ISOLATION_TEST_TASK_AGENCY_B', agencyId: agencyB.id },
    });
    if (!agencyBTask) {
      agencyBTask = await prisma.task.create({
        data: {
          agencyId: agencyB.id,
          projectId: agencyBProject.id,
          title: 'ISOLATION_TEST_TASK_AGENCY_B',
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          createdBy: adminB.id,
        },
      });
    }

    const originalTitle = agencyBTask.title;

    // Agency A's repository attempting to update Agency B's task
    const repoA = new TaskRepository(agencyA.id);

    await expect(
      repoA.update(agencyBTask.id, { title: 'HIJACKED' }),
    ).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });

    // Verify the original task was NOT modified
    const unchanged = await prisma.task.findUnique({ where: { id: agencyBTask.id } });
    expect(unchanged?.title).toBe(originalTitle);
  });
});

// ─── Scenario 6: Suspended Agency Access ──────────────────────────────────────

describe('Isolation — Scenario 6: Suspended Agency Access', () => {
  it('Scenario 6a — Suspended agency user login returns 403 AGENCY_SUSPENDED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: SUSPENDED_EMAIL, password: PASSWORD })
      .expect(403);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('AGENCY_SUSPENDED');
    expect(res.body.error.message).toContain('suspended');
  });

  it('Scenario 6b — Suspended agency loadAgencyStatus middleware throws 403 AGENCY_SUSPENDED', async () => {
    const { loadAgencyStatus } = await import('../../../middleware/agencyStatus');

    const suspendedUser = await prisma.user.findUnique({
      where: { email: SUSPENDED_EMAIL },
      include: { agency: true },
    });

    if (!suspendedUser?.agency) {
      throw new Error('[Scenario 6b] Suspended user seed data missing.');
    }

    const req: any = { user: suspendedUser, effectiveAgencyId: suspendedUser.agencyId };
    const res: any = {};
    let error: any;
    await loadAgencyStatus(req, res, (err?: any) => {
      error = err;
    });

    expect(error).toBeDefined();
    expect(error.status).toBe(403);
    expect(error.code).toBe('AGENCY_SUSPENDED');
    expect(suspendedUser.agency.status).toBe('SUSPENDED');
  });
});

// ─── Scenario 7: Agency User Calls Admin Routes ───────────────────────────────

describe('Isolation — Scenario 7: Agency User Calls Admin Routes', () => {
  let agencyACookie: string;
  let memberCookie: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: AGENCY_A_EMAIL } });
    if (!user) throw new Error('[Scenario 7] Seed data missing: Agency A admin not found.');
    agencyACookie = await loginAs(AGENCY_A_EMAIL);
    memberCookie = await loginAs('member@acme.test');
  });

  it('Scenario 7 — Agency Admin calling /api/v1/admin/agencies returns 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/v1/admin/agencies')
      .set('Cookie', agencyACookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('Scenario 7 — Agency Member calling /api/v1/admin/* returns 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });
});
