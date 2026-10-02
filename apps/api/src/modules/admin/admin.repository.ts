/**
 * AdminRepository — unscoped access for Super Admin routes ONLY.
 *
 * Security: this class uses the raw prisma client and has NO agency_id filter.
 * It must NEVER be used outside the admin module (enforced by convention and
 * import structure; the admin routes guard with authenticate + requireRole(SUPER_ADMIN)).
 */
import { prisma } from '../../lib/prisma';
import { AgencyStatus, ActorType } from '@prisma/client';
import { Errors } from '../../lib/errors';

export interface AgencyStats {
  totalAgencies: number;
  activeAgencies: number;
  suspendedAgencies: number;
  totalUsers: number;
  totalClients: number;
  totalProjects: number;
}

export interface AgencyListItem {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  contactEmail: string;
  status: AgencyStatus;
  plan: string;
  createdAt: Date;
  _count: {
    users: number;
    clients: number;
    projects: number;
  };
}

export class AdminRepository {
  /**
   * GET /admin/stats — platform-wide aggregates via grouped queries, not N+1.
   */
  async getPlatformStats(): Promise<AgencyStats> {
    // Single query: group agencies by status to get total, active, suspended counts
    const agencyStatusCounts = await prisma.agency.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    let totalAgencies = 0;
    let activeAgencies = 0;
    let suspendedAgencies = 0;

    for (const row of agencyStatusCounts) {
      totalAgencies += row._count.id;
      if (row.status === AgencyStatus.ACTIVE) activeAgencies = row._count.id;
      if (row.status === AgencyStatus.SUSPENDED) suspendedAgencies = row._count.id;
    }

    // Parallel count queries — no N+1
    const [totalUsers, totalClients, totalProjects] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.project.count(),
    ]);

    return {
      totalAgencies,
      activeAgencies,
      suspendedAgencies,
      totalUsers,
      totalClients,
      totalProjects,
    };
  }

  /**
   * GET /admin/agencies — filtered, paginated list with per-agency counts.
   */
  async listAgencies(params: {
    q?: string;
    status?: AgencyStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: AgencyListItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.q) {
      where.OR = [
        { name: { contains: params.q } },
        { slug: { contains: params.q } },
        { contactEmail: { contains: params.q } },
      ];
    }

    const [agencies, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerName: true,
          contactEmail: true,
          status: true,
          plan: true,
          createdAt: true,
          _count: {
            select: { users: true, clients: true, projects: true },
          },
        },
      }),
      prisma.agency.count({ where }),
    ]);

    return {
      data: agencies as AgencyListItem[],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * GET /admin/agencies/:id — agency detail + stats.
   */
  async getAgencyById(agencyId: string) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerName: true,
        contactEmail: true,
        contactPhone: true,
        status: true,
        plan: true,
        suspendedReason: true,
        createdAt: true,
        _count: {
          select: { users: true, clients: true, projects: true },
        },
      },
    });

    if (!agency) {
      throw Errors.NOT_FOUND('Agency');
    }

    return agency;
  }

  /**
   * PATCH /admin/agencies/:id/status — update status, log event.
   */
  async updateAgencyStatus(
    agencyId: string,
    actorId: string,
    actorEmail: string,
    newStatus: AgencyStatus,
    reason?: string,
  ) {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true, status: true },
    });

    if (!agency) {
      throw Errors.NOT_FOUND('Agency');
    }

    if (newStatus === AgencyStatus.SUSPENDED && !reason) {
      throw Errors.VALIDATION('A reason is required when suspending an agency.');
    }

    const updated = await prisma.agency.update({
      where: { id: agencyId },
      data: {
        status: newStatus,
        suspendedReason: newStatus === AgencyStatus.SUSPENDED ? (reason ?? null) : null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        suspendedReason: true,
      },
    });

    const eventType =
      newStatus === AgencyStatus.SUSPENDED ? 'agency.suspended' : 'agency.activated';

    await prisma.activityLog.create({
      data: {
        agencyId,
        actorType: ActorType.SUPER_ADMIN,
        actorId,
        eventType,
        entityType: 'agency',
        entityId: agencyId,
        visibleToClient: false,
        metadata: {
          superAdminEmail: actorEmail,
          previousStatus: agency.status,
          newStatus,
          ...(reason ? { reason } : {}),
        },
      },
    });

    return updated;
  }

  /**
   * GET /admin/activity — platform-wide activity feed, newest first.
   * Includes agency.* and support.* events with agency name.
   */
  async getPlatformActivity(params: { page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    // Only platform-level events (Super Admin actions)
    const where = {
      OR: [
        { eventType: { startsWith: 'agency.' } },
        { eventType: { startsWith: 'support.' } },
        { eventType: { startsWith: 'admin.' } },
      ],
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          agencyId: true,
          actorType: true,
          actorId: true,
          eventType: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          agency: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const adminRepository = new AdminRepository();
