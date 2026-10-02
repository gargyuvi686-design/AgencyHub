/**
 * Unit test — ActivityService
 *
 * Key invariant (doc 02 §3.2):
 *   "agency_id and client_id come from the verified JWT/session, never from
 *    request body, query or URL."
 *
 * This test verifies that activityService.log() stamps agencyId from ctx
 * and strips any agencyId that was accidentally included in metadata.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activityService } from '../activity.service';
import { prisma } from '../../../lib/prisma';

// Mock prisma.activityLog.create so no real DB is needed
vi.mock('../../../lib/prisma', () => ({
  prisma: {
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: 'mock-log-id' }),
    },
  },
}));

const mockCreate = prisma.activityLog.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockCreate.mockClear();
});

describe('ActivityService.log', () => {
  const ctx = {
    userId: 'user-123',
    role: 'AGENCY_ADMIN',
    agencyId: 'agency-abc',
    clientId: null,
  };

  it('stamps agencyId from ctx, not from metadata', async () => {
    await activityService.log({
      ctx,
      eventType: 'client.created',
      entityType: 'client',
      entityId: 'client-1',
      metadata: { name: 'Nike' },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.agencyId).toBe('agency-abc');
  });

  it('strips agencyId if accidentally included in metadata', async () => {
    await activityService.log({
      ctx,
      eventType: 'client.created',
      entityType: 'client',
      entityId: 'client-1',
      // Caller accidentally passes agencyId in metadata — must be removed
      metadata: { agencyId: 'attacker-agency', name: 'Malicious' },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    // agencyId on the row itself is from ctx
    expect(data.agencyId).toBe('agency-abc');
    // agencyId must NOT appear in the stored metadata
    expect((data.metadata as Record<string, unknown>)['agencyId']).toBeUndefined();
    expect((data.metadata as Record<string, unknown>)['name']).toBe('Malicious');
  });

  it('resolves actorType = USER for AGENCY_ADMIN', async () => {
    await activityService.log({ ctx, eventType: 'task.created' });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.actorType).toBe('USER');
  });

  it('resolves actorType = USER for AGENCY_MEMBER', async () => {
    await activityService.log({
      ctx: { ...ctx, role: 'AGENCY_MEMBER' },
      eventType: 'task.created',
    });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.actorType).toBe('USER');
  });

  it('resolves actorType = SUPER_ADMIN for SUPER_ADMIN', async () => {
    await activityService.log({
      ctx: { ...ctx, role: 'SUPER_ADMIN', agencyId: null },
      eventType: 'agency.suspended',
    });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.actorType).toBe('SUPER_ADMIN');
    expect(data.agencyId).toBeNull();
  });

  it('resolves actorType = CLIENT for CLIENT role', async () => {
    await activityService.log({
      ctx: { ...ctx, role: 'CLIENT', clientId: 'client-xyz' },
      eventType: 'feedback.submitted',
    });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.actorType).toBe('CLIENT');
  });

  it('passes projectId, entityId, visibleToClient through correctly', async () => {
    await activityService.log({
      ctx,
      eventType: 'task.completed',
      entityType: 'task',
      entityId: 'task-999',
      projectId: 'project-555',
      visibleToClient: true,
      metadata: { title: 'Final review' },
    });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.projectId).toBe('project-555');
    expect(data.entityId).toBe('task-999');
    expect(data.visibleToClient).toBe(true);
    expect((data.metadata as Record<string, unknown>)['title']).toBe('Final review');
  });

  it('null metadata is stored as null (not empty object)', async () => {
    await activityService.log({ ctx, eventType: 'project.created' });
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.metadata).toBeNull();
  });
});
