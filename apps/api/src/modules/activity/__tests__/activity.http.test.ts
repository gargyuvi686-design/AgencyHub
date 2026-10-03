import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';

const PASSWORD = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [response.headers['set-cookie']];
  const tokenCookie = cookies.find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie returned for ${email}`);
  return tokenCookie.split(';')[0];
}

describe('Agency activity feed HTTP scoping', () => {
  let agencyAId: string;
  let agencyBId: string;
  let projectAssignedId: string;
  let projectUnassignedId: string;
  let projectBId: string;
  let clientBId: string;
  let adminACookie: string;
  let adminBCookie: string;
  let memberCookie: string;
  let clientCookie: string;
  const eventIds: string[] = [];

  beforeAll(async () => {
    const [agencyA, agencyB, adminA, adminB, memberA] = await Promise.all([
      prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } }),
      prisma.agency.findUniqueOrThrow({ where: { slug: 'apex-creative' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@apex.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member@acme.test' } }),
    ]);
    agencyAId = agencyA.id;
    agencyBId = agencyB.id;
    const [clientA, clientB] = await Promise.all([
      prisma.client.findFirstOrThrow({ where: { agencyId: agencyAId } }),
      prisma.client.create({
        data: { agencyId: agencyBId, companyName: 'Activity Agency B Client', contactName: 'Fixture', email: `activity-${Date.now()}@example.test` },
      }),
    ]);
    clientBId = clientB.id;
    const [assigned, unassigned, projectB] = await Promise.all([
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminA.id, name: 'Activity assigned project' } }),
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminA.id, name: 'Activity unassigned project' } }),
      prisma.project.create({ data: { agencyId: agencyBId, clientId: clientB.id, managerId: adminB.id, name: 'Activity Agency B project' } }),
    ]);
    projectAssignedId = assigned.id;
    projectUnassignedId = unassigned.id;
    projectBId = projectB.id;
    await prisma.projectMember.create({ data: { agencyId: agencyAId, projectId: projectAssignedId, userId: memberA.id } });
    const events = await Promise.all([
      prisma.activityLog.create({ data: { agencyId: agencyAId, actorType: 'USER', actorId: adminA.id, eventType: 'test.activity.scope', entityId: 'assigned-fixture', projectId: projectAssignedId } }),
      prisma.activityLog.create({ data: { agencyId: agencyAId, actorType: 'USER', actorId: adminA.id, eventType: 'test.activity.scope', entityId: 'unassigned-fixture', projectId: projectUnassignedId } }),
      prisma.activityLog.create({ data: { agencyId: agencyBId, actorType: 'USER', actorId: adminB.id, eventType: 'test.activity.scope', entityId: 'agency-b-fixture', projectId: projectBId } }),
    ]);
    eventIds.push(...events.map((event) => event.id));
    [adminACookie, adminBCookie, memberCookie, clientCookie] = await Promise.all([
      loginAs('admin@acme.test'), loginAs('admin@apex.test'), loginAs('member@acme.test'), loginAs('client@nike.test'),
    ]);
  });

  afterAll(async () => {
    if (eventIds.length) await prisma.activityLog.deleteMany({ where: { id: { in: eventIds } } });
    const projectIds = [projectAssignedId, projectUnassignedId, projectBId].filter(Boolean);
    if (projectIds.length) {
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    if (clientBId) await prisma.client.delete({ where: { id: clientBId } });
  });

  it('agency admin sees own activity and never another agency event', async () => {
    const response = await request(app).get('/api/v1/activity?page=1&limit=100').set('Cookie', adminACookie);
    expect(response.status).toBe(200);
    const entities = response.body.data.map((event: { entityId: string }) => event.entityId);
    expect(entities).toContain('assigned-fixture');
    expect(entities).not.toContain('agency-b-fixture');
  });

  it('member sees only assigned-project events and client receives 403', async () => {
    const memberResponse = await request(app).get('/api/v1/activity?page=1&limit=100').set('Cookie', memberCookie);
    expect(memberResponse.status).toBe(200);
    const entities = memberResponse.body.data.map((event: { entityId: string }) => event.entityId);
    expect(entities).toContain('assigned-fixture');
    expect(entities).not.toContain('unassigned-fixture');
    expect(entities).not.toContain('agency-b-fixture');

    const agencyBResponse = await request(app).get('/api/v1/activity').set('Cookie', adminBCookie);
    expect(agencyBResponse.status).toBe(200);
    expect(agencyBResponse.body.data.some((event: { entityId: string }) => event.entityId === 'agency-b-fixture')).toBe(true);

    const clientResponse = await request(app).get('/api/v1/activity').set('Cookie', clientCookie);
    expect(clientResponse.status).toBe(403);
  });
});