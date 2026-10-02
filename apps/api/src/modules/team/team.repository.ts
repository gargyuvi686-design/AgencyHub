import { BaseRepository, PaginatedResult } from '../../lib/baseRepository';
import { Errors } from '../../lib/errors';
import { UserRole } from '@prisma/client';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/**
 * TeamRepository — scoped to a single agency.
 *
 * All queries inject agencyId via this.tenantWhere().
 * Cross-agency user IDs always return 404 (tenancy invariant, doc 02 §3.4).
 */
export class TeamRepository extends BaseRepository {
  /**
   * List agency team members (AGENCY_ADMIN / AGENCY_MEMBER only).
   * CLIENT users are not listed in /team.
   */
  async list(opts: {
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<TeamMember>> {
    if (opts.q) {
      return this.paginate(
        this.db.user,
        {
          agencyId: this.agencyId,
          role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
          OR: [{ name: { contains: opts.q } }, { email: { contains: opts.q } }],
        },
        opts,
        {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      );
    }

    return this.paginate(
      this.db.user,
      {
        agencyId: this.agencyId,
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
      },
      opts,
      {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    );
  }

  /**
   * Find a team member by ID within this agency.
   * Returns 404 if not found or belongs to a different agency.
   */
  async findMember(userId: string): Promise<TeamMember> {
    return this.findOrFail<TeamMember>(
      this.db.user,
      userId,
      { role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] } },
      'User',
    );
  }

  /**
   * Count active AGENCY_ADMIN users for last-admin guard.
   */
  async countActiveAdmins(): Promise<number> {
    return this.db.user.count({
      where: {
        agencyId: this.agencyId,
        role: UserRole.AGENCY_ADMIN,
        isActive: true,
      },
    });
  }

  /**
   * Update role or isActive for a team member.
   * The caller must have already verified: not self, not last admin.
   */
  async updateMember(userId: string, data: { role?: UserRole; isActive?: boolean }): Promise<TeamMember> {
    const result = await this.db.user.updateMany({
      where: { id: userId, agencyId: this.agencyId },
      data,
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('User');
    }

    return this.findMember(userId);
  }

  /**
   * Soft-delete (deactivate) a team member.
   */
  async deactivateMember(userId: string): Promise<void> {
    const result = await this.db.user.updateMany({
      where: { id: userId, agencyId: this.agencyId },
      data: { isActive: false },
    });

    if (result.count === 0) {
      throw Errors.NOT_FOUND('User');
    }
  }

  /**
   * List pending (unused and unexpired) team invitations for this agency.
   */
  async listPendingInvitations(): Promise<Array<{
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    expiresAt: Date;
  }>> {
    return this.db.invitation.findMany({
      where: {
        agencyId: this.agencyId,
        usedAt: null,
        expiresAt: { gt: new Date() },
        role: { in: [UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER] },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
