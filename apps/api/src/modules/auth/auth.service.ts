import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { Errors } from '../../lib/errors';
import { hashPassword, comparePassword } from '../../lib/password';
import { signAuthToken } from '../../lib/jwt';
import { AgencyStatus, UserRole, ActorType } from '@prisma/client';
import {
  LoginInput,
  RegisterAgencyInput,
  AcceptInviteInput,
} from './auth.schemas';
import { SupportContext } from '../../types/express';

export class AuthService {
  /**
   * Authenticate user with email and password.
   */
  async login(input: LoginInput) {
    const email = input.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            plan: true,
          },
        },
      },
    });

    // Uniform timing / generic message to avoid email enumeration
    if (!user || !user.isActive) {
      throw Errors.UNAUTHORIZED();
    }

    const isValidPassword = await comparePassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw Errors.UNAUTHORIZED();
    }

    // Tenancy rule: Suspended agency blocks login
    if (user.agency && user.agency.status === AgencyStatus.SUSPENDED) {
      throw Errors.SUSPENDED();
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
      clientId: user.clientId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        agencyId: user.agencyId,
        clientId: user.clientId,
      },
      agency: user.agency ?? undefined,
      token,
    };
  }

  /**
   * Get authenticated user profile along with agency and support state.
   */
  async getMe(userId: string, support?: SupportContext) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        agencyId: true,
        clientId: true,
        isActive: true,
        createdAt: true,
        agency: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            plan: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw Errors.UNAUTHORIZED();
    }

    let supportInfo = undefined;
    if (user.role === 'SUPER_ADMIN' && support) {
      // Fetch support agency name for clear UI display
      const supportAgency = await prisma.agency.findUnique({
        where: { id: support.supportAgencyId },
        select: { id: true, name: true, slug: true, status: true },
      });

      supportInfo = {
        inSupportMode: true,
        supportAgencyId: support.supportAgencyId,
        supportAgencyName: supportAgency?.name ?? support.supportAgencyName,
        supportAgencySlug: supportAgency?.slug,
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        agencyId: user.agencyId,
        clientId: user.clientId,
        createdAt: user.createdAt,
      },
      agency: user.agency ?? undefined,
      support: supportInfo,
    };
  }

  /**
   * Self-serve agency registration (onboarding).
   * Creates Agency + AGENCY_ADMIN user with registrant-chosen password.
   */
  async registerAgency(input: RegisterAgencyInput) {
    const slug = input.slug.toLowerCase().trim();
    const email = input.contactEmail.toLowerCase().trim();

    // Verify slug uniqueness
    const existingAgency = await prisma.agency.findUnique({
      where: { slug },
    });
    if (existingAgency) {
      throw Errors.CONFLICT('An agency with this slug already exists.');
    }

    // Verify email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw Errors.CONFLICT('A user with this email address already exists.');
    }

    const hashedPassword = await hashPassword(input.password);

    // Atomically create agency, user, and activity log
    const result = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name: input.agencyName.trim(),
          slug,
          ownerName: input.ownerName.trim(),
          contactEmail: email,
          contactPhone: input.contactPhone?.trim() ?? null,
          status: AgencyStatus.ACTIVE,
          plan: 'FREE',
        },
      });

      const user = await tx.user.create({
        data: {
          agencyId: agency.id,
          name: input.ownerName.trim(),
          email,
          passwordHash: hashedPassword,
          role: UserRole.AGENCY_ADMIN,
          isActive: true,
        },
      });

      await tx.activityLog.create({
        data: {
          agencyId: agency.id,
          actorType: ActorType.USER,
          actorId: user.id,
          eventType: 'agency.registered',
          entityType: 'agency',
          entityId: agency.id,
          visibleToClient: false,
          metadata: { agencyName: agency.name, slug: agency.slug },
        },
      });

      return { agency, user };
    });

    const token = signAuthToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      agencyId: result.agency.id,
      clientId: null,
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        agencyId: result.agency.id,
        clientId: null,
      },
      agency: {
        id: result.agency.id,
        name: result.agency.name,
        slug: result.agency.slug,
        status: result.agency.status,
        plan: result.agency.plan,
      },
      token,
    };
  }

  /**
   * Accept team invitation and set account password.
   * Only AGENCY_ADMIN and AGENCY_MEMBER roles are supported.
   */
  async acceptInvite(input: AcceptInviteInput) {
    const tokenHash = crypto.createHash('sha256').update(input.token.trim()).digest('hex');

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!invitation) {
      throw Errors.VALIDATION('Invalid or expired invitation token.');
    }

    if (invitation.usedAt) {
      throw Errors.VALIDATION('This invitation has already been accepted.');
    }

    if (invitation.expiresAt < new Date()) {
      throw Errors.VALIDATION('This invitation has expired.');
    }

    if (invitation.agency.status === AgencyStatus.SUSPENDED) {
      throw Errors.SUSPENDED();
    }

    // Role check: only AGENCY_ADMIN / AGENCY_MEMBER allowed
    const validRoles = ['AGENCY_ADMIN', 'AGENCY_MEMBER'];
    if (!validRoles.includes(invitation.role)) {
      throw Errors.FORBIDDEN('Invitations can only be accepted for agency staff roles.');
    }

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });
    if (existingUser) {
      throw Errors.CONFLICT('A user with this email address already exists.');
    }

    const hashedPassword = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          agencyId: invitation.agencyId,
          name: invitation.email.split('@')[0],
          email: invitation.email.toLowerCase(),
          passwordHash: hashedPassword,
          role: invitation.role as UserRole,
          isActive: true,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      await tx.activityLog.create({
        data: {
          agencyId: invitation.agencyId,
          actorType: ActorType.USER,
          actorId: newUser.id,
          eventType: 'team.invite_accepted',
          entityType: 'user',
          entityId: newUser.id,
          visibleToClient: false,
          metadata: { email: newUser.email, role: newUser.role },
        },
      });

      return newUser;
    });

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
      clientId: null,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        agencyId: user.agencyId,
        clientId: null,
      },
      token,
    };
  }
}

export const authService = new AuthService();
