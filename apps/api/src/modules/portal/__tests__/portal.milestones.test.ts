import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ApprovalStatus, MilestoneStatus } from '@prisma/client';
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

describe('Portal milestone approval HTTP isolation', () => {
  let agencyId: string;
  let clientId: string;
  let clientUserId: string;
  let ownProjectId: string;
  let otherProjectId: string;
  let otherAgencyId: string;
  let otherAgencyProjectId: string;
  let fixtureClientId: string;
  let ownMilestoneId: string;
  let otherClientMilestoneId: string;
  let otherAgencyMilestoneId: string;
  let nonPendingMilestoneId: string;
  let staffMilestoneId: string;
  let transitionMilestoneId: string;
  let requestMilestoneId: string;
  let clientCookie: string;
  let adminCookie: string;
  const activityIds: string[] = [];
  const testAgencyIds: string[] = [];

  beforeAll(async () => {
    const agency = await prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } });
    agencyId = agency.id;
    const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@nike.test' } });
    const otherClientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@adidas.test' } });
    clientId = clientUser.clientId!;
    clientUserId = clientUser.id;
    ownProjectId = (await prisma.project.findFirstOrThrow({ where: { agencyId, clientId } })).id;
    otherProjectId = (await prisma.project.findFirstOrThrow({ where: { agencyId, clientId: otherClientUser.clientId! } })).id;

    const otherAgency = await prisma.agency.findFirst({ where: { id: { not: agencyId } } });
    if (otherAgency) {
      otherAgencyId = otherAgency.id;
    } else {
      const createdAgency = await prisma.agency.create({
        data: { name: 'Approval Isolation Agency', slug: `approval-isolation-${Date.now()}`, ownerName: 'Fixture', contactEmail: 'approval-isolation@example.test' },
      });
      otherAgencyId = createdAgency.id;
      testAgencyIds.push(createdAgency.id);
    }
    const fixtureClient = await prisma.client.create({
      data: { agencyId: otherAgencyId, companyName: 'Approval Isolation Client', contactName: 'Fixture', email: `approval-isolation-${Date.now()}@example.test` },
    });
    fixtureClientId = fixtureClient.id;
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } });
    const otherProject = await prisma.project.create({
      data: { agencyId: otherAgencyId, clientId: fixtureClient.id, managerId: admin.id, name: 'Approval Isolation Project' },
    });
    otherAgencyProjectId = otherProject.id;

    const createMilestone = (projectId: string, approvalStatus: ApprovalStatus) => prisma.milestone.create({
      data: { agencyId: projectId === otherAgencyProjectId ? otherAgencyId : agencyId, projectId, title: 'Approval fixture', status: MilestoneStatus.DONE, requiresClientApproval: true, approvalStatus },
    });
    const [own, otherClient, otherAgencyMilestone, nonPending, staff] = await Promise.all([
      createMilestone(ownProjectId, ApprovalStatus.PENDING),
      createMilestone(otherProjectId, ApprovalStatus.PENDING),
      createMilestone(otherAgencyProjectId, ApprovalStatus.PENDING),
      createMilestone(ownProjectId, ApprovalStatus.NONE),
      createMilestone(ownProjectId, ApprovalStatus.PENDING),
    ]);
    ownMilestoneId = own.id;
    otherClientMilestoneId = otherClient.id;
    otherAgencyMilestoneId = otherAgencyMilestone.id;
    nonPendingMilestoneId = nonPending.id;
    staffMilestoneId = staff.id;
    const [transitionMilestone, requestMilestone] = await Promise.all([
      prisma.milestone.create({ data: { agencyId, projectId: ownProjectId, title: 'Completion transition fixture', status: 'PENDING', requiresClientApproval: true, approvalStatus: 'NONE' } }),
      prisma.milestone.create({ data: { agencyId, projectId: ownProjectId, title: 'Approval request fixture', status: 'PENDING', requiresClientApproval: true, approvalStatus: 'NONE' } }),
    ]);
    transitionMilestoneId = transitionMilestone.id;
    requestMilestoneId = requestMilestone.id;
    clientCookie = await loginAs(clientUser.email);
    adminCookie = await loginAs('admin@acme.test');
  });

  afterAll(async () => {
    const milestoneIds = [ownMilestoneId, otherClientMilestoneId, otherAgencyMilestoneId, nonPendingMilestoneId, staffMilestoneId, transitionMilestoneId, requestMilestoneId].filter(Boolean);
    if (milestoneIds.length) await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });
    if (activityIds.length) await prisma.activityLog.deleteMany({ where: { id: { in: activityIds } } });
    if (otherAgencyProjectId) await prisma.project.delete({ where: { id: otherAgencyProjectId } });
    if (fixtureClientId) await prisma.client.delete({ where: { id: fixtureClientId } });
    for (const id of testAgencyIds) await prisma.agency.delete({ where: { id } });
  });

  it('client approves an owned pending milestone and writes a visible activity row', async () => {
    const expectedPending = await prisma.milestone.count({
      where: { agencyId, approvalStatus: 'PENDING', project: { is: { agencyId, clientId } } },
    });
    const overview = await request(app).get('/api/v1/portal/overview').set('Cookie', clientCookie);
    expect(overview.status).toBe(200);
    expect(overview.body.data.pendingApprovals).toBe(expectedPending);

    const list = await request(app).get(`/api/v1/portal/projects/${ownProjectId}/milestones`).set('Cookie', clientCookie);
    expect(list.status).toBe(200);
    expect(list.body.data.find((milestone: { id: string }) => milestone.id === ownMilestoneId).approvalStatus).toBe('PENDING');

    const response = await request(app)
      .post(`/api/v1/portal/milestones/${ownMilestoneId}/approve`)
      .set('Cookie', clientCookie)
      .send({ decision: 'APPROVED' });
    expect(response.status).toBe(200);
    expect(response.body.data.approvalStatus).toBe('APPROVED');
    expect(response.body.data.approvedBy).toBe(clientUserId);
    expect(response.body.data.approvedAt).toBeTruthy();

    const repeatedDone = await request(app)
      .patch(`/api/v1/milestones/${ownMilestoneId}`)
      .set('Cookie', adminCookie)
      .send({ status: 'DONE' });
    expect(repeatedDone.status).toBe(200);
    expect(repeatedDone.body.data.approvalStatus).toBe('APPROVED');
    expect(repeatedDone.body.data.approvedBy).toBe(clientUserId);

    const event = await prisma.activityLog.findFirstOrThrow({
      where: { agencyId, entityId: ownMilestoneId, eventType: 'milestone.approved' },
    });
    activityIds.push(event.id);
    expect(event.visibleToClient).toBe(true);
  });

  it('client cannot approve another client milestone in the same agency and leaves it unchanged', async () => {
    const otherProjectMilestones = await request(app)
      .get(`/api/v1/portal/projects/${otherProjectId}/milestones`)
      .set('Cookie', clientCookie);
    expect(otherProjectMilestones.status).toBe(404);

    const response = await request(app)
      .post(`/api/v1/portal/milestones/${otherClientMilestoneId}/approve`)
      .set('Cookie', clientCookie)
      .send({ decision: 'APPROVED' });
    expect(response.status).toBe(404);
    expect(await prisma.milestone.findUniqueOrThrow({ where: { id: otherClientMilestoneId } })).toMatchObject({ approvalStatus: 'PENDING', approvedBy: null });
  });

  it('client cannot approve another agency milestone', async () => {
    const response = await request(app)
      .post(`/api/v1/portal/milestones/${otherAgencyMilestoneId}/approve`)
      .set('Cookie', clientCookie)
      .send({ decision: 'APPROVED' });
    expect(response.status).toBe(404);
    expect(await prisma.milestone.findUniqueOrThrow({ where: { id: otherAgencyMilestoneId } })).toMatchObject({ approvalStatus: 'PENDING', approvedBy: null });
  });

  it('rejects non-pending and already decided milestones with 409', async () => {
    const nonPending = await request(app)
      .post(`/api/v1/portal/milestones/${nonPendingMilestoneId}/approve`)
      .set('Cookie', clientCookie)
      .send({ decision: 'CHANGES_REQUESTED', comment: 'Please revise.' });
    expect(nonPending.status).toBe(409);

    const duplicate = await request(app)
      .post(`/api/v1/portal/milestones/${ownMilestoneId}/approve`)
      .set('Cookie', clientCookie)
      .send({ decision: 'APPROVED' });
    expect(duplicate.status).toBe(409);
  });

  it('blocks client workspace PATCH and staff-selected client decisions', async () => {
    const clientPatch = await request(app)
      .patch(`/api/v1/milestones/${staffMilestoneId}`)
      .set('Cookie', clientCookie)
      .send({ status: 'DONE' });
    expect(clientPatch.status).toBe(403);

    const staffDecision = await request(app)
      .patch(`/api/v1/milestones/${staffMilestoneId}`)
      .set('Cookie', adminCookie)
      .send({ approvalStatus: 'APPROVED' });
    expect(staffDecision.status).toBe(422);
    expect(await prisma.milestone.findUniqueOrThrow({ where: { id: staffMilestoneId } })).toMatchObject({ approvalStatus: 'PENDING', approvedBy: null });

    const turnOff = await request(app)
      .patch(`/api/v1/milestones/${staffMilestoneId}`)
      .set('Cookie', adminCookie)
      .send({ requiresClientApproval: false });
    expect(turnOff.status).toBe(200);
    expect(turnOff.body.data.approvalStatus).toBe('NONE');

    const turnOnForDone = await request(app)
      .patch(`/api/v1/milestones/${staffMilestoneId}`)
      .set('Cookie', adminCookie)
      .send({ requiresClientApproval: true });
    expect(turnOnForDone.status).toBe(200);
    expect(turnOnForDone.body.data.approvalStatus).toBe('PENDING');

    const completion = await request(app)
      .patch(`/api/v1/milestones/${transitionMilestoneId}`)
      .set('Cookie', adminCookie)
      .send({ status: 'DONE' });
    expect(completion.status).toBe(200);
    expect(completion.body.data.approvalStatus).toBe('PENDING');

    const requestApproval = await request(app)
      .patch(`/api/v1/milestones/${requestMilestoneId}`)
      .set('Cookie', adminCookie)
      .send({ approvalStatus: 'PENDING' });
    expect(requestApproval.status).toBe(200);
    expect(requestApproval.body.data.approvalStatus).toBe('PENDING');
  });

  it('client requests changes and writes a visible milestone.changes_requested event', async () => {
    await prisma.milestone.update({ where: { id: nonPendingMilestoneId }, data: { approvalStatus: 'PENDING' } });
    const response = await request(app)
      .post(`/api/v1/portal/milestones/${nonPendingMilestoneId}/approve`)
      .set('Cookie', clientCookie)
      .send({ decision: 'CHANGES_REQUESTED', comment: 'Please revise the delivery.' });
    expect(response.status).toBe(200);
    expect(response.body.data.approvalStatus).toBe('CHANGES_REQUESTED');
    expect(response.body.data.approvedBy).toBe(clientUserId);

    const event = await prisma.activityLog.findFirstOrThrow({
      where: { agencyId, entityId: nonPendingMilestoneId, eventType: 'milestone.changes_requested' },
    });
    activityIds.push(event.id);
    expect(event.visibleToClient).toBe(true);
    expect(event.metadata).toMatchObject({ comment: 'Please revise the delivery.' });
  });
});