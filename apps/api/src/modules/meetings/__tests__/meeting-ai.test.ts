import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../app';
import { env } from '../../../config/env';
import { prisma } from '../../../lib/prisma';
import { SUPPORT_COOKIE_NAME } from '../../../lib/jwt';

const { mockCreate, mockConstructor } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockConstructor: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };

    constructor(options: unknown) {
      mockConstructor(options);
    }
  },
}));

const PASSWORD = 'Password123!';
const MEETING_NOTES = 'Discussed the revised checkout flow and agreed to validate it with customers.';
const validSummary = {
  summary: 'The team reviewed the checkout flow and agreed to validate the revision.',
  decisions: ['Run customer validation before release.'],
  actionItems: [
    { title: 'Prepare validation prototype', assigneeHint: 'Mark Miller (Member)', dueDate: '2026-10-15' },
    { title: 'Confirm research participants', assigneeHint: 'No matching teammate', dueDate: null },
  ],
};

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [response.headers['set-cookie']];
  const tokenCookie = cookies.find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie returned for ${email}`);
  return tokenCookie.split(';')[0];
}

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('Meeting AI summary HTTP access and behavior', () => {
  let agencyAId: string;
  let agencyBId: string;
  let projectAId: string;
  let unassignedProjectId: string;
  let projectBId: string;
  let meetingAId: string;
  let meetingUnassignedId: string;
  let meetingBId: string;
  let memberId: string;
  let adminCookie: string;
  let memberCookie: string;
  let clientCookie: string;
  let supportCookie: string;
  let previousApiKey: string | undefined;
  const projectIds: string[] = [];
  const meetingIds: string[] = [];
  const taskIds: string[] = [];
  const clientIds: string[] = [];

  beforeAll(async () => {
    previousApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';

    const agencyA = await prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } });
    const agencyB = await prisma.agency.findUniqueOrThrow({ where: { slug: 'apex-creative' } });
    agencyAId = agencyA.id;
    agencyBId = agencyB.id;

    const adminA = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } });
    const adminB = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@apex.test' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@acme.test' } });
    const clientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'client@nike.test' } });
    const superAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@agencyhub.test' } });
    memberId = member.id;

    const clientA = await prisma.client.create({
      data: { agencyId: agencyAId, companyName: 'AI Summary Client A', contactName: 'AI Client A', email: `ai-a-${Date.now()}@example.test` },
    });
    const clientA2 = await prisma.client.create({
      data: { agencyId: agencyAId, companyName: 'AI Summary Client B', contactName: 'AI Client B', email: `ai-b-${Date.now()}@example.test` },
    });
    const clientB = await prisma.client.create({
      data: { agencyId: agencyBId, companyName: 'AI Summary Agency B', contactName: 'AI Client C', email: `ai-c-${Date.now()}@example.test` },
    });
    clientIds.push(clientA.id, clientA2.id, clientB.id);

    const projectA = await prisma.project.create({
      data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminA.id, name: 'AI Summary Project A' },
    });
    const unassignedProject = await prisma.project.create({
      data: { agencyId: agencyAId, clientId: clientA2.id, managerId: adminA.id, name: 'AI Unassigned Project' },
    });
    const projectB = await prisma.project.create({
      data: { agencyId: agencyBId, clientId: clientB.id, managerId: adminB.id, name: 'AI Summary Project B' },
    });
    projectAId = projectA.id;
    unassignedProjectId = unassignedProject.id;
    projectBId = projectB.id;
    projectIds.push(projectAId, unassignedProjectId, projectBId);

    await prisma.projectMember.create({ data: { agencyId: agencyAId, projectId: projectAId, userId: memberId } });

    const meetingA = await prisma.meeting.create({
      data: {
        agencyId: agencyAId,
        projectId: projectAId,
        title: 'Sensitive Meeting Title Not Sent To AI',
        meetingDate: new Date(),
        notes: MEETING_NOTES,
        createdBy: adminA.id,
      },
    });
    const meetingUnassigned = await prisma.meeting.create({
      data: {
        agencyId: agencyAId,
        projectId: unassignedProjectId,
        title: 'Unassigned Project Meeting',
        meetingDate: new Date(),
        notes: 'This note must not be sent.',
        createdBy: adminA.id,
      },
    });
    const meetingB = await prisma.meeting.create({
      data: {
        agencyId: agencyBId,
        projectId: projectBId,
        title: 'Agency B Meeting',
        meetingDate: new Date(),
        notes: 'Agency B private notes.',
        createdBy: adminB.id,
      },
    });
    meetingAId = meetingA.id;
    meetingUnassignedId = meetingUnassigned.id;
    meetingBId = meetingB.id;
    meetingIds.push(meetingAId, meetingUnassignedId, meetingBId);

    adminCookie = await loginAs('admin@acme.test');
    memberCookie = await loginAs('member@acme.test');
    clientCookie = await loginAs(clientUser.email);
    const superAdminCookie = await loginAs('superadmin@agencyhub.test');
    const supportToken = jwt.sign(
      { superAdminId: superAdmin.id, supportAgencyId: agencyAId, supportAgencyName: 'Acme' },
      env.JWT_SECRET,
      { expiresIn: '30m', issuer: 'agencyhub-support', audience: 'agencyhub-app' },
    );
    supportCookie = `${superAdminCookie}; ${SUPPORT_COOKIE_NAME}=${supportToken}`;
  });

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';
    mockCreate.mockReset();
    mockConstructor.mockClear();
  });

  afterAll(async () => {
    if (taskIds.length) await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    if (meetingIds.length) {
      await prisma.activityLog.deleteMany({ where: { entityId: { in: meetingIds } } });
      await prisma.meeting.deleteMany({ where: { id: { in: meetingIds } } });
    }
    if (projectIds.length) {
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    if (clientIds.length) await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    if (previousApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousApiKey;
  });

  it('generates, validates, persists, and audits a summary; selected action items create scoped tasks', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify(validSummary)));

    const response = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(validSummary);
    expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({ timeout: 20_000, maxRetries: 0 }));

    const call = mockCreate.mock.calls[0][0];
    expect(call.messages[0].content).toBe(JSON.stringify({ projectName: 'AI Summary Project A', notes: MEETING_NOTES }));
    expect(call.messages[0].content).not.toContain('Sensitive Meeting Title');

    const savedMeeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingAId } });
    expect(savedMeeting.aiSummary).toMatchObject(validSummary);
    const summaryEvent = await prisma.activityLog.findFirstOrThrow({
      where: { agencyId: agencyAId, entityId: meetingAId, eventType: 'meeting.ai_summarized' },
    });
    expect(summaryEvent.visibleToClient).toBe(false);

    const member = await prisma.user.findUniqueOrThrow({ where: { id: memberId } });
    const created = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary/create-tasks`)
      .set('Cookie', adminCookie)
      .send({ items: validSummary.actionItems });
    expect(created.status).toBe(201);
    expect(created.body.data).toHaveLength(2);
    taskIds.push(...created.body.data.map((task: { id: string }) => task.id));
    const assignedTask = await prisma.task.findUniqueOrThrow({ where: { id: created.body.data[0].id } });
    const unassignedTask = await prisma.task.findUniqueOrThrow({ where: { id: created.body.data[1].id } });
    expect(assignedTask.assigneeId).toBe(member.id);
    expect(unassignedTask.assigneeId).toBeNull();

    for (const task of created.body.data as Array<{ id: string }>) {
      await expect(prisma.activityLog.findFirst({ where: { agencyId: agencyAId, entityId: task.id, eventType: 'task.created' } })).resolves.not.toBeNull();
    }
  });

  it('retries exactly once when the model returns invalid JSON, then accepts valid JSON', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse('not JSON'))
      .mockResolvedValueOnce(textResponse(JSON.stringify(validSummary)));

    const response = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('returns a friendly 502 after a timeout or two invalid responses', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Request timed out'));
    const timeout = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', adminCookie);
    expect(timeout.status).toBe(502);
    expect(timeout.body.error.code).toBe('AI_ERROR');
    expect(timeout.body.error.message).toMatch(/timed out/i);

    mockCreate.mockClear();
    mockCreate
      .mockResolvedValueOnce(textResponse('{'))
      .mockResolvedValueOnce(textResponse('{'));
    const invalid = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', adminCookie);
    expect(invalid.status).toBe(502);
    expect(invalid.body.error.message).toMatch(/invalid summary/i);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('returns AI_NOT_CONFIGURED when the key is missing without constructing a client', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', adminCookie);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_NOT_CONFIGURED');
    expect(mockConstructor).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('Scenario 12: Agency A cannot summarize or create tasks from Agency B meeting; model is never called', async () => {
    const summary = await request(app)
      .post(`/api/v1/meetings/${meetingBId}/ai-summary`)
      .set('Cookie', adminCookie);
    expect(summary.status).toBe(404);

    const tasks = await request(app)
      .post(`/api/v1/meetings/${meetingBId}/ai-summary/create-tasks`)
      .set('Cookie', adminCookie)
      .send({ items: [validSummary.actionItems[0]] });
    expect(tasks.status).toBe(404);
    expect(mockConstructor).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('member on an unassigned project gets 404; CLIENT and support-mode writes get 403', async () => {
    const memberSummary = await request(app)
      .post(`/api/v1/meetings/${meetingUnassignedId}/ai-summary`)
      .set('Cookie', memberCookie);
    expect(memberSummary.status).toBe(404);
    const memberTasks = await request(app)
      .post(`/api/v1/meetings/${meetingUnassignedId}/ai-summary/create-tasks`)
      .set('Cookie', memberCookie)
      .send({ items: [validSummary.actionItems[0]] });
    expect(memberTasks.status).toBe(404);

    const clientSummary = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', clientCookie);
    expect(clientSummary.status).toBe(403);
    const clientTasks = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary/create-tasks`)
      .set('Cookie', clientCookie)
      .send({ items: [validSummary.actionItems[0]] });
    expect(clientTasks.status).toBe(403);

    const supportSummary = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary`)
      .set('Cookie', supportCookie);
    expect(supportSummary.status).toBe(403);
    expect(supportSummary.body.error.code).toBe('SUPPORT_READ_ONLY');
    const supportTasks = await request(app)
      .post(`/api/v1/meetings/${meetingAId}/ai-summary/create-tasks`)
      .set('Cookie', supportCookie)
      .send({ items: [validSummary.actionItems[0]] });
    expect(supportTasks.status).toBe(403);
    expect(supportTasks.body.error.code).toBe('SUPPORT_READ_ONLY');
    expect(mockConstructor).not.toHaveBeenCalled();
  });
});