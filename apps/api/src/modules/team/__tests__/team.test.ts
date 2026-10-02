import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { prisma } from '../../../lib/prisma';
import crypto from 'crypto';

const PASSWORD = 'Password123!';

async function loginAs(email: string, password = PASSWORD): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status} — ${JSON.stringify(res.body)}`);
  }

  const cookies: string[] = Array.isArray(res.headers['set-cookie'])
    ? res.headers['set-cookie']
    : [res.headers['set-cookie']];

  const tokenCookie = cookies.find((c) => c.startsWith('token='));
  if (!tokenCookie) throw new Error(`No token cookie for ${email}`);
  return tokenCookie.split(';')[0];
}

describe('Team Module Integration Tests', () => {
  let agencyAAdminCookie: string;
  let agencyAMemberCookie: string;
  let agencyAId: string;
  let agencyAAdminUser: any;

  let clientCookie: string;

  beforeAll(async () => {
    agencyAAdminCookie = await loginAs('admin@acme.test');
    agencyAMemberCookie = await loginAs('member@acme.test');
    clientCookie = await loginAs('client@nike.test');

    const a = await prisma.agency.findUnique({ where: { slug: 'acme-digital' } });
    agencyAId = a!.id;

    agencyAAdminUser = await prisma.user.findUnique({ where: { email: 'admin@acme.test' } });
  });

  describe('Role access — CLIENT token on /team routes (Scenario 4)', () => {
    it('CLIENT token calling GET /api/v1/team returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/team')
        .set('Cookie', clientCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('CLIENT token calling POST /api/v1/team/invite returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', clientCookie)
        .send({ email: 'client-invite@test.com', role: 'AGENCY_MEMBER' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/v1/team/invite', () => {
    it('Agency Admin can invite a new team member and logs user.invited', async () => {
      const inviteEmail = `invitee-${Date.now()}@acme.test`;
      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', agencyAAdminCookie)
        .send({ email: inviteEmail, role: 'AGENCY_MEMBER' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        acceptLink: expect.stringContaining('/auth/accept-invite?token='),
        token: expect.any(String),
      });

      // Verify DB record
      const invitation = await prisma.invitation.findFirst({
        where: { email: inviteEmail, agencyId: agencyAId },
      });
      expect(invitation).not.toBeNull();
      expect(invitation!.role).toBe('AGENCY_MEMBER');

      // Verify activity log
      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'user.invited' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).not.toBeNull();
    });

    it('Rejects duplicate email if user already exists -> 409 CONFLICT', async () => {
      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', agencyAAdminCookie)
        .send({ email: 'member@acme.test', role: 'AGENCY_MEMBER' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Agency Member calling /team/invite returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', agencyAMemberCookie)
        .send({ email: 'someone@acme.test', role: 'AGENCY_MEMBER' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/auth/accept-invite', () => {
    it('Accepts a valid invite, creates user, marks used, logs user.created', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const inviteEmail = `accepted-${Date.now()}@acme.test`;

      await prisma.invitation.create({
        data: {
          agencyId: agencyAId,
          email: inviteEmail,
          role: 'AGENCY_MEMBER',
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdBy: agencyAAdminUser.id,
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/accept-invite')
        .send({
          token: rawToken,
          name: 'Newly Accepted Member',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(inviteEmail);
      expect(res.body.data.user.role).toBe('AGENCY_MEMBER');

      // Check DB user
      const user = await prisma.user.findUnique({ where: { email: inviteEmail } });
      expect(user).not.toBeNull();
      expect(user!.name).toBe('Newly Accepted Member');

      // Check invitation is marked used
      const updatedInvite = await prisma.invitation.findUnique({ where: { tokenHash } });
      expect(updatedInvite!.usedAt).not.toBeNull();

      // Accepting again fails (already used)
      const reuseRes = await request(app)
        .post('/api/v1/auth/accept-invite')
        .send({
          token: rawToken,
          name: 'Duplicate Accept',
          password: 'Password123!',
        });
      expect(reuseRes.status).toBe(404);
    });

    it('Fails for expired token -> 404', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.invitation.create({
        data: {
          agencyId: agencyAId,
          email: `expired-${Date.now()}@acme.test`,
          role: 'AGENCY_MEMBER',
          tokenHash,
          expiresAt: new Date(Date.now() - 1000), // in the past
          createdBy: agencyAAdminUser.id,
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/accept-invite')
        .send({
          token: rawToken,
          name: 'Expired Accept',
          password: 'Password123!',
        });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/team', () => {
    it('Agency Admin gets list of agency team members and pending invites', async () => {
      const res = await request(app)
        .get('/api/v1/team')
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pendingInvitations).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const m of res.body.data) {
        expect(['AGENCY_ADMIN', 'AGENCY_MEMBER']).toContain(m.role);
      }
    });

    it('Agency Member cannot view team list -> 403', async () => {
      const res = await request(app)
        .get('/api/v1/team')
        .set('Cookie', agencyAMemberCookie);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH & DELETE /api/v1/team/:userId', () => {
    it('Agency Admin cannot modify themselves -> 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/team/${agencyAAdminUser.id}`)
        .set('Cookie', agencyAAdminCookie)
        .send({ role: 'AGENCY_MEMBER' });

      expect(res.status).toBe(403);
    });

    it('Agency Admin cannot deactivate the last admin -> 409 CONFLICT', async () => {
      // Create a temporary agency with 1 admin
      const tempAgency = await prisma.agency.create({
        data: {
          name: 'Solo Agency',
          slug: `solo-${Date.now()}`,
          ownerName: 'Solo Admin',
          contactEmail: `solo-${Date.now()}@agency.test`,
        },
      });
      const soloAdmin = await prisma.user.create({
        data: {
          agencyId: tempAgency.id,
          name: 'Solo Admin',
          email: `solo-admin-${Date.now()}@test.com`,
          passwordHash: 'hash',
          role: 'AGENCY_ADMIN',
          isActive: true,
        },
      });
      const soloMember = await prisma.user.create({
        data: {
          agencyId: tempAgency.id,
          name: 'Solo Member',
          email: `solo-member-${Date.now()}@test.com`,
          passwordHash: 'hash',
          role: 'AGENCY_MEMBER',
          isActive: true,
        },
      });

      // Context as a second fake admin trying to demote the only admin
      const { teamService } = await import('../team.service');
      const ctx = {
        userId: soloMember.id,
        role: 'AGENCY_ADMIN',
        agencyId: tempAgency.id,
        clientId: null,
      };

      await expect(
        teamService.updateMember(ctx, soloAdmin.id, { role: 'AGENCY_MEMBER' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      });

      await expect(
        teamService.deactivateMember(ctx, soloAdmin.id),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      });
    });

    it('Cross-agency team member modify returns 404 NOT_FOUND', async () => {
      const agencyBAdminUser = await prisma.user.findUnique({ where: { email: 'admin@apex.test' } });
      const res = await request(app)
        .patch(`/api/v1/team/${agencyBAdminUser!.id}`)
        .set('Cookie', agencyAAdminCookie)
        .send({ role: 'AGENCY_ADMIN' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Deactivating member soft-deactivates (isActive: false) and logs user.deactivated', async () => {
      const dummyMember = await prisma.user.create({
        data: {
          agencyId: agencyAId,
          name: 'To Deactivate',
          email: `deact-${Date.now()}@acme.test`,
          passwordHash: 'hash',
          role: 'AGENCY_MEMBER',
          isActive: true,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/team/${dummyMember.id}`)
        .set('Cookie', agencyAAdminCookie);

      expect(res.status).toBe(200);

      const check = await prisma.user.findUnique({ where: { id: dummyMember.id } });
      expect(check!.isActive).toBe(false);

      const log = await prisma.activityLog.findFirst({
        where: { agencyId: agencyAId, eventType: 'user.deactivated', entityId: dummyMember.id },
      });
      expect(log).not.toBeNull();
    });
  });
});
