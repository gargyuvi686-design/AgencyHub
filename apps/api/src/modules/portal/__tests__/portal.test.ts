import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';

const PASSWORD = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const cookies = Array.isArray(res.headers['set-cookie'])
    ? res.headers['set-cookie']
    : [res.headers['set-cookie']];
  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) {
    throw new Error(`No token cookie returned for ${email}`);
  }
  return tokenCookie.split(';')[0];
}

describe('Portal backend isolation', () => {
  let agencyA: any;
  let clientUserA: any;
  let clientA: any;
  let anotherClient: any;
  let ownProject: any;
  let otherProject: any;
  let clientCookie: string;

  beforeAll(async () => {
    agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    clientUserA = await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: 'CLIENT' } });
    clientA = await prisma.client.findFirst({ where: { id: clientUserA.clientId } });
    const clients = await prisma.client.findMany({ where: { agencyId: agencyA.id } });
    anotherClient = clients.find((c: any) => c.id !== clientA.id) ?? clients[0];

    if (!anotherClient || anotherClient.id === clientA.id) {
      anotherClient = await prisma.client.create({
        data: {
          agencyId: agencyA.id,
          companyName: 'Portal Isolation Client',
          contactName: 'Portal Isolation Contact',
          email: 'portal-isolation-client@example.test',
        },
      });
    }

    ownProject = await prisma.project.findFirst({ where: { agencyId: agencyA.id, clientId: clientA.id } });
    otherProject = await prisma.project.findFirst({ where: { agencyId: agencyA.id, clientId: anotherClient.id } });

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } });
    if (!ownProject) {
      ownProject = await prisma.project.create({
        data: { agencyId: agencyA.id, clientId: clientA.id, managerId: admin.id, name: 'Portal Own Project Fixture' },
      });
    }
    if (!otherProject) {
      otherProject = await prisma.project.create({
        data: { agencyId: agencyA.id, clientId: anotherClient.id, managerId: admin.id, name: 'Portal Other Project Fixture' },
      });
    }

    clientCookie = await loginAs(clientUserA.email);
  });

  it('positive control: client sees own project overview and visible meetings', async () => {
    const overview = await request(app)
      .get('/api/v1/portal/overview')
      .set('Cookie', clientCookie);

    expect(overview.status).toBe(200);
    expect(overview.body.data).toBeDefined();

    const projects = await request(app)
      .get('/api/v1/portal/projects')
      .set('Cookie', clientCookie);

    expect(projects.status).toBe(200);
    expect(projects.body.data.some((project: any) => project.id === ownProject.id)).toBe(true);

    const sharedMeeting = await prisma.meeting.create({
      data: {
        agencyId: agencyA.id,
        projectId: ownProject.id,
        title: 'Portal Shared Meeting',
        meetingDate: new Date(),
        visibleToClient: true,
        createdBy: (await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: 'AGENCY_ADMIN' } }))!.id,
      },
    });

    const meetings = await request(app)
      .get(`/api/v1/portal/projects/${ownProject.id}/meetings`)
      .set('Cookie', clientCookie);

    expect(meetings.status).toBe(200);
    expect(meetings.body.data.some((meeting: any) => meeting.id === sharedMeeting.id)).toBe(true);

    await prisma.meeting.delete({ where: { id: sharedMeeting.id } });
  });

  it('Scenario 3: cross-client project fetch returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/portal/projects/${otherProject.id}`)
      .set('Cookie', clientCookie);

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('NOT_FOUND');
  });

  it('client token reads its own client record and gets 404 for another client in the same agency', async () => {
    const ownClient = await request(app)
      .get(`/api/v1/portal/clients/${clientA.id}`)
      .set('Cookie', clientCookie);
    expect(ownClient.status).toBe(200);
    expect(ownClient.body.data.id).toBe(clientA.id);

    const otherClient = await request(app)
      .get(`/api/v1/portal/clients/${anotherClient.id}`)
      .set('Cookie', clientCookie);
    expect(otherClient.status).toBe(404);
    expect(otherClient.body.error?.code).toBe('NOT_FOUND');

    const workspaceClientRoute = await request(app)
      .get(`/api/v1/clients/${clientA.id}`)
      .set('Cookie', clientCookie);
    expect(workspaceClientRoute.status).toBe(403);
  });

  it('Scenario 9: hidden meeting is excluded from client-visible list', async () => {
    const hiddenMeeting = await prisma.meeting.create({
      data: {
        agencyId: agencyA.id,
        projectId: ownProject.id,
        title: 'Hidden Meeting',
        meetingDate: new Date(),
        visibleToClient: false,
        createdBy: (await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: 'AGENCY_ADMIN' } }))!.id,
      },
    });

    const res = await request(app)
      .get(`/api/v1/portal/projects/${ownProject.id}/meetings`)
      .set('Cookie', clientCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.some((meeting: any) => meeting.id === hiddenMeeting.id)).toBe(false);

    await prisma.meeting.delete({ where: { id: hiddenMeeting.id } });
  });
});
