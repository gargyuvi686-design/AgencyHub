import { BaseRepository, PaginatedResult, PaginationInput } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { Prisma, ProjectStatus } from '@prisma/client';

export interface CreateClientRepoInput {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
}

export interface UpdateClientRepoInput {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string | null;
  notes?: string | null;
}

export class ClientRepository extends BaseRepository {
  /**
   * List clients for this agency with pagination and search.
   * AGENCY_MEMBER sees only clients of projects they are assigned to or manage.
   */
  async list(
    pagination: PaginationInput,
    filters?: { q?: string; userId?: string; role?: string },
  ): Promise<PaginatedResult<any>> {
    const where: Prisma.ClientWhereInput = {
      agencyId: this.agencyId,
    };

    if (filters?.q) {
      where.OR = [
        { companyName: { contains: filters.q } },
        { contactName: { contains: filters.q } },
        { email: { contains: filters.q } },
      ];
    }

    // Role access: AGENCY_MEMBER sees only clients of assigned projects
    if (filters?.role === 'AGENCY_MEMBER' && filters?.userId) {
      where.projects = {
        some: {
          agencyId: this.agencyId,
          OR: [
            { managerId: filters.userId },
            { members: { some: { userId: filters.userId, agencyId: this.agencyId } } },
          ],
        },
      };
    }

    const result = await this.paginate<any>(this.db.client, where, pagination, {
      select: {
        id: true,
        agencyId: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projects: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also enrich with active projects count
    const enrichedData = await Promise.all(
      result.data.map(async (c: any) => {
        const activeProjectsCount = await this.db.project.count({
          where: {
            agencyId: this.agencyId,
            clientId: c.id,
            status: { not: ProjectStatus.COMPLETED },
          },
        });
        return {
          ...c,
          activeProjectsCount,
        };
      }),
    );

    return {
      ...result,
      data: enrichedData,
    };
  }

  /**
   * Find a single client by ID within this agency.
   * Throws 404 NOT_FOUND if not found or cross-agency.
   * If caller is AGENCY_MEMBER, enforces that the member is assigned to at least one project for this client.
   */
  async findById(clientId: string, requestingUserId?: string, role?: string): Promise<any> {
    const where: Prisma.ClientWhereInput = {
      id: clientId,
      agencyId: this.agencyId,
    };

    if (role === 'AGENCY_MEMBER' && requestingUserId) {
      where.projects = {
        some: {
          agencyId: this.agencyId,
          OR: [
            { managerId: requestingUserId },
            { members: { some: { userId: requestingUserId, agencyId: this.agencyId } } },
          ],
        },
      };
    }

    const client = await this.db.client.findFirst({
      where,
      select: {
        id: true,
        agencyId: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            projects: true,
            users: true,
          },
        },
      },
    });

    if (!client) {
      throw Errors.NOT_FOUND('Client');
    }

    const activeProjectsCount = await this.db.project.count({
      where: {
        agencyId: this.agencyId,
        clientId: client.id,
        status: { not: ProjectStatus.COMPLETED },
      },
    });

    return {
      ...client,
      activeProjectsCount,
    };
  }

  /**
   * Create a new client record.
   */
  async create(input: CreateClientRepoInput): Promise<any> {
    return this.db.client.create({
      data: {
        agencyId: this.agencyId,
        companyName: input.companyName,
        contactName: input.contactName,
        email: input.email.toLowerCase().trim(),
        phone: input.phone ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  /**
   * Update client details.
   */
  async update(clientId: string, input: UpdateClientRepoInput): Promise<any> {
    const data: Prisma.ClientUpdateManyMutationInput = {};
    if (input.companyName !== undefined) data.companyName = input.companyName;
    if (input.contactName !== undefined) data.contactName = input.contactName;
    if (input.email !== undefined) data.email = input.email.toLowerCase().trim();
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.notes !== undefined) data.notes = input.notes;

    const result = await this.db.client.updateMany({
      where: {
        id: clientId,
        agencyId: this.agencyId,
      },
      data,
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Client');
    }

    return this.findById(clientId);
  }

  /**
   * Delete a client.
   * Returns 409 CONFLICT if client has ANY project (any status).
   */
  async delete(clientId: string): Promise<void> {
    const projectCount = await this.db.project.count({
      where: {
        agencyId: this.agencyId,
        clientId,
      },
    });

    if (projectCount > 0) {
      throw Errors.CONFLICT('Cannot delete client with existing projects.');
    }

    const result = await this.db.client.deleteMany({
      where: {
        id: clientId,
        agencyId: this.agencyId,
      },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('Client');
    }
  }
}
