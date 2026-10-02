import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../prisma';
import { createScopedPrisma } from '../scopedPrisma';
import { TaskStatus, TaskPriority } from '@prisma/client';

describe('ScopedPrisma Client Audit (STEP 1)', () => {
  let agencyA: any;
  let agencyB: any;
  let projectA: any;
  let projectB: any;
  let adminA: any;
  let adminB: any;

  beforeAll(async () => {
    agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    agencyB = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });

    adminA = await prisma.user.findFirst({ where: { agencyId: agencyA.id, role: 'AGENCY_ADMIN' } });
    adminB = await prisma.user.findFirst({ where: { agencyId: agencyB.id, role: 'AGENCY_ADMIN' } });

    projectA = await prisma.project.findFirst({ where: { agencyId: agencyA.id } });
    projectB = await prisma.project.findFirst({ where: { agencyId: agencyB.id } });

    // Ensure test tasks exist for both agencies
    await prisma.task.create({
      data: {
        agencyId: agencyA.id,
        projectId: projectA.id,
        title: 'ScopedPrisma Test Task A',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        createdBy: adminA.id,
      },
    });

    await prisma.task.create({
      data: {
        agencyId: agencyB.id,
        projectId: projectB.id,
        title: 'ScopedPrisma Test Task B',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        createdBy: adminB.id,
      },
    });
  });

  it('groupBy through a scoped client for Agency A never counts Agency B rows', async () => {
    const scopedA = createScopedPrisma(agencyA.id);

    // Group tasks by status through Agency A scoped client
    const groupsA = await scopedA.task.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Check directly via raw unpartitioned prisma for Agency A count vs Agency B count
    const actualACount = await prisma.task.count({ where: { agencyId: agencyA.id, status: TaskStatus.TODO } });
    const actualBCount = await prisma.task.count({ where: { agencyId: agencyB.id, status: TaskStatus.TODO } });

    expect(actualBCount).toBeGreaterThan(0);

    const todoGroup = groupsA.find((g) => g.status === TaskStatus.TODO);
    expect(todoGroup?._count.id).toBe(actualACount);
    expect(todoGroup?._count.id).not.toBe(actualACount + actualBCount);
  });

  it('findMany and findFirst are strictly scoped by agencyId', async () => {
    const scopedA = createScopedPrisma(agencyA.id);

    const tasks = await scopedA.task.findMany();
    for (const t of tasks) {
      expect(t.agencyId).toBe(agencyA.id);
    }

    const taskB = await prisma.task.findFirst({ where: { agencyId: agencyB.id } });
    const firstB = await scopedA.task.findFirst({ where: { id: taskB!.id } });
    expect(firstB).toBeNull();
  });

  it('findUnique by ID on cross-agency record returns null (preventing existence leak)', async () => {
    const scopedA = createScopedPrisma(agencyA.id);
    const taskB = await prisma.task.findFirst({ where: { agencyId: agencyB.id } });

    const result = await scopedA.task.findUnique({ where: { id: taskB!.id } as any });
    expect(result).toBeNull();
  });

  it('count and aggregate are strictly scoped to agencyId', async () => {
    const scopedA = createScopedPrisma(agencyA.id);

    const totalCountA = await scopedA.task.count();
    const rawCountA = await prisma.task.count({ where: { agencyId: agencyA.id } });
    expect(totalCountA).toBe(rawCountA);

    const agg = await scopedA.task.aggregate({
      _count: { id: true },
    });
    expect(agg._count.id).toBe(rawCountA);
  });

  it('a create call that passes a different agencyId in data still stores the caller agencyId', async () => {
    const scopedA = createScopedPrisma(agencyA.id);
    const createdTask = await scopedA.task.create({
      data: {
        agencyId: agencyB.id, // Intentional malicious override
        projectId: projectA.id,
        title: 'Tampered Agency Task',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        createdBy: adminA.id,
      } as any,
    });
    expect(createdTask.agencyId).toBe(agencyA.id);

    // Verify in database
    const dbRecord = await prisma.task.findUnique({ where: { id: createdTask.id } });
    expect(dbRecord?.agencyId).toBe(agencyA.id);

    // Clean up
    await prisma.task.delete({ where: { id: createdTask.id } });
  });

  it('findFirstOrThrow and findUniqueOrThrow fail closed with throw on cross-agency record', async () => {
    const scopedA = createScopedPrisma(agencyA.id);
    const taskB = await prisma.task.findFirst({ where: { agencyId: agencyB.id } });

    await expect(
      scopedA.task.findFirstOrThrow({ where: { id: taskB!.id } }),
    ).rejects.toThrow();

    await expect(
      scopedA.task.findUniqueOrThrow({ where: { id: taskB!.id } as any }),
    ).rejects.toThrow();
  });

  it('findUnique with compound unique key (projectId_userId) is scoped to agencyId', async () => {
    const scopedA = createScopedPrisma(agencyA.id);

    const memberAUser = await prisma.user.findFirstOrThrow({ where: { agencyId: agencyA.id, role: 'AGENCY_MEMBER' } });
    const memberBUser = await prisma.user.findFirstOrThrow({ where: { agencyId: agencyB.id, role: 'AGENCY_MEMBER' } });

    let pmA = await prisma.projectMember.findFirst({
      where: { agencyId: agencyA.id },
    });
    if (!pmA) {
      pmA = await prisma.projectMember.create({
        data: {
          agencyId: agencyA.id,
          projectId: projectA.id,
          userId: memberAUser.id,
        },
      });
    }

    let pmB = await prisma.projectMember.findFirst({
      where: { agencyId: agencyB.id },
    });
    if (!pmB) {
      pmB = await prisma.projectMember.create({
        data: {
          agencyId: agencyB.id,
          projectId: projectB.id,
          userId: memberBUser.id,
        },
      });
    }

    // Lookup via scoped client using compound key in Agency A
    const foundA = await scopedA.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: pmA.projectId,
          userId: pmA.userId,
        },
      },
    });
    expect(foundA).not.toBeNull();
    expect(foundA?.agencyId).toBe(agencyA.id);

    // Attempt cross-agency lookup via Agency A's scoped client with Agency B's compound key
    const crossFound = await scopedA.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: pmB.projectId,
          userId: pmB.userId,
        },
      },
    });
    expect(crossFound).toBeNull();
  });

  it('update, delete, and upsert on tenant models fail closed with a clear error', async () => {
    const scopedA = createScopedPrisma(agencyA.id);

    await expect(
      scopedA.task.update({
        where: { id: 'some-task-id' },
        data: { title: 'New' },
      } as any),
    ).rejects.toThrow(/disabled for isolation safety; use updateMany instead/);

    await expect(
      scopedA.task.delete({
        where: { id: 'some-task-id' },
      } as any),
    ).rejects.toThrow(/disabled for isolation safety; use deleteMany instead/);

    await expect(
      scopedA.task.upsert({
        where: { id: 'some-task-id' },
        create: { title: 'New' },
        update: { title: 'New' },
      } as any),
    ).rejects.toThrow(/disabled for isolation safety; use create\/updateMany instead/);
  });

  it('clientId scoping enforces client_id partition for CLIENT-role callers', async () => {
    const clientA = await prisma.client.create({
      data: {
        agencyId: agencyA.id,
        companyName: 'Scoped Prisma Client A',
        contactName: 'Client A',
        email: 'scoped-client-a@example.test',
      },
    });
    const clientB = await prisma.client.create({
      data: {
        agencyId: agencyA.id,
        companyName: 'Scoped Prisma Client B',
        contactName: 'Client B',
        email: 'scoped-client-b@example.test',
      },
    });
    const ownProject = await prisma.project.create({
      data: {
        agencyId: agencyA.id,
        clientId: clientA.id,
        managerId: adminA.id,
        name: 'Scoped Prisma Client A Project',
      },
    });
    const crossClientProject = await prisma.project.create({
      data: {
        agencyId: agencyA.id,
        clientId: clientB.id,
        managerId: adminA.id,
        name: 'Scoped Prisma Client B Project',
      },
    });

    const scopedClientA = createScopedPrisma(agencyA.id, clientA.id);

    await expect(
      scopedClientA.client.findFirst({ where: { id: clientA.id } }),
    ).resolves.toMatchObject({ id: clientA.id });
    await expect(
      scopedClientA.client.findFirst({ where: { id: clientB.id } }),
    ).resolves.toBeNull();

    const allProjects = await scopedClientA.project.findMany();
    expect(allProjects.map((project) => project.id)).toEqual([ownProject.id]);

    await expect(
      scopedClientA.project.findFirst({ where: { id: crossClientProject.id } }),
    ).resolves.toBeNull();

    const visibleMeeting = await prisma.meeting.create({
      data: {
        agencyId: agencyA.id,
        projectId: ownProject.id,
        title: 'Scoped client meeting',
        meetingDate: new Date(),
        visibleToClient: true,
        createdBy: adminA.id,
      },
    });

    const meetings = await scopedClientA.meeting.findMany({ where: { visibleToClient: true } });
    expect(meetings.every((meeting) => meeting.projectId === ownProject.id)).toBe(true);

    await prisma.meeting.delete({ where: { id: visibleMeeting.id } });
    await prisma.project.deleteMany({ where: { id: { in: [ownProject.id, crossClientProject.id] } } });
    await prisma.client.deleteMany({ where: { id: { in: [clientA.id, clientB.id] } } });
  });
});

