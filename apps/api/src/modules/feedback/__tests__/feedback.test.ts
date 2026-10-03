import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { signSupportToken, SUPPORT_COOKIE_NAME } from '../../../lib/jwt';

const PASSWORD = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }

  const cookies = Array.isArray(response.headers['set-cookie'])
    ? response.headers['set-cookie']
    : [response.headers['set-cookie']];
  const tokenCookie = cookies.find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie returned for ${email}`);
  return tokenCookie.split(';')[0];
}

describe('Client feedback HTTP isolation', () => {
  let agencyId: string;
  let clientId: string;
  let otherClientId: string;
  let clientUserId: string;
  let ownProjectId: string;
  let otherProjectId: string;
  let otherFeedbackId: string;
  let clientFeedbackId: string;
  let clientCookie: string;
  let adminCookie: string;
  let memberCookie: string;
  let supportCookie: string;
  let agencyBClientId: string | undefined;
  let agencyBProjectId: string | undefined;
  const feedbackIds: string[] = [];

  beforeAll(async () => {
    const agency = await prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } });
    agencyId = agency.id;

    const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@nike.test' } });
    const otherClientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@adidas.test' } });
    clientId = clientUser.clientId!;
    otherClientId = otherClientUser.clientId!;
    clientUserId = clientUser.id;

    ownProjectId = (await prisma.project.findFirstOrThrow({ where: { agencyId, clientId } })).id;
    otherProjectId = (await prisma.project.findFirstOrThrow({ where: { agencyId, clientId: otherClientId } })).id;

    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@acme.test' } });
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: ownProjectId, userId: member.id } },
      create: { agencyId, projectId: ownProjectId, userId: member.id },
      update: {},
    });

    const otherFeedback = await prisma.feedback.create({
      data: {
        agencyId,
        projectId: otherProjectId,
        clientId: otherClientId,
        submittedBy: otherClientUser.id,
        title: 'Other client feedback fixture',
        description: 'Used to prove feedback and comment isolation.',
      },
    });
    otherFeedbackId = otherFeedback.id;
    feedbackIds.push(otherFeedback.id);

    clientCookie = await loginAs('client@nike.test');
    adminCookie = await loginAs('admin@acme.test');
    memberCookie = await loginAs('member@acme.test');

    const superAdminCookie = await loginAs('superadmin@agencyhub.test');
    const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@agencyhub.test' } });
    const token = signSupportToken({ superAdminId: superAdmin.id, supportAgencyId: agencyId });
    supportCookie = `${superAdminCookie}; ${SUPPORT_COOKIE_NAME}=${token}`;
  });

  afterAll(async () => {
    if (feedbackIds.length > 0) {
      await prisma.feedbackComment.deleteMany({ where: { feedbackId: { in: feedbackIds } } });
      await prisma.feedback.deleteMany({ where: { id: { in: feedbackIds } } });
    }
    if (agencyBProjectId) await prisma.project.delete({ where: { id: agencyBProjectId } });
    if (agencyBClientId) await prisma.client.delete({ where: { id: agencyBClientId } });
  });

  it('CLIENT submits feedback only for its own project and owns the resulting record', async () => {
    const created = await request(app)
      .post(`/api/v1/portal/projects/${ownProjectId}/feedback`)
      .set('Cookie', clientCookie)
      .send({ title: 'Checkout feedback', description: 'Please adjust the confirmation state.' });

    expect(created.status).toBe(201);
    expect(created.body.data.submittedBy).toBe(clientUserId);
    expect(created.body.data.clientId).toBe(clientId);
    feedbackIds.push(created.body.data.id);
    clientFeedbackId = created.body.data.id;

    const stored = await prisma.feedback.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(stored.submittedBy).toBe(clientUserId);

    const list = await request(app)
      .get(`/api/v1/portal/projects/${ownProjectId}/feedback`)
      .set('Cookie', clientCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.some((feedback: { id: string }) => feedback.id === created.body.data.id)).toBe(true);

    const event = await prisma.activityLog.findFirstOrThrow({
      where: { agencyId, entityId: created.body.data.id, eventType: 'feedback.submitted' },
    });
    expect(event.visibleToClient).toBe(true);
  });

  it('CLIENT cannot submit or list feedback for another client project, or read its comments', async () => {
    const submit = await request(app)
      .post(`/api/v1/portal/projects/${otherProjectId}/feedback`)
      .set('Cookie', clientCookie)
      .send({ title: 'Cross-client attempt', description: 'Must not be accepted.' });
    expect(submit.status).toBe(404);

    const list = await request(app)
      .get(`/api/v1/portal/projects/${otherProjectId}/feedback`)
      .set('Cookie', clientCookie);
    expect(list.status).toBe(404);

    const comments = await request(app)
      .get(`/api/v1/portal/feedback/${otherFeedbackId}/comments`)
      .set('Cookie', clientCookie);
    expect(comments.status).toBe(404);
  });

  it('CLIENT can post and read comments on its own feedback; workspace feedback routes return 403', async () => {
    const feedback = await prisma.feedback.create({
      data: {
        agencyId,
        projectId: ownProjectId,
        clientId,
        submittedBy: clientUserId,
        title: 'Own feedback comment fixture',
        description: 'Verify client comment authorship.',
      },
    });
    feedbackIds.push(feedback.id);

    const created = await request(app)
      .post(`/api/v1/portal/feedback/${feedback.id}/comments`)
      .set('Cookie', clientCookie)
      .send({ body: 'Additional detail from the client.' });
    expect(created.status).toBe(201);
    expect(created.body.data.authorId).toBe(clientUserId);

    const list = await request(app)
      .get(`/api/v1/portal/feedback/${feedback.id}/comments`)
      .set('Cookie', clientCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.some((comment: { id: string }) => comment.id === created.body.data.id)).toBe(true);

    const workspace = await request(app)
      .get(`/api/v1/projects/${ownProjectId}/feedback`)
      .set('Cookie', clientCookie);
    expect(workspace.status).toBe(403);
  });

  it('member feedback routes return 404 for projects outside the assignment set', async () => {
    const assignedProject = await request(app)
      .get(`/api/v1/projects/${ownProjectId}/feedback`)
      .set('Cookie', memberCookie);
    expect(assignedProject.status).toBe(200);

    const assignedComments = await request(app)
      .get(`/api/v1/feedback/${clientFeedbackId}/comments`)
      .set('Cookie', memberCookie);
    expect(assignedComments.status).toBe(200);

    const list = await request(app)
      .get(`/api/v1/projects/${otherProjectId}/feedback`)
      .set('Cookie', memberCookie);
    expect(list.status).toBe(404);

    const comments = await request(app)
      .get(`/api/v1/feedback/${otherFeedbackId}/comments`)
      .set('Cookie', memberCookie);
    expect(comments.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/v1/feedback/${otherFeedbackId}`)
      .set('Cookie', memberCookie)
      .send({ status: 'RESOLVED' });
    expect(patch.status).toBe(404);
  });

  it('workspace status changes and replies are visible to the client; support mode is read-only', async () => {
    const feedback = await prisma.feedback.create({
      data: {
        agencyId,
        projectId: ownProjectId,
        clientId,
        submittedBy: clientUserId,
        title: 'Workspace status fixture',
        description: 'Verify status audit and reply APIs.',
      },
    });
    feedbackIds.push(feedback.id);

    const list = await request(app)
      .get(`/api/v1/projects/${ownProjectId}/feedback`)
      .set('Cookie', adminCookie);
    expect(list.status).toBe(200);

    const patch = await request(app)
      .patch(`/api/v1/feedback/${feedback.id}`)
      .set('Cookie', adminCookie)
      .send({ status: 'IN_REVIEW' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('IN_REVIEW');

    const event = await prisma.activityLog.findFirstOrThrow({
      where: { agencyId, entityId: feedback.id, eventType: 'feedback.status_changed' },
    });
    expect(event.visibleToClient).toBe(true);

    const dashboard = await request(app).get('/api/v1/dashboard').set('Cookie', adminCookie);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.feedback.pending).toBeGreaterThan(0);

    const reply = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/comments`)
      .set('Cookie', adminCookie)
      .send({ body: 'We will investigate this.' });
    expect(reply.status).toBe(201);

    const supportGet = await request(app)
      .get(`/api/v1/projects/${ownProjectId}/feedback`)
      .set('Cookie', supportCookie);
    expect(supportGet.status).toBe(200);

    const supportPatch = await request(app)
      .patch(`/api/v1/feedback/${feedback.id}`)
      .set('Cookie', supportCookie)
      .send({ status: 'RESOLVED' });
    expect(supportPatch.status).toBe(403);
    expect(supportPatch.body.error.code).toBe('SUPPORT_READ_ONLY');

    const supportComment = await request(app)
      .post(`/api/v1/feedback/${feedback.id}/comments`)
      .set('Cookie', supportCookie)
      .send({ body: 'Support write attempt.' });
    expect(supportComment.status).toBe(403);
    expect(supportComment.body.error.code).toBe('SUPPORT_READ_ONLY');
  });

  it('agency feedback inbox is tenant and member scoped; portal inbox is client scoped', async () => {
    const ownFeedback = await prisma.feedback.create({
      data: { agencyId, projectId: ownProjectId, clientId, submittedBy: clientUserId, title: 'Inbox own fixture', description: 'Own agency feedback.' },
    });
    feedbackIds.push(ownFeedback.id);

    const agencyB = await prisma.agency.findUniqueOrThrow({ where: { slug: 'apex-creative' } });
    const adminB = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@apex.test' } });
    const clientB = await prisma.client.create({
      data: { agencyId: agencyB.id, companyName: 'Inbox Agency B Client', contactName: 'Fixture', email: `inbox-${Date.now()}@example.test` },
    });
    agencyBClientId = clientB.id;
    const projectB = await prisma.project.create({
      data: { agencyId: agencyB.id, clientId: clientB.id, managerId: adminB.id, name: 'Inbox Agency B Project' },
    });
    agencyBProjectId = projectB.id;
    const foreignFeedback = await prisma.feedback.create({
      data: { agencyId: agencyB.id, projectId: projectB.id, clientId: clientB.id, submittedBy: adminB.id, title: 'Foreign inbox fixture', description: 'Must remain private.' },
    });
    feedbackIds.push(foreignFeedback.id);

    const adminList = await request(app).get('/api/v1/feedback').set('Cookie', adminCookie);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.some((item: { id: string }) => item.id === ownFeedback.id)).toBe(true);
    expect(adminList.body.data.some((item: { id: string }) => item.id === foreignFeedback.id)).toBe(false);

    const memberList = await request(app).get('/api/v1/feedback?status=OPEN').set('Cookie', memberCookie);
    expect(memberList.status).toBe(200);
    expect(memberList.body.data.some((item: { id: string }) => item.id === ownFeedback.id)).toBe(true);
    expect(memberList.body.data.some((item: { id: string }) => item.id === otherFeedbackId)).toBe(false);

    const portalList = await request(app).get('/api/v1/portal/feedback').set('Cookie', clientCookie);
    expect(portalList.status).toBe(200);
    expect(portalList.body.data.some((item: { id: string }) => item.id === ownFeedback.id)).toBe(true);
    expect(portalList.body.data.some((item: { id: string }) => item.id === otherFeedbackId)).toBe(false);

    const clientWorkspaceList = await request(app).get('/api/v1/feedback').set('Cookie', clientCookie);
    expect(clientWorkspaceList.status).toBe(403);
  });
});