import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import { UserRole, InvitationRole } from '@prisma/client';
import { TeamRepository } from './team.repository';
import { activityService, ServiceContext } from '../activity/activity.service';
import type { InviteInput, UpdateTeamMemberInput } from './team.schemas';

/**
 * Team service — business logic for team management.
 *
 * Called from controller only. Uses TeamRepository (scoped) for all DB access.
 * Activity events are logged here, not in the controller.
 */
export class TeamService {
  /**
   * POST /team/invite — AGENCY_ADMIN only.
   *
   * Generates a SHA-256-hashed invite token, 7-day expiry.
   * Returns the raw accept link (no email sending per TRD §13).
   * Logs user.invited.
   */
  async invite(ctx: ServiceContext, input: InviteInput): Promise<{ acceptLink: string; token: string }> {
    const agencyId = ctx.agencyId!;
    const email = input.email.toLowerCase().trim();

    // Reject if email already has a live user account
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw Errors.CONFLICT('A user with this email address already exists.');
    }

    // Generate a cryptographically random 32-byte token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invitation.create({
      data: {
        agencyId,
        email,
        role: input.role as InvitationRole,
        tokenHash,
        expiresAt,
        createdBy: ctx.userId,
      },
    });

    await activityService.log({
      ctx,
      eventType: 'user.invited',
      entityType: 'invitation',
      metadata: { email, role: input.role },
    });

    // The accept link is the raw token — frontend constructs the URL
    return { acceptLink: `/auth/accept-invite?token=${rawToken}`, token: rawToken };
  }

  /**
   * GET /team — paginated list of team members + pending invitations.
   */
  async listMembers(ctx: ServiceContext, opts: { q?: string; page?: number; limit?: number }) {
    const repo = new TeamRepository(ctx.agencyId!);
    const members = await repo.list(opts);
    const pendingInvitations = await repo.listPendingInvitations();
    return {
      ...members,
      pendingInvitations,
    };
  }

  /**
   * PATCH /team/:userId — change role or isActive.
   *
   * Guards:
   *   - Cannot change your own role or deactivate yourself.
   *   - Cannot demote or deactivate the last active AGENCY_ADMIN (409).
   *   - Cross-agency userId → 404 (from repo).
   */
  async updateMember(ctx: ServiceContext, userId: string, input: UpdateTeamMemberInput) {
    const agencyId = ctx.agencyId!;
    const repo = new TeamRepository(agencyId);

    // Cannot modify yourself
    if (userId === ctx.userId) {
      throw Errors.FORBIDDEN('You cannot change your own role or status.');
    }

    // Load current member (404 if cross-agency or not found)
    const member = await repo.findMember(userId);

    // Last-admin guard: if we're demoting or deactivating an AGENCY_ADMIN
    const wouldLoseAdmin =
      (input.role && input.role !== 'AGENCY_ADMIN' && member.role === UserRole.AGENCY_ADMIN) ||
      (input.isActive === false && member.role === UserRole.AGENCY_ADMIN);

    if (wouldLoseAdmin) {
      const activeAdmins = await repo.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw Errors.CONFLICT('Cannot remove or demote the last active Agency Admin.');
      }
    }

    const data: { role?: UserRole; isActive?: boolean } = {};
    if (input.role) data.role = input.role as UserRole;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const updated = await repo.updateMember(userId, data);

    await activityService.log({
      ctx,
      eventType: input.isActive === false ? 'user.deactivated' : 'user.updated',
      entityType: 'user',
      entityId: userId,
      metadata: { role: input.role, isActive: input.isActive },
    });

    return updated;
  }

  /**
   * DELETE /team/:userId — soft deactivate.
   */
  async deactivateMember(ctx: ServiceContext, userId: string): Promise<void> {
    const agencyId = ctx.agencyId!;
    const repo = new TeamRepository(agencyId);

    if (userId === ctx.userId) {
      throw Errors.FORBIDDEN('You cannot deactivate yourself.');
    }

    const member = await repo.findMember(userId);

    if (member.role === UserRole.AGENCY_ADMIN) {
      const activeAdmins = await repo.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw Errors.CONFLICT('Cannot remove or demote the last active Agency Admin.');
      }
    }

    await repo.deactivateMember(userId);

    await activityService.log({
      ctx,
      eventType: 'user.deactivated',
      entityType: 'user',
      entityId: userId,
    });
  }
}

export const teamService = new TeamService();
