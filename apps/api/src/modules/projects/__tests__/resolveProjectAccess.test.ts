import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../../lib/prisma';
import { resolveProjectAccess } from '../resolveProjectAccess';

describe('resolveProjectAccess Matrix Tests', () => {
  let agencyA: any;
  let agencyB: any;
  let clientA: any;
  let adminA: any;
  let memberAssigned: any;
  let memberUnassigned: any;
  let clientUserA: any;
  let projectA: any;

  beforeAll(async () => {
    agencyA = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    agencyB = await prisma.agency.findUnique({ where: { slug: 'apex-creative' } });

    clientA = await prisma.client.findFirst({ where: { agencyId: agencyA.id } });


    adminA = await prisma.user.findUnique({ where: { email: 'admin@acme.test' } });
    memberAssigned = await prisma.user.findUnique({ where: { email: 'member@acme.test' } });

    // Create an unassigned member in Agency A
    memberUnassigned = await prisma.user.create({
      data: {
        agencyId: agencyA.id,
        name: 'Unassigned Member',
        email: `unassigned-${Date.now()}@acme.test`,
        passwordHash: 'hash',
        role: 'AGENCY_MEMBER',
      },
    });

    clientUserA = await prisma.user.findUnique({ where: { email: 'client@nike.test' } });

    // Create a project in agency A for client A
    projectA = await prisma.project.create({
      data: {
        agencyId: agencyA.id,
        clientId: clientA.id,
        managerId: adminA.id,
        name: 'Matrix Test Project',
      },
    });

    // Assign memberAssigned to projectA
    await prisma.projectMember.create({
      data: {
        agencyId: agencyA.id,
        projectId: projectA.id,
        userId: memberAssigned.id,
      },
    });
  });

  it('Agency Admin has full access to any agency project', async () => {
    const ctx = {
      userId: adminA.id,
      role: 'AGENCY_ADMIN',
      agencyId: agencyA.id,
      clientId: null,
    };
    const res = await resolveProjectAccess(ctx, projectA.id);
    expect(res.id).toBe(projectA.id);
  });

  it('Assigned Agency Member has access to the project', async () => {
    const ctx = {
      userId: memberAssigned.id,
      role: 'AGENCY_MEMBER',
      agencyId: agencyA.id,
      clientId: null,
    };
    const res = await resolveProjectAccess(ctx, projectA.id);
    expect(res.id).toBe(projectA.id);
  });

  it('Unassigned Agency Member returns 404 NOT_FOUND', async () => {
    const ctx = {
      userId: memberUnassigned.id,
      role: 'AGENCY_MEMBER',
      agencyId: agencyA.id,
      clientId: null,
    };
    await expect(resolveProjectAccess(ctx, projectA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('Client user with matching clientId has access to project', async () => {
    const ctx = {
      userId: clientUserA.id,
      role: 'CLIENT',
      agencyId: agencyA.id,
      clientId: clientA.id,
    };
    const res = await resolveProjectAccess(ctx, projectA.id);
    expect(res.id).toBe(projectA.id);
  });

  it('Client user with different clientId returns 404 NOT_FOUND', async () => {
    const ctx = {
      userId: 'other-client-user',
      role: 'CLIENT',
      agencyId: agencyA.id,
      clientId: 'different-client-id',
    };
    await expect(resolveProjectAccess(ctx, projectA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('Super Admin in support mode for agency A has access to project', async () => {
    const ctx = {
      userId: 'super-admin-id',
      role: 'SUPER_ADMIN',
      agencyId: agencyA.id,
      clientId: null,
    };
    const res = await resolveProjectAccess(ctx, projectA.id);
    expect(res.id).toBe(projectA.id);
  });

  it('Cross-agency access returns 404 NOT_FOUND', async () => {
    // Agency B Admin trying to access Agency A Project
    const ctx = {
      userId: 'agency-b-admin',
      role: 'AGENCY_ADMIN',
      agencyId: agencyB.id,
      clientId: null,
    };
    await expect(resolveProjectAccess(ctx, projectA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
