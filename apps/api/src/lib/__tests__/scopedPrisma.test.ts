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
});
