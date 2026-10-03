import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';

const PASSWORD = 'Password123!';

async function loginAs(email: string, password = PASSWORD): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [response.headers['set-cookie']];
  const tokenCookie = cookies.find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie returned for ${email}`);
  return tokenCookie.split(';')[0];
}

describe('Invitation HTTP flows', () => {
  let agencyAId: string;
  let agencyBId: string;
  let adminAId: string;
  let clientAId: string;
  let clientBId: string;
  let projectAId: string;
  let projectBId: string;
  let adminACookie: string;
  let adminBCookie: string;
  let teamEmail: string;
  let portalEmail: string;
  let usedTeamToken: string;
  let teamInvitationId: string;
  const invitationIds: string[] = [];
  const userIds: string[] = [];
  const activityIds: string[] = [];

  beforeAll(async () => {
    const [agencyA, agencyB, adminA, adminB] = await Promise.all([
      prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } }),
      prisma.agency.findUniqueOrThrow({ where: { slug: 'apex-creative' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@apex.test' } }),
    ]);
    agencyAId = agencyA.id;
    agencyBId = agencyB.id;
    adminAId = adminA.id;
    adminACookie = await loginAs(adminA.email);
    adminBCookie = await loginAs(adminB.email);

    const [clientA, clientB] = await Promise.all([
      prisma.client.create({ data: { agencyId: agencyAId, companyName: 'Invite Flow Client A', contactName: 'Invite Contact A', email: `invite-client-a-${Date.now()}@example.test` } }),
      prisma.client.create({ data: { agencyId: agencyAId, companyName: 'Invite Flow Client B', contactName: 'Invite Contact B', email: `invite-client-b-${Date.now()}@example.test` } }),
    ]);
    clientAId = clientA.id;
    clientBId = clientB.id;
    const [projectA, projectB] = await Promise.all([
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientAId, managerId: adminAId, name: 'Invite Flow Project A' } }),
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientBId, managerId: adminAId, name: 'Invite Flow Project B' } }),
    ]);
    projectAId = projectA.id;
    projectBId = projectB.id;
  });

  afterAll(async () => {
    if (activityIds.length) await prisma.activityLog.deleteMany({ where: { id: { in: activityIds } } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (invitationIds.length) await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
    const projectIds = [projectAId, projectBId].filter(Boolean);
    if (projectIds.length) await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    const clientIds = [clientAId, clientBId].filter(Boolean);
    if (clientIds.length) await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  });

  it('team invitation via /team/invites accepts, logs in, and ignores body role/agency overrides', async () => {
    teamEmail = `team-join-${Date.now()}@example.test`;
    const invited = await request(app)
      .post('/api/v1/team/invites')
      .set('Cookie', adminACookie)
      .send({ email: teamEmail, role: 'AGENCY_MEMBER' });
    expect(invited.status).toBe(201);
    expect(invited.body.data.acceptLink).toContain('/accept-invite?token=');
    usedTeamToken = invited.body.data.token;
    const tokenHash = createHash('sha256').update(usedTeamToken).digest('hex');
    const invitation = await prisma.invitation.findUniqueOrThrow({ where: { tokenHash } });
    teamInvitationId = invitation.id;
    invitationIds.push(invitation.id);

    const accepted = await request(app)
      .post('/api/v1/auth/accept-invite')
      .send({ token: usedTeamToken, name: 'Joined Member', password: 'JoinedPassword123!', role: 'SUPER_ADMIN', agencyId: agencyBId, clientId: clientBId });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.user).toMatchObject({ email: teamEmail, role: 'AGENCY_MEMBER', agencyId: agencyAId, clientId: null });
    userIds.push(accepted.body.data.user.id);

    const loginCookie = await loginAs(teamEmail, 'JoinedPassword123!');
    const session = await request(app).get('/api/v1/auth/me').set('Cookie', loginCookie);
    expect(session.status).toBe(200);
    expect(session.body.data.user).toMatchObject({ role: 'AGENCY_MEMBER', agencyId: agencyAId });
  });

  it('portal invitation binds the client, accepts, logs in, and sees only that client projects', async () => {
    portalEmail = `portal-join-${Date.now()}@example.test`;
    const foreignAttempt = await request(app)
      .post(`/api/v1/clients/${clientAId}/portal-users`)
      .set('Cookie', adminBCookie)
      .send({ email: `cross-agency-${Date.now()}@example.test` });
    expect(foreignAttempt.status).toBe(404);

    const invited = await request(app)
      .post(`/api/v1/clients/${clientAId}/portal-users`)
      .set('Cookie', adminACookie)
      .send({ email: portalEmail });
    expect(invited.status).toBe(201);
    expect(invited.body.data.acceptLink).toContain('/accept-invite?token=');
    const invitation = await prisma.invitation.findUniqueOrThrow({ where: { id: invited.body.data.invitationId } });
    invitationIds.push(invitation.id);
    expect(invitation).toMatchObject({ agencyId: agencyAId, clientId: clientAId, role: 'CLIENT' });

    const accepted = await request(app)
      .post('/api/v1/auth/accept-invite')
      .send({ token: invited.body.data.token, name: 'Joined Portal User', password: 'PortalPassword123!', role: 'AGENCY_ADMIN', agencyId: agencyBId, clientId: clientBId });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.user).toMatchObject({ email: portalEmail, role: 'CLIENT', agencyId: agencyAId, clientId: clientAId });
    userIds.push(accepted.body.data.user.id);

    const loginCookie = await loginAs(portalEmail, 'PortalPassword123!');
    const projects = await request(app).get('/api/v1/portal/projects').set('Cookie', loginCookie);
    expect(projects.status).toBe(200);
    expect(projects.body.data.some((project: { id: string }) => project.id === projectAId)).toBe(true);
    expect(projects.body.data.some((project: { id: string }) => project.id === projectBId)).toBe(false);
  });

  it('rejects expired and reused invite tokens', async () => {
    const expiredRawToken = randomBytes(32).toString('hex');
    const expired = await prisma.invitation.create({
      data: { agencyId: agencyAId, email: `expired-${Date.now()}@example.test`, role: 'AGENCY_MEMBER', tokenHash: createHash('sha256').update(expiredRawToken).digest('hex'), expiresAt: new Date(Date.now() - 1000), createdBy: adminAId },
    });
    invitationIds.push(expired.id);
    const expiredAccept = await request(app).post('/api/v1/auth/accept-invite').send({ token: expiredRawToken, name: 'Expired Member', password: PASSWORD });
    expect(expiredAccept.status).toBe(404);

    const reused = await request(app).post('/api/v1/auth/accept-invite').send({ token: usedTeamToken, name: 'Reused Member', password: PASSWORD });
    expect(reused.status).toBe(404);

    const usedInvite = await prisma.invitation.findUniqueOrThrow({ where: { id: teamInvitationId } });
    expect(usedInvite.usedAt).not.toBeNull();
  });
});