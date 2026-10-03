import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import { signSupportToken, SUPPORT_COOKIE_NAME } from '../../../lib/jwt';

const PASSWORD = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [response.headers['set-cookie']];
  const tokenCookie = cookies.find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie returned for ${email}`);
  return tokenCookie.split(';')[0];
}

describe('Task mutation HTTP authorization', () => {
  let agencyAId: string;
  let agencyBId: string;
  let adminA: any;
  let adminB: any;
  let memberA: any;
  let superAdmin: any;
  let unassignedAgencyUserId: string;
  let inactiveAgencyUserId: string;
  let assignedProjectId: string;
  let unassignedProjectId: string;
  let projectBId: string;
  let memberEditTaskId: string;
  let memberDeleteTaskId: string;
  let memberProtectedTaskId: string;
  let adminTaskId: string;
  let unassignedTaskId: string;
  let foreignTaskId: string;
  let assignmentTaskId: string;
  let clientCookie: string;
  let adminACookie: string;
  let memberCookie: string;
  let supportCookie: string;
  const eventIds: string[] = [];
  const taskIds: string[] = [];
  const projectIds: string[] = [];
  const clientIds: string[] = [];
  const extraUserIds: string[] = [];

  beforeAll(async () => {
    const [agencyA, agencyBRecord, adminARecord, adminBRecord, memberRecord, superAdminRecord, clientUser] = await Promise.all([
      prisma.agency.findUniqueOrThrow({ where: { slug: 'acme-digital' } }),
      prisma.agency.findUniqueOrThrow({ where: { slug: 'apex-creative' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@acme.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'admin@apex.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member@acme.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@agencyhub.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'client@nike.test' } }),
    ]);
    agencyAId = agencyA.id;
    agencyBId = agencyBRecord.id;
    adminA = adminARecord;
    adminB = adminBRecord;
    memberA = memberRecord;
    superAdmin = superAdminRecord;
    const [clientA, clientB] = await Promise.all([
      prisma.client.findFirstOrThrow({ where: { agencyId: agencyAId } }),
      prisma.client.findFirstOrThrow({ where: { agencyId: agencyBId } }),
    ]);
    const [assignedProject, unassignedProject, projectB] = await Promise.all([
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminA.id, name: 'Task mutation assigned project' } }),
      prisma.project.create({ data: { agencyId: agencyAId, clientId: clientA.id, managerId: adminA.id, name: 'Task mutation unassigned project' } }),
      prisma.project.create({ data: { agencyId: agencyBId, clientId: clientB.id, managerId: adminB.id, name: 'Task mutation Agency B project' } }),
    ]);
    assignedProjectId = assignedProject.id;
    unassignedProjectId = unassignedProject.id;
    projectBId = projectB.id;
    projectIds.push(assignedProjectId, unassignedProjectId, projectBId);
    await prisma.projectMember.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, userId: memberA.id } });
    await prisma.projectMember.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, userId: adminB.id } });
    const unassignedAgencyUser = await prisma.user.create({
      data: {
        agencyId: agencyAId,
        name: 'Unassigned Agency Staff',
        email: `unassigned-staff-${Date.now()}@acme.test`,
        passwordHash: 'unused-test-hash',
        role: 'AGENCY_MEMBER',
        isActive: true,
      },
    });
    unassignedAgencyUserId = unassignedAgencyUser.id;
    const inactiveAgencyUser = await prisma.user.create({
      data: {
        agencyId: agencyAId,
        name: 'Inactive Project Staff',
        email: `inactive-staff-${Date.now()}@acme.test`,
        passwordHash: 'unused-test-hash',
        role: 'AGENCY_MEMBER',
        isActive: false,
      },
    });
    inactiveAgencyUserId = inactiveAgencyUser.id;
    extraUserIds.push(unassignedAgencyUserId, inactiveAgencyUserId);
    await prisma.projectMember.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, userId: inactiveAgencyUserId } });

    const [memberEdit, memberDelete, memberProtected, adminTask, unassignedTask, foreignTask] = await Promise.all([
      prisma.task.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, title: 'Member edit task', createdBy: memberA.id } }),
      prisma.task.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, title: 'Member delete task', createdBy: adminA.id, assigneeId: memberA.id } }),
      prisma.task.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, title: 'Member protected task', createdBy: adminA.id, assigneeId: adminA.id } }),
      prisma.task.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, title: 'Admin task', createdBy: memberA.id } }),
      prisma.task.create({ data: { agencyId: agencyAId, projectId: unassignedProjectId, title: 'Unassigned task', createdBy: adminA.id } }),
      prisma.task.create({ data: { agencyId: agencyBId, projectId: projectBId, title: 'Foreign task', createdBy: adminB.id } }),
    ]);
    memberEditTaskId = memberEdit.id;
    memberDeleteTaskId = memberDelete.id;
    memberProtectedTaskId = memberProtected.id;
    adminTaskId = adminTask.id;
    unassignedTaskId = unassignedTask.id;
    foreignTaskId = foreignTask.id;
    taskIds.push(memberEdit.id, memberDelete.id, memberProtected.id, adminTask.id, unassignedTask.id, foreignTask.id);
    const assignmentTask = await prisma.task.create({ data: { agencyId: agencyAId, projectId: assignedProjectId, title: 'Assignment change task', createdBy: adminA.id, assigneeId: adminA.id } });
    assignmentTaskId = assignmentTask.id;
    taskIds.push(assignmentTaskId);

    adminACookie = await loginAs(adminA.email);
    memberCookie = await loginAs(memberA.email);
    clientCookie = await loginAs(clientUser.email);
    supportCookie = `${await loginAs(superAdmin.email)}; ${SUPPORT_COOKIE_NAME}=${signSupportToken({ superAdminId: superAdmin.id, supportAgencyId: agencyAId })}`;
  });

  afterAll(async () => {
    if (eventIds.length) await prisma.activityLog.deleteMany({ where: { id: { in: eventIds } } });
    if (taskIds.length) await prisma.activityLog.deleteMany({ where: { entityId: { in: taskIds } } });
    if (taskIds.length) await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    if (projectIds.length) {
      await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    if (clientIds.length) await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    if (extraUserIds.length) await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
  });

  it('admin can edit and delete any task in the agency and writes both activity events', async () => {
    const update = await request(app)
      .patch(`/api/v1/tasks/${adminTaskId}`)
      .set('Cookie', adminACookie)
      .send({ title: 'Admin edited any task', description: 'Edited by agency admin.', priority: 'HIGH' });
    expect(update.status).toBe(200);
    expect(update.body.data.title).toBe('Admin edited any task');
    const updateEvent = await prisma.activityLog.findFirstOrThrow({ where: { agencyId: agencyAId, entityId: adminTaskId, eventType: 'task.updated' } });
    eventIds.push(updateEvent.id);

    const deletion = await request(app).delete(`/api/v1/tasks/${adminTaskId}`).set('Cookie', adminACookie);
    expect(deletion.status).toBe(204);
    const deleteEvent = await prisma.activityLog.findFirstOrThrow({ where: { agencyId: agencyAId, entityId: adminTaskId, eventType: 'task.deleted' } });
    eventIds.push(deleteEvent.id);
    expect(deleteEvent.visibleToClient).toBe(false);
  });

  it('member can edit an assigned-project task and delete only created or assigned tasks', async () => {
    const update = await request(app)
      .patch(`/api/v1/tasks/${memberEditTaskId}`)
      .set('Cookie', memberCookie)
      .send({ title: 'Member edited task', status: 'IN_PROGRESS' });
    expect(update.status).toBe(200);
    expect(update.body.data.title).toBe('Member edited task');
    const updateEvent = await prisma.activityLog.findFirstOrThrow({ where: { agencyId: agencyAId, entityId: memberEditTaskId, eventType: 'task.updated' } });
    eventIds.push(updateEvent.id);

    const denied = await request(app).delete(`/api/v1/tasks/${memberProtectedTaskId}`).set('Cookie', memberCookie);
    expect(denied.status).toBe(404);
    expect(await prisma.task.findUnique({ where: { id: memberProtectedTaskId } })).not.toBeNull();

    const deletion = await request(app).delete(`/api/v1/tasks/${memberDeleteTaskId}`).set('Cookie', memberCookie);
    expect(deletion.status).toBe(204);
    const deleteEvent = await prisma.activityLog.findFirstOrThrow({ where: { agencyId: agencyAId, entityId: memberDeleteTaskId, eventType: 'task.deleted' } });
    eventIds.push(deleteEvent.id);
  });

  it('cross-agency task mutations return 404 and leave the task unchanged', async () => {
    const before = await prisma.task.findUniqueOrThrow({ where: { id: foreignTaskId } });
    const update = await request(app)
      .patch(`/api/v1/tasks/${foreignTaskId}`)
      .set('Cookie', adminACookie)
      .send({ title: 'Cross agency edit' });
    expect(update.status).toBe(404);

    const deletion = await request(app).delete(`/api/v1/tasks/${foreignTaskId}`).set('Cookie', adminACookie);
    expect(deletion.status).toBe(404);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: foreignTaskId } })).toMatchObject({ title: before.title, agencyId: agencyBId });
  });

  it('member receives 404 for an unassigned project and CLIENT receives 403', async () => {
    const update = await request(app)
      .patch(`/api/v1/tasks/${unassignedTaskId}`)
      .set('Cookie', memberCookie)
      .send({ title: 'Unauthorized edit' });
    expect(update.status).toBe(404);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: unassignedTaskId } })).title).toBe('Unassigned task');
    const deletion = await request(app).delete(`/api/v1/tasks/${unassignedTaskId}`).set('Cookie', memberCookie);
    expect(deletion.status).toBe(404);

    const clientPatch = await request(app).patch(`/api/v1/tasks/${memberEditTaskId}`).set('Cookie', clientCookie).send({ title: 'Client edit' });
    const clientDelete = await request(app).delete(`/api/v1/tasks/${memberEditTaskId}`).set('Cookie', clientCookie);
    expect(clientPatch.status).toBe(403);
    expect(clientDelete.status).toBe(403);
  });

  it('blocks task update and delete in support mode', async () => {
    const update = await request(app).patch(`/api/v1/tasks/${memberEditTaskId}`).set('Cookie', supportCookie).send({ title: 'Support edit' });
    const deletion = await request(app).delete(`/api/v1/tasks/${memberEditTaskId}`).set('Cookie', supportCookie);
    expect(update.status).toBe(403);
    expect(update.body.error.code).toBe('SUPPORT_READ_ONLY');
    expect(deletion.status).toBe(403);
    expect(deletion.body.error.code).toBe('SUPPORT_READ_ONLY');
    expect((await prisma.task.findUniqueOrThrow({ where: { id: memberEditTaskId } })).title).toBe('Member edited task');
  });

  it('creates LOW, MEDIUM-default, and HIGH tasks and rejects invalid priorities', async () => {
    const dueDate = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const [defaultTask, highLate, highSoon, medium, low] = await Promise.all([
      request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Priority default control', assigneeId: memberA.id }),
      request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Priority HIGH late', priority: 'HIGH', dueDate: dueDate(5), assigneeId: memberA.id }),
      request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Priority HIGH soon', priority: 'HIGH', dueDate: dueDate(2), assigneeId: memberA.id }),
      request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Priority MEDIUM', priority: 'MEDIUM', dueDate: dueDate(3), assigneeId: memberA.id }),
      request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Priority LOW', priority: 'LOW', dueDate: dueDate(1), assigneeId: memberA.id }),
    ]);
    for (const response of [defaultTask, highLate, highSoon, medium, low]) {
      expect(response.status).toBe(201);
      taskIds.push(response.body.data.id);
    }
    expect(defaultTask.body.data.priority).toBe('MEDIUM');
    expect(highLate.body.data.priority).toBe('HIGH');
    expect(highSoon.body.data.priority).toBe('HIGH');
    expect(medium.body.data.priority).toBe('MEDIUM');
    expect(low.body.data.priority).toBe('LOW');

    const defaultActivity = await prisma.activityLog.findFirstOrThrow({ where: { agencyId: agencyAId, entityId: defaultTask.body.data.id, eventType: 'task.assigned' } });
    eventIds.push(defaultActivity.id);
    expect(defaultActivity.metadata).toMatchObject({ oldAssignee: null, newAssignee: { id: memberA.id, name: memberA.name } });

    const invalidCreate = await request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Invalid priority', priority: 'URGENT' });
    expect(invalidCreate.status).toBe(422);
    const invalidUpdate = await request(app).patch(`/api/v1/tasks/${assignmentTaskId}`).set('Cookie', adminACookie).send({ priority: 'URGENT' });
    expect(invalidUpdate.status).toBe(422);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: assignmentTaskId } })).priority).toBe('MEDIUM');
  });

  it('assigns only active same-agency project people and logs old/new assignees', async () => {
    const assignees = await request(app).get(`/api/v1/projects/${assignedProjectId}/assignees`).set('Cookie', adminACookie);
    expect(assignees.status).toBe(200);
    expect(assignees.body.data.some((person: { id: string }) => person.id === adminA.id)).toBe(true);
    expect(assignees.body.data.some((person: { id: string }) => person.id === memberA.id)).toBe(true);
    expect(assignees.body.data.some((person: { id: string }) => person.id === adminB.id)).toBe(false);
    expect(assignees.body.data.some((person: { id: string }) => person.id === unassignedAgencyUserId)).toBe(false);
    expect(assignees.body.data.some((person: { id: string }) => person.id === inactiveAgencyUserId)).toBe(false);
    expect((await request(app).get(`/api/v1/projects/${assignedProjectId}/assignees`).set('Cookie', memberCookie)).status).toBe(200);
    expect((await request(app).get(`/api/v1/projects/${unassignedProjectId}/assignees`).set('Cookie', memberCookie)).status).toBe(404);

    const assign = await request(app).patch(`/api/v1/tasks/${assignmentTaskId}`).set('Cookie', adminACookie).send({ assigneeId: memberA.id });
    expect(assign.status).toBe(200);
    expect(assign.body.data.assigneeId).toBe(memberA.id);
    const assignedEvent = await prisma.activityLog.findFirstOrThrow({ where: { agencyId: agencyAId, entityId: assignmentTaskId, eventType: 'task.assigned' } });
    eventIds.push(assignedEvent.id);
    expect(assignedEvent.metadata).toMatchObject({
      oldAssignee: { id: adminA.id, name: adminA.name },
      newAssignee: { id: memberA.id, name: memberA.name },
    });

    const invalidUser = await request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Unassigned agency assignee', assigneeId: unassignedAgencyUserId });
    expect(invalidUser.status).toBe(422);
    const inactiveUser = await request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Inactive assignee', assigneeId: inactiveAgencyUserId });
    expect(inactiveUser.status).toBe(422);
    const invalidUpdate = await request(app).patch(`/api/v1/tasks/${assignmentTaskId}`).set('Cookie', adminACookie).send({ assigneeId: unassignedAgencyUserId });
    expect(invalidUpdate.status).toBe(422);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: assignmentTaskId } })).assigneeId).toBe(memberA.id);

    const crossAgencyCreate = await request(app).post(`/api/v1/projects/${assignedProjectId}/tasks`).set('Cookie', adminACookie).send({ title: 'Cross agency assignee', assigneeId: adminB.id });
    if (crossAgencyCreate.status === 201) taskIds.push(crossAgencyCreate.body.data.id);
    expect(crossAgencyCreate.status).toBe(422);
    const crossAgencyUpdate = await request(app).patch(`/api/v1/tasks/${assignmentTaskId}`).set('Cookie', adminACookie).send({ assigneeId: adminB.id });
    expect(crossAgencyUpdate.status).toBe(422);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: assignmentTaskId } })).assigneeId).toBe(memberA.id);

    const clientEndpoint = await request(app).get(`/api/v1/projects/${assignedProjectId}/assignees`).set('Cookie', clientCookie);
    expect(clientEndpoint.status).toBe(403);
    const foreignEndpoint = await request(app).get(`/api/v1/projects/${projectBId}/assignees`).set('Cookie', adminACookie);
    expect(foreignEndpoint.status).toBe(404);
  });

  it('orders project tasks, Mine work, and dashboard deadlines by explicit priority rank then due date', async () => {
    const projectList = await request(app).get(`/api/v1/projects/${assignedProjectId}/tasks?limit=100&mine=true`).set('Cookie', memberCookie);
    expect(projectList.status).toBe(200);
    const projectIds = projectList.body.data.map((task: { id: string }) => task.id);
    expect(projectIds.indexOf('')).toBe(-1);
    const pos = (id: string) => projectIds.indexOf(id);
    const priorityTasks = await prisma.task.findMany({ where: { projectId: assignedProjectId, title: { in: ['Priority default control', 'Priority HIGH late', 'Priority HIGH soon', 'Priority MEDIUM', 'Priority LOW'] } } });
    const byTitle = Object.fromEntries(priorityTasks.map((task) => [task.title, task.id]));
    expect(pos(byTitle['Priority HIGH soon'])).toBeLessThan(pos(byTitle['Priority HIGH late']));
    expect(pos(byTitle['Priority HIGH late'])).toBeLessThan(pos(byTitle['Priority MEDIUM']));
    expect(pos(byTitle['Priority MEDIUM'])).toBeLessThan(pos(byTitle['Priority default control']));
    expect(pos(byTitle['Priority MEDIUM'])).toBeLessThan(pos(byTitle['Priority LOW']));

    const filtered = await request(app).get(`/api/v1/projects/${assignedProjectId}/tasks?limit=100&priority=HIGH&assignee=${memberA.id}&mine=true`).set('Cookie', memberCookie);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.map((task: { id: string }) => task.id)).toContain(byTitle['Priority HIGH soon']);
    expect(filtered.body.data.every((task: { priority: string; assigneeId: string }) => task.priority === 'HIGH' && task.assigneeId === memberA.id)).toBe(true);

    const dueDateSorted = await request(app).get(`/api/v1/projects/${assignedProjectId}/tasks?limit=100&mine=true&sort=dueDate`).set('Cookie', memberCookie);
    const dueIds = dueDateSorted.body.data.map((task: { id: string }) => task.id);
    expect(dueIds.indexOf(byTitle['Priority LOW'])).toBeLessThan(dueIds.indexOf(byTitle['Priority HIGH soon']));

    const myWork = await request(app).get('/api/v1/my-work').set('Cookie', memberCookie);
    expect(myWork.status).toBe(200);
    const myWorkIds = myWork.body.data.openTasks.map((task: { id: string }) => task.id);
    expect(myWorkIds.indexOf(byTitle['Priority HIGH soon'])).toBeLessThan(myWorkIds.indexOf(byTitle['Priority HIGH late']));
    expect(myWorkIds.indexOf(byTitle['Priority HIGH late'])).toBeLessThan(myWorkIds.indexOf(byTitle['Priority MEDIUM']));
    expect(myWork.body.data.openTasks.find((task: { id: string }) => task.id === byTitle['Priority HIGH soon']).assignee).toMatchObject({ id: memberA.id });

    const dashboard = await request(app).get('/api/v1/dashboard').set('Cookie', adminACookie);
    expect(dashboard.status).toBe(200);
    const deadlineIds = dashboard.body.data.upcomingDeadlines.map((item: { id: string }) => item.id);
    expect(deadlineIds.indexOf(byTitle['Priority HIGH soon'])).toBeLessThan(deadlineIds.indexOf(byTitle['Priority HIGH late']));
    expect(deadlineIds.indexOf(byTitle['Priority HIGH late'])).toBeLessThan(deadlineIds.indexOf(byTitle['Priority MEDIUM']));
    expect(dashboard.body.data.upcomingDeadlines.find((item: { id: string }) => item.id === byTitle['Priority HIGH soon']).assignee).toMatchObject({ id: memberA.id });
  });
});