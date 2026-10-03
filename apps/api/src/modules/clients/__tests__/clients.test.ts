import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { ProjectStatus } from '@prisma/client';

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

describe('Clients Module Integration Tests', () => {
  let agencyAAdminCookie: string;
  let agencyAMemberCookie: string;
  let agencyBAdminCookie: string;
  let agencyAId: string;
  let testClientId: string;

  let clientCookie: string;

  beforeAll(async () => {
    agencyAAdminCookie = await loginAs('admin@acme.test');
    agencyAMemberCookie = await loginAs('member@acme.test');
    agencyBAdminCookie = await loginAs('admin@apex.test');
    clientCookie = await loginAs('client@nike.test');

    const a = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    agencyAId = a!.id;

    const existingClient = await prisma.client.findFirst({ where: { agencyId: agencyAId } });
    if (existingClient) {
      testClientId = existingClient.id;
    }
  });

  describe('Role access — CLIENT token on /clients routes (Scenario 4)', () => {
    it('CLIENT token calling GET /api/v1/clients returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/clients')
        .set('Cookie', clientCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('CLIENT token calling GET /api/v1/clients/:id returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${testClientId}`)
        .set('Cookie', clientCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/v1/clients', () => {
    it('Agency Admin creates a client and logs client.created', async () => {
      const clientName = `Acme Customer ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Cookie', agencyAAdminCookie)
        .send({
          companyName: clientName,
          contactName: 'Alice Johnson',
          email: `alice-${Date.now()}@customer.com`,
          phone: '+1 555 1234',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        companyName: clientName,
        agencyId: agencyAId,
      });

      testClientId = res.body.data.id;

      // Verify activity log
      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'client.created', entityId: testClientId },
      });
      expect(log).not.toBeNull();
    });

    it('Agency Member cannot create client -> 403', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Cookie', agencyAMemberCookie)
        .send({
          companyName: 'Unauthorized Client',
          contactName: 'Bob',
          email: 'bob@test.com',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/clients', () => {
    it('Lists clients with pagination and activeProjectsCount', async () => {
      const res = await request(app)
        .get('/api/v1/clients')
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('activeProjectsCount');
      expect(res.body.meta).toBeDefined();
    });

    it('Agency Member sees only clients of assigned projects (and 404 for unassigned)', async () => {
      const memberUser = await prisma.user.findUnique({ where: { email: 'member@acme.test' } });

      // Create an unassigned client for agency A
      const unassignedClient = await prisma.client.create({
        data: {
          agencyId: agencyAId,
          companyName: `Unassigned Client ${Date.now()}`,
          contactName: 'Unassigned',
          email: `unassigned-${Date.now()}@client.test`,
        },
      });

      // Create an assigned client for agency A with a project member
      const assignedClient = await prisma.client.create({
        data: {
          agencyId: agencyAId,
          companyName: `Assigned Client ${Date.now()}`,
          contactName: 'Assigned',
          email: `assigned-${Date.now()}@client.test`,
        },
      });

      const adminUser = await prisma.user.findFirst({ where: { agencyId: agencyAId, role: 'AGENCY_ADMIN' } });
      const proj = await prisma.project.create({
        data: {
          agencyId: agencyAId,
          clientId: assignedClient.id,
          managerId: adminUser!.id,
          name: `Assigned Proj ${Date.now()}`,
          status: ProjectStatus.ACTIVE,
        },
      });

      await prisma.projectMember.create({
        data: {
          projectId: proj.id,
          userId: memberUser!.id,
          agencyId: agencyAId,
        },
      });

      const res = await request(app)
        .get('/api/v1/clients')
        .set('Cookie', agencyAMemberCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      const returnedIds = res.body.data.map((c: any) => c.id);
      expect(returnedIds).toContain(assignedClient.id);
      expect(returnedIds).not.toContain(unassignedClient.id);

      // Detail access: unassigned client returns 404 NOT_FOUND for member
      const detailRes = await request(app)
        .get(`/api/v1/clients/${unassignedClient.id}`)
        .set('Cookie', agencyAMemberCookie);

      expect(detailRes.status).toBe(404);
      expect(detailRes.body.error.code).toBe('NOT_FOUND');

      // Detail access: assigned client returns 200 for member
      const assignedDetailRes = await request(app)
        .get(`/api/v1/clients/${assignedClient.id}`)
        .set('Cookie', agencyAMemberCookie);

      expect(assignedDetailRes.status).toBe(200);
      expect(assignedDetailRes.body.data.id).toBe(assignedClient.id);
    });
  });

  describe('GET /api/v1/clients/:id', () => {
    it('Returns client detail with projects and portal users', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${testClientId}`)
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testClientId);
      expect(res.body.data.projects).toBeInstanceOf(Array);
      expect(res.body.data.users).toBeInstanceOf(Array);
    });

    it('Client isolation — Cross-agency client ID returns 404 NOT_FOUND', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${testClientId}`)
        .set('Cookie', agencyBAdminCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/clients/:id', () => {
    it('Updates client details and logs client.updated', async () => {
      const updatedName = `Updated Company ${Date.now()}`;
      const res = await request(app)
        .patch(`/api/v1/clients/${testClientId}`)
        .set('Cookie', agencyAAdminCookie)
        .send({ companyName: updatedName });

      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe(updatedName);

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'client.updated', entityId: testClientId },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
    });
  });

  describe('POST /api/v1/clients/:id/portal-users', () => {
    it('POST /clients/:id/portal-users invites client portal user with role=CLIENT and clientId', async () => {
      const inviteEmail = `portal-user-${Date.now()}@client.com`;
      const res = await request(app)
        .post(`/api/v1/clients/${testClientId}/portal-users`)
        .set('Cookie', agencyAAdminCookie)
        .send({
          email: inviteEmail,
          name: 'Portal User Canonical',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        acceptLink: expect.stringContaining('/accept-invite?token='),
        token: expect.any(String),
      });

      const rawToken = res.body.data.token;

      // Check DB invitation record
      const invite = await prisma.invitation.findUnique({
        where: { id: res.body.data.invitationId },
      });
      expect(invite!.role).toBe('CLIENT');
      expect(invite!.clientId).toBe(testClientId);

      // Verify accepting this invite creates a CLIENT role user with clientId
      const acceptRes = await request(app)
        .post('/api/v1/auth/accept-invite')
        .send({
          token: rawToken,
          name: 'Portal User Canonical Verified',
          password: 'Password123!',
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.user.role).toBe('CLIENT');
      expect(acceptRes.body.data.user.clientId).toBe(testClientId);
    });
  });

  describe('DELETE /api/v1/clients/:id', () => {
    it('Blocks deletion if active projects exist -> 409 CONFLICT', async () => {
      // Create a client with an active project
      const clientWithProj = await prisma.client.create({
        data: {
          agencyId: agencyAId,
          companyName: `Busy Client Active ${Date.now()}`,
          contactName: 'Busy Manager',
          email: `busy-act-${Date.now()}@client.com`,
        },
      });

      const user = await prisma.user.findFirst({ where: { agencyId: agencyAId } });

      await prisma.project.create({
        data: {
          agencyId: agencyAId,
          clientId: clientWithProj.id,
          managerId: user!.id,
          name: 'Active Project for Busy Client',
          status: ProjectStatus.ACTIVE,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/clients/${clientWithProj.id}`)
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Cannot delete client with existing projects');
    });

    it('Blocks deletion if COMPLETED project exists -> 409 CONFLICT', async () => {
      const clientWithCompletedProj = await prisma.client.create({
        data: {
          agencyId: agencyAId,
          companyName: `Client With Completed Proj ${Date.now()}`,
          contactName: 'Completed Manager',
          email: `completed-${Date.now()}@client.com`,
        },
      });

      const user = await prisma.user.findFirst({ where: { agencyId: agencyAId } });

      await prisma.project.create({
        data: {
          agencyId: agencyAId,
          clientId: clientWithCompletedProj.id,
          managerId: user!.id,
          name: 'Completed Project',
          status: ProjectStatus.COMPLETED,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/clients/${clientWithCompletedProj.id}`)
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Cannot delete client with existing projects');
    });

    it('Deletes successfully if no projects exist and logs client.deleted', async () => {
      const freeClient = await prisma.client.create({
        data: {
          agencyId: agencyAId,
          companyName: `Empty Client ${Date.now()}`,
          contactName: 'Empty',
          email: `empty-${Date.now()}@client.com`,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/clients/${freeClient.id}`)
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);

      const check = await prisma.client.findUnique({ where: { id: freeClient.id } });
      expect(check).toBeNull();

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'client.deleted', entityId: freeClient.id },
      });
      expect(log).not.toBeNull();
    });
  });
});

