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

describe('Dashboard deadline HTTP scoping', () => {
  let agencyAId: string;
  let agencyBId: string;
  let adminAId: string;
  let adminBId: string;
  let memberAId: string;
  let projectAId: string;
  let unassignedProjectAId: string;
  let projectBId: string;
  let taskAId: string;
  let milestoneAId: string;
  let taskUnassignedId: string;
  let milestoneUnassignedId: string;
  let taskBId: string;
  let milestoneBId: string;
  let adminACookie: string;
  let adminBCookie: string;
  let memberACookie: string;

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
    adminAId = adminA.id;
    adminBId = adminB.id;
    memberAId = memberA.id;
    const [clientA, clientB] = await Promise.all([
      prisma.client.findFirstOrThrow({ where: { agencyId: agencyAId } }),
      prisma.client.findFirstOrThrow({ where: { agencyId: agencyBId } }),
    ]);
    const [projectA, unassignedProjectA, projectB] = await Promise.all([
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminAId, name: 'Deadline assigned project' } }),
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminAId, name: 'Deadline unassigned project' } }),
      prisma.project.create({ data: { agencyId: agencyBId, clientId: clientB.id, managerId: adminBId, name: 'Deadline Agency B project' } }),
    ]);
    projectAId = projectA.id;
    unassignedProjectAId = unassignedProjectA.id;
    projectBId = projectB.id;
    await prisma.projectMember.create({ data: { agencyId: agencyAId, projectId: projectAId, userId: memberAId } });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);
    const [taskA, milestoneA, taskUnassigned, milestoneUnassigned, taskB, milestoneB] = await Promise.all([
      prisma.task.create({ data: { agencyId: agencyAId, projectId: projectAId, title: 'Agency A assigned deadline task', dueDate, createdBy: adminAId } }),
      prisma.milestone.create({ data: { agencyId: agencyAId, projectId: projectAId, title: 'Agency A assigned deadline milestone', dueDate } }),
      prisma.task.create({ data: { agencyId: agencyAId, projectId: unassignedProjectAId, title: 'Agency A unassigned deadline task', dueDate, createdBy: adminAId } }),
      prisma.milestone.create({ data: { agencyId: agencyAId, projectId: unassignedProjectAId, title: 'Agency A unassigned deadline milestone', dueDate } }),
      prisma.task.create({ data: { agencyId: agencyBId, projectId: projectBId, title: 'Agency B private deadline task', dueDate, createdBy: adminBId } }),
      prisma.milestone.create({ data: { agencyId: agencyBId, projectId: projectBId, title: 'Agency B private deadline milestone', dueDate } }),
    ]);
    taskAId = taskA.id;
    milestoneAId = milestoneA.id;
    taskUnassignedId = taskUnassigned.id;
    milestoneUnassignedId = milestoneUnassigned.id;
    taskBId = taskB.id;
    milestoneBId = milestoneB.id;
    [adminACookie, adminBCookie, memberACookie] = await Promise.all([
      loginAs('admin@acme.test'), loginAs('admin@apex.test'), loginAs('member@acme.test'),
    ]);
  });

  afterAll(async () => {
    const taskIds = [taskAId, taskUnassignedId, taskBId].filter(Boolean);
    const milestoneIds = [milestoneAId, milestoneUnassignedId, milestoneBId].filter(Boolean);
    if (taskIds.length) await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    if (milestoneIds.length) await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });
    if (projectAId || unassignedProjectAId) await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectAId, unassignedProjectAId].filter(Boolean) } } });
    const projectIds = [projectAId, unassignedProjectAId, projectBId].filter(Boolean);
    if (projectIds.length) await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  });

  it('returns only agency deadlines, with a positive control in the owning agency', async () => {
    const agencyA = await request(app).get('/api/v1/dashboard').set('Cookie', adminACookie);
    const agencyB = await request(app).get('/api/v1/dashboard').set('Cookie', adminBCookie);
    expect(agencyA.status).toBe(200);
    expect(agencyB.status).toBe(200);
    const agencyAIds = agencyA.body.data.upcomingDeadlines.map((item: { id: string }) => item.id);
    const agencyBIds = agencyB.body.data.upcomingDeadlines.map((item: { id: string }) => item.id);
    expect(agencyAIds).toContain(taskAId);
    expect(agencyAIds).toContain(milestoneAId);
    expect(agencyAIds).not.toContain(taskBId);
    expect(agencyAIds).not.toContain(milestoneBId);
    expect(agencyBIds).toContain(taskBId);
    expect(agencyBIds).toContain(milestoneBId);
  });

  it('limits member deadlines to assigned projects', async () => {
    const response = await request(app).get('/api/v1/dashboard').set('Cookie', memberACookie);
    expect(response.status).toBe(200);
    const ids = response.body.data.upcomingDeadlines.map((item: { id: string }) => item.id);
    expect(ids).toContain(taskAId);
    expect(ids).toContain(milestoneAId);
    expect(ids).not.toContain(taskUnassignedId);
    expect(ids).not.toContain(milestoneUnassignedId);
  });
});