import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRepository } from '../task.repository';
import { prisma } from '../../../lib/prisma';

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    task: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    milestone: {
      findFirst: vi.fn(),
    },
  },
}));

describe('TaskRepository (Unit & Isolation)', () => {
  const AGENCY_A_ID = 'agency-a-111';
  const TASK_ID = 'task-100';
  const PROJECT_ID = 'proj-200';

  let repoA: TaskRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repoA = new TaskRepository(AGENCY_A_ID);
  });

  describe('findById — Tenant Scoping', () => {
    it('returns task when it belongs to agency', async () => {
      const mockTask = { id: TASK_ID, agencyId: AGENCY_A_ID, title: 'Do work' };
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);

      const res = await repoA.findById(TASK_ID);

      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: TASK_ID, agencyId: AGENCY_A_ID },
        select: expect.any(Object),
      });
      expect(res).toEqual({
        ...mockTask,
        isOverdue: false,
        isDueSoon: false,
      });
    });

    it('throws 404 when task belongs to another agency', async () => {
      (prisma.task.findFirst as any).mockResolvedValue(null);

      await expect(repoA.findById('cross-agency-task')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('update — Scenario 2: updateMany scoped by agencyId with count check', () => {
    it('updates task when belonging to agency', async () => {
      (prisma.task.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.task.findFirst as any).mockResolvedValue({
        id: TASK_ID,
        agencyId: AGENCY_A_ID,
        title: 'Updated Title',
      });

      const updated = await repoA.update(TASK_ID, { title: 'Updated Title' });

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: TASK_ID, agencyId: AGENCY_A_ID },
        data: { title: 'Updated Title' },
      });
      expect(updated.title).toBe('Updated Title');
    });

    it('Scenario 2 — throws 404 when updateMany affects 0 rows (cross-tenant task)', async () => {
      (prisma.task.updateMany as any).mockResolvedValue({ count: 0 });

      await expect(
        repoA.update('cross-agency-task-id', { title: 'Hacked' }),
      ).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: 'cross-agency-task-id', agencyId: AGENCY_A_ID },
        data: { title: 'Hacked' },
      });
    });
  });

  describe('delete — tenant and member ownership scope', () => {
    it('deletes task with agency scope and returns the removed task', async () => {
      (prisma.task.delete as any).mockResolvedValue({ id: TASK_ID, title: 'Do work' });

      await expect(repoA.delete(TASK_ID)).resolves.toMatchObject({ id: TASK_ID });

      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: TASK_ID, agencyId: AGENCY_A_ID },
        select: expect.any(Object),
      });
    });

    it('constrains a member delete to tasks they created or are assigned', async () => {
      (prisma.task.delete as any).mockResolvedValue({ id: TASK_ID });
      await repoA.delete(TASK_ID, 'member-id');

      expect(prisma.task.delete).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: TASK_ID,
          agencyId: AGENCY_A_ID,
          OR: [{ createdBy: 'member-id' }, { assigneeId: 'member-id' }],
        },
      }));
    });

    it('throws 404 when a tenant-scoped delete does not match', async () => {
      (prisma.task.delete as any).mockRejectedValue({ code: 'P2025' });

      await expect(repoA.delete('cross-agency-task-id')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('create — Parent Project & FK Validation (Tenancy Rule §3.5)', () => {
    it('verifies parent project belongs to agency before creating task', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: PROJECT_ID, agencyId: AGENCY_A_ID });
      (prisma.task.create as any).mockResolvedValue({
        id: 'new-task',
        agencyId: AGENCY_A_ID,
        title: 'New Task',
      });

      const res = await repoA.create({
        projectId: PROJECT_ID,
        title: 'New Task',
        createdBy: 'user-1',
      });

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, agencyId: AGENCY_A_ID },
      });
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agencyId: AGENCY_A_ID,
          projectId: PROJECT_ID,
          title: 'New Task',
        }),
        select: expect.any(Object),
      });
      expect(res.title).toBe('New Task');
    });

    it('throws 404 if parent project belongs to another agency (Scenario 11)', async () => {
      (prisma.project.findFirst as any).mockResolvedValue(null);

      await expect(
        repoA.create({
          projectId: 'other-agency-project',
          title: 'Illegal Task',
          createdBy: 'user-1',
        }),
      ).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });

      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });
});
