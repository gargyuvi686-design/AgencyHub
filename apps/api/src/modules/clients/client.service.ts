import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import { InvitationRole } from '@prisma/client';
import { ClientRepository } from './client.repository';
import { activityService, ServiceContext } from '../activity/activity.service';
import type { CreateClientInput, UpdateClientInput, PortalInviteInput } from './client.schemas';

export class ClientService {
  /**
   * POST /clients — Create a new client record.
   * Logs client.created.
   */
  async create(ctx: ServiceContext, input: CreateClientInput) {
    const agencyId = ctx.agencyId!;
    const repo = new ClientRepository(agencyId);

    const companyName = input.companyName || input.name!;
    const contactName = input.contactName || input.name || companyName;

    const client = await repo.create({
      companyName,
      contactName,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
    });

    await activityService.log({
      ctx,
      eventType: 'client.created',
      entityType: 'client',
      entityId: client.id,
      metadata: { companyName: client.companyName, email: client.email },
    });

    return client;
  }

  /**
   * GET /clients — List clients with search, pagination, and active project counts.
   * Scoped to member's assigned projects if role is AGENCY_MEMBER.
   */
  async list(ctx: ServiceContext, opts: { q?: string; page?: number; limit?: number }) {
    const agencyId = ctx.agencyId!;
    const repo = new ClientRepository(agencyId);
    return repo.list(
      { page: opts.page, limit: opts.limit },
      { q: opts.q, userId: ctx.userId, role: ctx.role },
    );
  }

  /**
   * GET /clients/:id — Single client detail + projects list + portal users + stats.
   * Returns 404 if caller is AGENCY_MEMBER and not assigned to any project for this client.
   */
  async get(ctx: ServiceContext, clientId: string) {
    const agencyId = ctx.agencyId!;
    const repo = new ClientRepository(agencyId);
    return repo.findById(clientId, ctx.userId, ctx.role);
  }

  /**
   * PATCH /clients/:id — Update client details.
   * Logs client.updated.
   */
  async update(ctx: ServiceContext, clientId: string, input: UpdateClientInput) {
    const agencyId = ctx.agencyId!;
    const repo = new ClientRepository(agencyId);

    const updated = await repo.update(clientId, {
      companyName: input.companyName || input.name,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
    });

    await activityService.log({
      ctx,
      eventType: 'client.updated',
      entityType: 'client',
      entityId: clientId,
      metadata: { companyName: updated.companyName },
    });

    return updated;
  }

  /**
   * POST /clients/:id/portal-users — Invite a client contact to the portal.
   * Creates Invitation with role=CLIENT, clientId=id.
   * Logs client_user.invited.
   */
  async inviteUser(ctx: ServiceContext, clientId: string, input: PortalInviteInput) {
    const agencyId = ctx.agencyId!;
    const repo = new ClientRepository(agencyId);

    // Verify client exists in agency
    const client = await repo.findById(clientId);

    const email = input.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw Errors.CONFLICT('A user with this email address already exists.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        agencyId,
        clientId: client.id,
        email,
        role: InvitationRole.CLIENT,
        tokenHash,
        expiresAt,
        createdBy: ctx.userId,
      },
    });

    await activityService.log({
      ctx,
      eventType: 'client_user.invited',
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { email, clientId: client.id, clientName: client.companyName },
    });

    return {
      invitationId: invitation.id,
      acceptLink: `/accept-invite?token=${rawToken}`,
      token: rawToken,
      expiresAt,
    };
  }

  /**
   * DELETE /clients/:id — Delete client (blocked if any projects exist).
   * Logs client.deleted.
   */
  async delete(ctx: ServiceContext, clientId: string) {
    const agencyId = ctx.agencyId!;
    const repo = new ClientRepository(agencyId);

    // Ensure client exists first
    const client = await repo.findById(clientId);

    await repo.delete(clientId);

    await activityService.log({
      ctx,
      eventType: 'client.deleted',
      entityType: 'client',
      entityId: clientId,
      metadata: { companyName: client.companyName },
    });
  }
}

export const clientService = new ClientService();
