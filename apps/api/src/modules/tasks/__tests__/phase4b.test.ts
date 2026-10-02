/**
 * Phase 4B Comprehensive Backend Verification Suite
 *
 * Requirements covered (STEP 6):
 * - Scenario 11: Task create FK & cross-agency validation
 * - Scenario 8: Project access matrix for member (tasks, milestones, meetings, comments)
 * - Scenario 4: CLIENT token access blocked with 403 across internal endpoints
 * - Support Mode: Read access allowed, mutation blocked with 403 SUPPORT_READ_ONLY
 * - Derived values: Project progress formula, task overdue/due soon boundaries
 * - Dashboard: Isolation across agencies, scoped counts for members
 * - Cross-agency comment create & meeting GET/PATCH -> 404
 * - completed_at lifecycle (set on DONE, cleared when leaving DONE)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { MilestoneStatus, UserRole } from '@prisma/client';

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

describe('Phase 4B Full Specification Test Suite (STEP 6)', () => {
  let agencyA: any;
  let agencyB: any;
  let adminA: any;
  let memberA: any;
  let adminB: any;
  let clientUserA: any;
  let superAdmin: any;

  let adminACookie: string;
  let memberACookie: string;
  let clientCookie: string;
  let superAdminCookie: string;

  let projectA: any;
  let projectB: any;
  let testClientA: any;

  beforeAll(async () => {
    await prisma.$connect();

    agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    agencyB = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });

    adminA = await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: UserRole.AGENCY_ADMIN } });
    memberA = await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: UserRole.AGENCY_MEMBER } });
    adminB = await prisma.user.findFirst({ where: { agencyId: agencyB.id, role: UserRole.AGENCY_ADMIN } });
    clientUserA = await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: UserRole.CLIENT } });
    superAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });

    testClientA = await prisma.client.findFirst({ where: { agencyId: agencyA.id } });
    projectA = await prisma.project.findFirst({ where: { agencyId: agencyA.id } });
    projectB = await prisma.project.findFirst({ where: { agencyId: agencyB.id } });

    adminACookie = await loginAs(adminA.email);
    memberACookie = await loginAs(memberA.email);
    clientCookie = await loginAs(clientUserA.email);
    superAdminCookie = await loginAs(superAdmin.email);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── Scenario 11: Task Creation FK Validation ─────────────────────────────────
  describe('Scenario 11: Task Creation FK & Cross-Agency Validation', () => {
    it('rejects task create with Project ID belonging to Agency B -> 404 NOT_FOUND', async () => {
      const beforeCount = await prisma.task.count({ where: { projectId: projectB.id } });

      const res = await request(app)
        .post(`/api/v1/projects/${projectB.id}/tasks`)
        .set('Cookie', adminACookie)
        .send({
          title: 'Cross-agency project task injection',
          priority: 'MEDIUM',
        });

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');

      const afterCount = await prisma.task.count({ where: { projectId: projectB.id } });
      expect(afterCount).toBe(beforeCount);
    });

    it('rejects milestone_id from another project in the same agency -> 404 NOT_FOUND', async () => {
      // Create project 2 in Agency A
      const otherProject = await prisma.project.create({
        data: {
          agencyId: agencyA.id,
          clientId: testClientA.id,
          managerId: adminA.id,
          name: `Other Project A ${Date.now()}`,
          status: 'ACTIVE',
          priority: 'MEDIUM',
        },
      });

      // Create milestone in other project
      const foreignMilestone = await prisma.milestone.create({
        data: {
          agencyId: agencyA.id,
          projectId: otherProject.id,
          title: 'Foreign Milestone',
          status: MilestoneStatus.PENDING,
        },
      });

      const beforeCount = await prisma.task.count({ where: { projectId: projectA.id } });

      const res = await request(app)
        .post(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', adminACookie)
        .send({
          title: 'Task with mismatched milestone',
          milestoneId: foreignMilestone.id,
        });

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');

      const afterCount = await prisma.task.count({ where: { projectId: projectA.id } });
      expect(afterCount).toBe(beforeCount);

      // Clean up
      await prisma.milestone.delete({ where: { id: foreignMilestone.id } });
      await prisma.project.delete({ where: { id: otherProject.id } });
    });

    it('rejects assignee from Agency B -> 404 NOT_FOUND', async () => {
      const beforeCount = await prisma.task.count({ where: { projectId: projectA.id } });

      const res = await request(app)
        .post(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', adminACookie)
        .send({
          title: 'Task with cross-agency assignee',
          assigneeId: adminB.id,
        });

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');

      const afterCount = await prisma.task.count({ where: { projectId: projectA.id } });
      expect(afterCount).toBe(beforeCount);
    });

    it('rejects assignee with CLIENT role -> rejected; nothing written', async () => {
      const beforeCount = await prisma.task.count({ where: { projectId: projectA.id } });

      const res = await request(app)
        .post(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', adminACookie)
        .send({
          title: 'Task assigned to portal client user',
          assigneeId: clientUserA.id,
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.error?.code).toMatch(/VALIDATION/);
      expect(res.body.error?.message).toContain('active agency staff member');

      const afterCount = await prisma.task.count({ where: { projectId: projectA.id } });
      expect(afterCount).toBe(beforeCount);
    });

    it('positive control: valid task create writes to database -> 201', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', adminACookie)
        .send({
          title: 'Valid Scenario 11 Task',
          priority: 'HIGH',
          assigneeId: memberA.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Valid Scenario 11 Task');

      // Verify row in database
      const dbTask = await prisma.task.findUnique({ where: { id: res.body.data.id } });
      expect(dbTask).not.toBeNull();
      expect(dbTask?.agencyId).toBe(agencyA.id);

      // Clean up
      await prisma.task.delete({ where: { id: res.body.data.id } });
    });
  });

  // ─── Scenario 8: Project Access Matrix for Member ─────────────────────────────
  describe('Scenario 8: Member Access Matrix on Tasks, Milestones, Meetings, Comments', () => {
    let unassignedProject: any;
    let unassignedTask: any;
    let unassignedMilestone: any;
    let unassignedMeeting: any;

    let assignedProject: any;

    beforeAll(async () => {
      // Create project where memberA is NOT assigned and NOT manager
      unassignedProject = await prisma.project.create({
        data: {
          agencyId: agencyA.id,
          clientId: testClientA.id,
          managerId: adminA.id,
          name: `Unassigned Project ${Date.now()}`,
          status: 'ACTIVE',
          priority: 'MEDIUM',
        },
      });

      unassignedTask = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: unassignedProject.id,
          title: 'Unassigned Task',
          status: 'TODO',
          priority: 'LOW',
          createdBy: adminA.id,
        },
      });

      unassignedMilestone = await prisma.milestone.create({
        data: {
          agencyId: agencyA.id,
          projectId: unassignedProject.id,
          title: 'Unassigned Milestone',
          status: MilestoneStatus.PENDING,
        },
      });

      unassignedMeeting = await prisma.meeting.create({
        data: {
          agencyId: agencyA.id,
          projectId: unassignedProject.id,
          title: 'Unassigned Meeting',
          meetingDate: new Date(),
          createdBy: adminA.id,
        },
      });

      // Create project where memberA IS assigned as a project member
      assignedProject = await prisma.project.create({
        data: {
          agencyId: agencyA.id,
          clientId: testClientA.id,
          managerId: adminA.id,
          name: `Assigned Project ${Date.now()}`,
          status: 'ACTIVE',
          priority: 'MEDIUM',
          members: {
            create: {
              agencyId: agencyA.id,
              userId: memberA.id,
            },
          },
        },
      });
    });

    afterAll(async () => {
      await prisma.taskComment.deleteMany({
        where: { task: { projectId: { in: [unassignedProject.id, assignedProject.id] } } },
      });
      await prisma.task.deleteMany({
        where: { projectId: { in: [unassignedProject.id, assignedProject.id] } },
      });
      await prisma.milestone.deleteMany({
        where: { projectId: { in: [unassignedProject.id, assignedProject.id] } },
      });
      await prisma.meeting.deleteMany({
        where: { projectId: { in: [unassignedProject.id, assignedProject.id] } },
      });
      await prisma.projectMember.deleteMany({
        where: { projectId: { in: [unassignedProject.id, assignedProject.id] } },
      });
      await prisma.project.deleteMany({
        where: { id: { in: [unassignedProject.id, assignedProject.id] } },
      });
    });

    it('unassigned project: member gets 404 on task list and task create', async () => {
      const listRes = await request(app)
        .get(`/api/v1/projects/${unassignedProject.id}/tasks`)
        .set('Cookie', memberACookie);
      expect(listRes.status).toBe(404);

      const createRes = await request(app)
        .post(`/api/v1/projects/${unassignedProject.id}/tasks`)
        .set('Cookie', memberACookie)
        .send({ title: 'Illegal Task' });
      expect(createRes.status).toBe(404);
    });

    it('unassigned project: member gets 404 on task GET/PATCH/DELETE by id', async () => {
      const getRes = await request(app)
        .get(`/api/v1/tasks/${unassignedTask.id}`)
        .set('Cookie', memberACookie);
      expect(getRes.status).toBe(404);

      const patchRes = await request(app)
        .patch(`/api/v1/tasks/${unassignedTask.id}`)
        .set('Cookie', memberACookie)
        .send({ title: 'Hacked Title' });
      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/tasks/${unassignedTask.id}`)
        .set('Cookie', memberACookie);
      expect(deleteRes.status).toBe(404);
    });

    it('unassigned project: member gets 404 on milestone list, create, and GET/PATCH/DELETE by id', async () => {
      const listRes = await request(app)
        .get(`/api/v1/projects/${unassignedProject.id}/milestones`)
        .set('Cookie', memberACookie);
      expect(listRes.status).toBe(404);

      const createRes = await request(app)
        .post(`/api/v1/projects/${unassignedProject.id}/milestones`)
        .set('Cookie', memberACookie)
        .send({ title: 'Illegal Milestone' });
      expect(createRes.status).toBe(404);

      const getRes = await request(app)
        .get(`/api/v1/milestones/${unassignedMilestone.id}`)
        .set('Cookie', memberACookie);
      expect(getRes.status).toBe(404);

      const patchRes = await request(app)
        .patch(`/api/v1/milestones/${unassignedMilestone.id}`)
        .set('Cookie', memberACookie)
        .send({ title: 'Hacked Milestone' });
      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/milestones/${unassignedMilestone.id}`)
        .set('Cookie', memberACookie);
      expect(deleteRes.status).toBe(404);
    });

    it('unassigned project: member gets 404 on meeting list, create, and GET/PATCH/DELETE by id', async () => {
      const listRes = await request(app)
        .get(`/api/v1/projects/${unassignedProject.id}/meetings`)
        .set('Cookie', memberACookie);
      expect(listRes.status).toBe(404);

      const createRes = await request(app)
        .post(`/api/v1/projects/${unassignedProject.id}/meetings`)
        .set('Cookie', memberACookie)
        .send({ title: 'Illegal Meeting', meetingDate: new Date().toISOString() });
      expect(createRes.status).toBe(404);

      const getRes = await request(app)
        .get(`/api/v1/meetings/${unassignedMeeting.id}`)
        .set('Cookie', memberACookie);
      expect(getRes.status).toBe(404);

      const patchRes = await request(app)
        .patch(`/api/v1/meetings/${unassignedMeeting.id}`)
        .set('Cookie', memberACookie)
        .send({ title: 'Hacked Meeting' });
      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/meetings/${unassignedMeeting.id}`)
        .set('Cookie', memberACookie);
      expect(deleteRes.status).toBe(404);
    });

    it('unassigned project: member gets 404 on task comments list and create', async () => {
      const listRes = await request(app)
        .get(`/api/v1/tasks/${unassignedTask.id}/comments`)
        .set('Cookie', memberACookie);
      expect(listRes.status).toBe(404);

      const createRes = await request(app)
        .post(`/api/v1/tasks/${unassignedTask.id}/comments`)
        .set('Cookie', memberACookie)
        .send({ body: 'Illegal Comment' });
      expect(createRes.status).toBe(404);
    });

    it('positive controls: member on assigned project has full CRUD on tasks, milestones, meetings, comments', async () => {
      // 1. Task CRUD
      const taskListRes = await request(app)
        .get(`/api/v1/projects/${assignedProject.id}/tasks`)
        .set('Cookie', memberACookie);
      expect(taskListRes.status).toBe(200);

      const taskCreateRes = await request(app)
        .post(`/api/v1/projects/${assignedProject.id}/tasks`)
        .set('Cookie', memberACookie)
        .send({ title: 'Member Created Task' });
      expect(taskCreateRes.status).toBe(201);
      const createdTaskId = taskCreateRes.body.data.id;

      const taskGetRes = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', memberACookie);
      expect(taskGetRes.status).toBe(200);

      const taskPatchRes = await request(app)
        .patch(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', memberACookie)
        .send({ title: 'Member Updated Task' });
      expect(taskPatchRes.status).toBe(200);

      // Comments on task
      const commentCreateRes = await request(app)
        .post(`/api/v1/tasks/${createdTaskId}/comments`)
        .set('Cookie', memberACookie)
        .send({ body: 'Member comment on task' });
      expect(commentCreateRes.status).toBe(201);

      const commentListRes = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}/comments`)
        .set('Cookie', memberACookie);
      expect(commentListRes.status).toBe(200);
      expect(commentListRes.body.data.length).toBeGreaterThan(0);

      const taskDeleteRes = await request(app)
        .delete(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', memberACookie);
      expect(taskDeleteRes.status).toBe(204);

      // 2. Milestone CRUD
      const msListRes = await request(app)
        .get(`/api/v1/projects/${assignedProject.id}/milestones`)
        .set('Cookie', memberACookie);
      expect(msListRes.status).toBe(200);

      const msCreateRes = await request(app)
        .post(`/api/v1/projects/${assignedProject.id}/milestones`)
        .set('Cookie', memberACookie)
        .send({ title: 'Member Milestone' });
      expect(msCreateRes.status).toBe(201);
      const createdMsId = msCreateRes.body.data.id;

      const msGetRes = await request(app)
        .get(`/api/v1/milestones/${createdMsId}`)
        .set('Cookie', memberACookie);
      expect(msGetRes.status).toBe(200);

      const msPatchRes = await request(app)
        .patch(`/api/v1/milestones/${createdMsId}`)
        .set('Cookie', memberACookie)
        .send({ title: 'Updated Milestone' });
      expect(msPatchRes.status).toBe(200);

      const msDeleteRes = await request(app)
        .delete(`/api/v1/milestones/${createdMsId}`)
        .set('Cookie', memberACookie);
      expect(msDeleteRes.status).toBe(204);

      // 3. Meeting CRUD
      const mtgListRes = await request(app)
        .get(`/api/v1/projects/${assignedProject.id}/meetings`)
        .set('Cookie', memberACookie);
      expect(mtgListRes.status).toBe(200);

      const mtgCreateRes = await request(app)
        .post(`/api/v1/projects/${assignedProject.id}/meetings`)
        .set('Cookie', memberACookie)
        .send({ title: 'Member Meeting', meetingDate: new Date().toISOString() });
      expect(mtgCreateRes.status).toBe(201);
      const createdMtgId = mtgCreateRes.body.data.id;

      const mtgGetRes = await request(app)
        .get(`/api/v1/meetings/${createdMtgId}`)
        .set('Cookie', memberACookie);
      expect(mtgGetRes.status).toBe(200);

      const mtgPatchRes = await request(app)
        .patch(`/api/v1/meetings/${createdMtgId}`)
        .set('Cookie', memberACookie)
        .send({ title: 'Updated Meeting' });
      expect(mtgPatchRes.status).toBe(200);

      const mtgDeleteRes = await request(app)
        .delete(`/api/v1/meetings/${createdMtgId}`)
        .set('Cookie', memberACookie);
      expect(mtgDeleteRes.status).toBe(204);
    });
  });

  // ─── Scenario 4: CLIENT Token 403 Access Restrictions ─────────────────────────
  describe('Scenario 4: CLIENT Token Restrictions (403 FORBIDDEN)', () => {
    it('CLIENT token gets 403 on internal tasks endpoints', async () => {
      const getProjectTasks = await request(app)
        .get(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', clientCookie);
      expect(getProjectTasks.status).toBe(403);

      const task = await prisma.task.findFirst({ where: { projectId: projectA.id } });
      if (task) {
        const getTask = await request(app)
          .get(`/api/v1/tasks/${task.id}`)
          .set('Cookie', clientCookie);
        expect(getTask.status).toBe(403);
      }
    });

    it('CLIENT token gets 403 on internal milestones endpoints', async () => {
      const listMs = await request(app)
        .get(`/api/v1/projects/${projectA.id}/milestones`)
        .set('Cookie', clientCookie);
      expect(listMs.status).toBe(403);

      const ms = await prisma.milestone.findFirst({ where: { projectId: projectA.id } });
      if (ms) {
        const getMs = await request(app)
          .get(`/api/v1/milestones/${ms.id}`)
          .set('Cookie', clientCookie);
        expect(getMs.status).toBe(403);
      }
    });

    it('CLIENT token gets 403 on internal meetings endpoints', async () => {
      const listMtg = await request(app)
        .get(`/api/v1/projects/${projectA.id}/meetings`)
        .set('Cookie', clientCookie);
      expect(listMtg.status).toBe(403);

      const mtg = await prisma.meeting.findFirst({ where: { projectId: projectA.id } });
      if (mtg) {
        const getMtg = await request(app)
          .get(`/api/v1/meetings/${mtg.id}`)
          .set('Cookie', clientCookie);
        expect(getMtg.status).toBe(403);
      }
    });

    it('CLIENT token gets 403 on /dashboard and /my-work', async () => {
      const dash = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', clientCookie);
      expect(dash.status).toBe(403);

      const myWork = await request(app)
        .get('/api/v1/my-work')
        .set('Cookie', clientCookie);
      expect(myWork.status).toBe(403);
    });

    it('CLIENT token gets 403 on activity routes', async () => {
      const projAct = await request(app)
        .get(`/api/v1/projects/${projectA.id}/activity`)
        .set('Cookie', clientCookie);
      expect(projAct.status).toBe(403);

      const clientAct = await request(app)
        .get(`/api/v1/clients/${testClientA.id}/activity`)
        .set('Cookie', clientCookie);
      expect(clientAct.status).toBe(403);
    });
  });

  // ─── Support Mode Access & Mutation Guard ─────────────────────────────────────
  describe('Support Mode: Read-Only Enforcement', () => {
    let supportCookie: string;

    beforeAll(async () => {
      // Enter support session for Agency A
      const res = await request(app)
        .post(`/api/v1/admin/agencies/${agencyA.id}/support-session`)
        .set('Cookie', superAdminCookie);
      expect(res.status).toBe(200);

      const cookies = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [res.headers['set-cookie']];
      const supportCookieHeader = cookies.find((c) => c.startsWith('ah_support='));
      supportCookie = [superAdminCookie, supportCookieHeader!.split(';')[0]].join('; ');
    });

    afterAll(async () => {
      await request(app)
        .post('/api/v1/admin/support-session/exit')
        .set('Cookie', supportCookie);
    });

    it('GET works for the supported agency tasks and dashboard', async () => {
      const dashRes = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', supportCookie);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.projects).toBeDefined();

      const taskListRes = await request(app)
        .get(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', supportCookie);
      expect(taskListRes.status).toBe(200);
    });

    it('POST/PATCH get 403 SUPPORT_READ_ONLY in support mode', async () => {
      const postRes = await request(app)
        .post(`/api/v1/projects/${projectA.id}/tasks`)
        .set('Cookie', supportCookie)
        .send({ title: 'Support Attempted Mutation' });

      expect(postRes.status).toBe(403);
      expect(postRes.body.error?.code).toBe('SUPPORT_READ_ONLY');

      const existingTask = await prisma.task.findFirst({ where: { projectId: projectA.id } });
      if (existingTask) {
        const patchRes = await request(app)
          .patch(`/api/v1/tasks/${existingTask.id}`)
          .set('Cookie', supportCookie)
          .send({ title: 'Support Attempted Patch' });

        expect(patchRes.status).toBe(403);
        expect(patchRes.body.error?.code).toBe('SUPPORT_READ_ONLY');
      }
    });
  });

  // ─── Derived Values Calculation ───────────────────────────────────────────────
  describe('Derived Values: Progress and Task Overdue / Due Soon Boundaries', () => {
    it('progress excludes CANCELLED and an empty project yields 0', async () => {
      // 1. Empty project
      const emptyProject = await prisma.project.create({
        data: {
          agencyId: agencyA.id,
          clientId: testClientA.id,
          managerId: adminA.id,
          name: `Empty Proj ${Date.now()}`,
          status: 'ACTIVE',
          priority: 'MEDIUM',
        },
      });

      const emptyRes = await request(app)
        .get(`/api/v1/projects/${emptyProject.id}`)
        .set('Cookie', adminACookie);
      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.data.progress).toBe(0);

      // 2. Project with 1 DONE, 1 TODO, 1 CANCELLED -> non-cancelled is 2, progress is 50%
      const mixedProject = await prisma.project.create({
        data: {
          agencyId: agencyA.id,
          clientId: testClientA.id,
          managerId: adminA.id,
          name: `Mixed Proj ${Date.now()}`,
          status: 'ACTIVE',
          priority: 'MEDIUM',
        },
      });

      await prisma.task.createMany({
        data: [
          { agencyId: agencyA.id, projectId: mixedProject.id, title: 'T1', status: 'DONE', priority: 'LOW', createdBy: adminA.id },
          { agencyId: agencyA.id, projectId: mixedProject.id, title: 'T2', status: 'TODO', priority: 'LOW', createdBy: adminA.id },
          { agencyId: agencyA.id, projectId: mixedProject.id, title: 'T3', status: 'CANCELLED', priority: 'LOW', createdBy: adminA.id },
        ],
      });

      const mixedRes = await request(app)
        .get(`/api/v1/projects/${mixedProject.id}`)
        .set('Cookie', adminACookie);
      expect(mixedRes.status).toBe(200);
      expect(mixedRes.body.data.progress).toBe(50); // 1 done / 2 non-cancelled

      // Clean up
      await prisma.task.deleteMany({ where: { projectId: { in: [emptyProject.id, mixedProject.id] } } });
      await prisma.project.deleteMany({ where: { id: { in: [emptyProject.id, mixedProject.id] } } });
    });

    it('task overdue boundary: due today is not overdue; yesterday is; DONE yesterday is not; due soon is <= 7 days', async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const in3Days = new Date(startOfToday.getTime() + 3 * 24 * 60 * 60 * 1000);
      const in10Days = new Date(startOfToday.getTime() + 10 * 24 * 60 * 60 * 1000);

      // Task due today
      const taskToday = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          title: 'Due Today Task',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: startOfToday,
          createdBy: adminA.id,
        },
      });

      // Task due yesterday (TODO)
      const taskYesterdayTodo = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          title: 'Due Yesterday Todo',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: yesterday,
          createdBy: adminA.id,
        },
      });

      // Task due yesterday (DONE)
      const taskYesterdayDone = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          title: 'Due Yesterday Done',
          status: 'DONE',
          priority: 'MEDIUM',
          dueDate: yesterday,
          createdBy: adminA.id,
        },
      });

      // Task due in 3 days
      const taskDueSoon = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          title: 'Due Soon Task',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: in3Days,
          createdBy: adminA.id,
        },
      });

      // Task due in 10 days
      const taskDueLater = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          title: 'Due Later Task',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate: in10Days,
          createdBy: adminA.id,
        },
      });

      const resToday = await request(app).get(`/api/v1/tasks/${taskToday.id}`).set('Cookie', adminACookie);
      expect(resToday.body.data.isOverdue).toBe(false);
      expect(resToday.body.data.isDueSoon).toBe(true);

      const resYesterdayTodo = await request(app).get(`/api/v1/tasks/${taskYesterdayTodo.id}`).set('Cookie', adminACookie);
      expect(resYesterdayTodo.body.data.isOverdue).toBe(true);
      expect(resYesterdayTodo.body.data.isDueSoon).toBe(false);

      const resYesterdayDone = await request(app).get(`/api/v1/tasks/${taskYesterdayDone.id}`).set('Cookie', adminACookie);
      expect(resYesterdayDone.body.data.isOverdue).toBe(false);
      expect(resYesterdayDone.body.data.isDueSoon).toBe(false);

      const resDueSoon = await request(app).get(`/api/v1/tasks/${taskDueSoon.id}`).set('Cookie', adminACookie);
      expect(resDueSoon.body.data.isOverdue).toBe(false);
      expect(resDueSoon.body.data.isDueSoon).toBe(true);

      const resDueLater = await request(app).get(`/api/v1/tasks/${taskDueLater.id}`).set('Cookie', adminACookie);
      expect(resDueLater.body.data.isOverdue).toBe(false);
      expect(resDueLater.body.data.isDueSoon).toBe(false);

      // Clean up
      await prisma.task.deleteMany({
        where: { id: { in: [taskToday.id, taskYesterdayTodo.id, taskYesterdayDone.id, taskDueSoon.id, taskDueLater.id] } },
      });
    });
  });

  // ─── Dashboard Isolation & Scoped Counts ──────────────────────────────────────
  describe('Dashboard: Agency Isolation & Member Scoping', () => {
    it('creating extra Agency B data does not change Agency A dashboard numbers', async () => {
      const beforeDash = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', adminACookie);
      expect(beforeDash.status).toBe(200);
      const beforeProjectsTotal = beforeDash.body.data.projects.total;
      const beforeTasksTotal = beforeDash.body.data.tasks.total;

      // Inject extra project and tasks into Agency B
      const extraProjectB = await prisma.project.create({
        data: {
          agencyId: agencyB.id,
          clientId: (await prisma.client.findFirst({ where: { agencyId: agencyB.id } }))!.id,
          managerId: adminB.id,
          name: `Extra Agency B Proj ${Date.now()}`,
          status: 'ACTIVE',
          priority: 'HIGH',
        },
      });

      const extraTaskB = await prisma.task.create({
        data: {
          agencyId: agencyB.id,
          projectId: extraProjectB.id,
          title: 'Extra Agency B Task',
          status: 'TODO',
          priority: 'HIGH',
          createdBy: adminB.id,
        },
      });

      // Re-query Agency A dashboard
      const afterDash = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', adminACookie);
      expect(afterDash.status).toBe(200);

      expect(afterDash.body.data.projects.total).toBe(beforeProjectsTotal);
      expect(afterDash.body.data.tasks.total).toBe(beforeTasksTotal);

      // Clean up
      await prisma.task.delete({ where: { id: extraTaskB.id } });
      await prisma.project.delete({ where: { id: extraProjectB.id } });
    });

    it("member dashboard counts only assigned projects and their tasks", async () => {
      // Get member dashboard
      const memberDash = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', memberACookie);
      expect(memberDash.status).toBe(200);

      // Count projects where member is manager or assigned member
      const memberProjectsCount = await prisma.project.count({
        where: {
          agencyId: agencyA.id,
          OR: [
            { managerId: memberA.id },
            { members: { some: { userId: memberA.id } } },
          ],
        },
      });

      expect(memberDash.body.data.projects.total).toBe(memberProjectsCount);

      // Admin dashboard sees all projects in Agency A
      const adminDash = await request(app)
        .get('/api/v1/dashboard')
        .set('Cookie', adminACookie);
      const totalAgencyAProjects = await prisma.project.count({
        where: { agencyId: agencyA.id },
      });
      expect(adminDash.body.data.projects.total).toBe(totalAgencyAProjects);
    });
  });

  // ─── Cross-Agency Comment / Meeting & completed_at Lifecycle ──────────────────
  describe('Cross-Agency Comment / Meeting Access & completed_at Lifecycle', () => {
    let agencyBTask: any;
    let agencyBMeeting: any;

    beforeAll(async () => {
      agencyBTask = await prisma.task.create({
        data: {
          agencyId: agencyB.id,
          projectId: projectB.id,
          title: 'Agency B Target Task',
          status: 'TODO',
          priority: 'MEDIUM',
          createdBy: adminB.id,
        },
      });

      agencyBMeeting = await prisma.meeting.create({
        data: {
          agencyId: agencyB.id,
          projectId: projectB.id,
          title: 'Agency B Target Meeting',
          meetingDate: new Date(),
          createdBy: adminB.id,
        },
      });
    });

    afterAll(async () => {
      await prisma.taskComment.deleteMany({ where: { taskId: agencyBTask.id } });
      await prisma.task.delete({ where: { id: agencyBTask.id } });
      await prisma.meeting.delete({ where: { id: agencyBMeeting.id } });
    });

    it('cross-agency comment create -> 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${agencyBTask.id}/comments`)
        .set('Cookie', adminACookie)
        .send({ body: 'Injected cross-agency comment' });

      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe('NOT_FOUND');

      const count = await prisma.taskComment.count({ where: { taskId: agencyBTask.id } });
      expect(count).toBe(0);
    });

    it('cross-agency meeting GET and PATCH -> 404 NOT_FOUND', async () => {
      const getRes = await request(app)
        .get(`/api/v1/meetings/${agencyBMeeting.id}`)
        .set('Cookie', adminACookie);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error?.code).toBe('NOT_FOUND');

      const patchRes = await request(app)
        .patch(`/api/v1/meetings/${agencyBMeeting.id}`)
        .set('Cookie', adminACookie)
        .send({ title: 'Hijacked Meeting Title' });
      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error?.code).toBe('NOT_FOUND');

      const dbMeeting = await prisma.meeting.findUnique({ where: { id: agencyBMeeting.id } });
      expect(dbMeeting?.title).toBe('Agency B Target Meeting');
    });

    it('completed_at is set on DONE and cleared when leaving DONE', async () => {
      // 1. Create task in TODO -> completedAt is null
      const task = await prisma.task.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          title: 'Lifecycle Task',
          status: 'TODO',
          priority: 'LOW',
          createdBy: adminA.id,
        },
      });
      expect(task.completedAt).toBeNull();

      // 2. PATCH status to DONE -> completedAt is populated
      const patchDoneRes = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set('Cookie', adminACookie)
        .send({ status: 'DONE' });
      expect(patchDoneRes.status).toBe(200);
      expect(patchDoneRes.body.data.completedAt).not.toBeNull();

      const inDbDone = await prisma.task.findUnique({ where: { id: task.id } });
      expect(inDbDone?.completedAt).not.toBeNull();

      // 3. PATCH status back to IN_PROGRESS -> completedAt is cleared (null)
      const patchInProgressRes = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set('Cookie', adminACookie)
        .send({ status: 'IN_PROGRESS' });
      expect(patchInProgressRes.status).toBe(200);
      expect(patchInProgressRes.body.data.completedAt).toBeNull();

      const inDbInProgress = await prisma.task.findUnique({ where: { id: task.id } });
      expect(inDbInProgress?.completedAt).toBeNull();

      // Clean up
      await prisma.task.delete({ where: { id: task.id } });
    });
  });
});
