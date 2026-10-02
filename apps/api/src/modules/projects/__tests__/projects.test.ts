import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';

const PASSWORD = 'Password123!';

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

describe('Projects Module Integration Tests', () => {
  let agencyAAdminCookie: string;
  let agencyAMemberCookie: string;
  let clientCookie: string;
  let agencyAId: string;
  let agencyBId: string;
  let clientAId: string;
  let clientBId: string;
  let memberAUser: any;
  let clientUser: any;
  let userFromOtherAgency: any;
  let createdProjectId: string;

  beforeAll(async () => {
    agencyAAdminCookie = await loginAs('admin@acme.test');
    agencyAMemberCookie = await loginAs('member@acme.test');
    clientCookie = await loginAs('client@nike.test');



    const a = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    const b = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });
    agencyAId = a!.id;
    agencyBId = b!.id;

    clientUser = await prisma.user.findUnique({ where: { email: 'client@nike.test' } });
    clientAId = clientUser!.clientId!;

    const cb = await prisma.client.findFirst({ where: { agencyId: agencyBId } });
    clientBId = cb!.id;

    userFromOtherAgency = await prisma.user.findFirst({ where: { agencyId: agencyBId } });
    memberAUser = await prisma.user.findUnique({ where: { email: 'member@acme.test' } });
  });

  describe('POST /api/v1/projects', () => {
    it('Agency Admin creates project and logs project.created', async () => {
      const projName = `Brand Redesign ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', agencyAAdminCookie)
        .send({
          name: projName,
          description: 'Full redesign',
          clientId: clientAId,
          priority: 'HIGH',
          status: 'PLANNING',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(projName);
      expect(res.body.data.agencyId).toBe(agencyAId);
      expect(res.body.data.clientId).toBe(clientAId);

      createdProjectId = res.body.data.id;

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'project.created', entityId: createdProjectId },
      });
      expect(log).not.toBeNull();
    });

    it('Scenario 11 — Rejects cross-agency clientId on project create -> 404 Client not found', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', agencyAAdminCookie)
        .send({
          name: 'Invalid Cross-Tenant Project',
          clientId: clientBId, // Agency B's client!
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Rejects CLIENT user as manager_id on project create -> 422', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', agencyAAdminCookie)
        .send({
          name: 'Project with Client as Manager',
          clientId: clientAId,
          managerId: clientUser.id,
        });

      expect(res.status).toBe(422);
    });

    it('Rejects manager_id from another agency on project create -> 404', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', agencyAAdminCookie)
        .send({
          name: 'Project with Cross Agency Manager',
          clientId: clientAId,
          managerId: userFromOtherAgency.id,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Agency Member cannot create project -> 403', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Cookie', agencyAMemberCookie)
        .send({
          name: 'Member Project Attempt',
          clientId: clientAId,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/projects', () => {
    it('Agency Admin lists all projects in agency', async () => {
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const p of res.body.data) {
        expect(p.agencyId).toBe(agencyAId);
      }
    });

    it('CLIENT token calling GET /api/v1/projects returns 403 (Scenario 4)', async () => {
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Cookie', clientCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('CLIENT token calling GET /api/v1/projects/:id returns 403 (Scenario 4)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', clientCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Scenario 8 — Member opens unassigned project in own agency returns 404', async () => {
      const adminUser = await prisma.user.findFirst({ where: { agencyId: agencyAId, role: 'AGENCY_ADMIN' } });
      const unassignedProj = await prisma.project.create({
        data: {
          agencyId: agencyAId,
          clientId: clientAId,
          managerId: adminUser!.id,
          name: `Unassigned Project ${Date.now()}`,
        },
      });

      const res = await request(app)
        .get(`/api/v1/projects/${unassignedProj.id}`)
        .set('Cookie', agencyAMemberCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Scenario 8 — Member lists projects and sees only assigned projects', async () => {
      const adminUser = await prisma.user.findFirst({ where: { agencyId: agencyAId, role: 'AGENCY_ADMIN' } });
      const unassignedProj = await prisma.project.create({
        data: {
          agencyId: agencyAId,
          clientId: clientAId,
          managerId: adminUser!.id,
          name: `Unassigned Proj For List ${Date.now()}`,
        },
      });

      const res = await request(app)
        .get('/api/v1/projects')
        .set('Cookie', agencyAMemberCookie);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).not.toContain(unassignedProj.id);
    });
  });

  describe('PUT /api/v1/projects/:id/members', () => {
    it('Replaces full member set in one transaction, verifying active AGENCY_* user and stamping agencyId', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${createdProjectId}/members`)
        .set('Cookie', agencyAAdminCookie)
        .send({ userIds: [memberAUser.id] });

      expect(res.status).toBe(200);

      // Verify membership record and agencyId
      const check = await prisma.projectMember.findFirst({
        where: { projectId: createdProjectId, userId: memberAUser.id },
      });
      expect(check).not.toBeNull();
      expect(check!.agencyId).toBe(agencyAId);

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'project.members_updated', entityId: createdProjectId },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
    });

    it('Rejects non-agency-staff user (CLIENT) as member -> 422', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${createdProjectId}/members`)
        .set('Cookie', agencyAAdminCookie)
        .send({ userIds: [clientUser.id] });

      expect(res.status).toBe(422);
    });

    it('Rejects user from another agency as member -> 422', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${createdProjectId}/members`)
        .set('Cookie', agencyAAdminCookie)
        .send({ userIds: [userFromOtherAgency.id] });

      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('Updates project fields and logs project.updated', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', agencyAAdminCookie)
        .send({ status: 'ACTIVE', priority: 'HIGH' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'project.updated', entityId: createdProjectId },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
    });

    it('Rejects CLIENT user as manager_id on project update -> 422', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', agencyAAdminCookie)
        .send({ managerId: clientUser.id });

      expect(res.status).toBe(422);
    });

    it('Rejects cross-agency user as manager_id on project update -> 404', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', agencyAAdminCookie)
        .send({ managerId: userFromOtherAgency.id });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('Deletes project and logs project.deleted', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${createdProjectId}`)
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);

      const check = await prisma.project.findUnique({ where: { id: createdProjectId } });
      expect(check).toBeNull();

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'project.deleted', entityId: createdProjectId },
      });
      expect(log).not.toBeNull();
    });
  });
});

