import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRepository } from '../project.repository';
import { prisma } from '../../../lib/prisma';
import { UserRole } from '@prisma/client';

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    task: {
      // needed because findById now calls task.groupBy to compute progress
      groupBy: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    projectMember: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises)),
  },
}));

describe('ProjectRepository (Unit & Isolation)', () => {
  const AGENCY_A_ID = 'agency-a-111';
  const PROJECT_ID = 'proj-999';

  let repoA: ProjectRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repoA = new ProjectRepository(AGENCY_A_ID);
  });

  describe('findById — Tenant Isolation', () => {
    it('returns project when it belongs to the agency', async () => {
      const mockProject = {
        id: PROJECT_ID,
        agencyId: AGENCY_A_ID,
        name: 'Website Redesign',
      };
      (prisma.project.findFirst as any).mockResolvedValue(mockProject);
      // groupBy is called to compute progress; returning [] yields progress = 0
      (prisma.task.groupBy as any).mockResolvedValue([]);

      const result = await repoA.findById(PROJECT_ID);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, agencyId: AGENCY_A_ID },
        select: expect.any(Object),
      });
      expect(result).toEqual({
        ...mockProject,
        progress: 0,
      });
    });

    it('Scenario 1 — throws 404 NOT_FOUND when querying a cross-agency project', async () => {
      // Prisma returns null because agencyId does not match
      (prisma.project.findFirst as any).mockResolvedValue(null);

      await expect(repoA.findById('cross-agency-proj-id')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'cross-agency-proj-id', agencyId: AGENCY_A_ID },
        select: expect.any(Object),
      });
    });
  });

  describe('update — Tenant Scoped updateMany with count check', () => {
    it('updates project using updateMany scoped by agencyId', async () => {
      (prisma.project.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.project.findFirst as any).mockResolvedValue({
        id: PROJECT_ID,
        agencyId: AGENCY_A_ID,
        name: 'Updated Name',
      });
      // groupBy needed for progress computation in findById (called after updateMany)
      (prisma.task.groupBy as any).mockResolvedValue([]);

      const updated = await repoA.update(PROJECT_ID, { name: 'Updated Name' });

      expect(prisma.project.updateMany).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, agencyId: AGENCY_A_ID },
        data: { name: 'Updated Name' },
      });
      expect(updated.name).toBe('Updated Name');
    });

    it('Scenario 2 (project) — throws 404 when updateMany affects 0 rows (cross-tenant)', async () => {
      // When attempting to update another agency's project, updateMany affects 0 rows
      (prisma.project.updateMany as any).mockResolvedValue({ count: 0 });

      await expect(
        repoA.update('cross-agency-proj-id', { name: 'Hacked' }),
      ).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });

      expect(prisma.project.updateMany).toHaveBeenCalledWith({
        where: { id: 'cross-agency-proj-id', agencyId: AGENCY_A_ID },
        data: { name: 'Hacked' },
      });
    });
  });

  describe('delete — Tenant Scoped deleteMany with count check', () => {
    it('deletes project using deleteMany scoped by agencyId', async () => {
      (prisma.project.deleteMany as any).mockResolvedValue({ count: 1 });

      await expect(repoA.delete(PROJECT_ID)).resolves.toBeUndefined();

      expect(prisma.project.deleteMany).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, agencyId: AGENCY_A_ID },
      });
    });

    it('throws 404 when deleteMany affects 0 rows (cross-tenant project)', async () => {
      (prisma.project.deleteMany as any).mockResolvedValue({ count: 0 });

      await expect(repoA.delete('cross-agency-proj-id')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });

      expect(prisma.project.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cross-agency-proj-id', agencyId: AGENCY_A_ID },
      });
    });
  });

  describe('create — Foreign Key & Agency Validation', () => {
    it('verifies client and manager belong to the same agency', async () => {
      (prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1', agencyId: AGENCY_A_ID });
      (prisma.user.findFirst as any).mockResolvedValue({ id: 'mgr-1', agencyId: AGENCY_A_ID });
      (prisma.project.create as any).mockResolvedValue({
        id: 'new-proj',
        agencyId: AGENCY_A_ID,
        name: 'New Project',
      });

      const res = await repoA.create({
        clientId: 'client-1',
        managerId: 'mgr-1',
        name: 'New Project',
      });

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'client-1', agencyId: AGENCY_A_ID },
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'mgr-1',
          agencyId: AGENCY_A_ID,
          role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
          isActive: true,
        },
      });
      expect(res.name).toBe('New Project');
    });

    it('throws 404 if client belongs to another agency', async () => {
      (prisma.client.findFirst as any).mockResolvedValue(null);

      await expect(
        repoA.create({
          clientId: 'client-other-agency',
          managerId: 'mgr-1',
          name: 'Invalid Proj',
        }),
      ).rejects.toMatchObject({
        status: 404,
        message: 'Client not found.',
      });
    });
  });
});
