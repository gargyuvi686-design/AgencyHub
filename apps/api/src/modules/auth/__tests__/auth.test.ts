import { describe, it, expect, vi } from 'vitest';
import { hashPassword, comparePassword } from '../../../lib/password';
import {
  signAuthToken,
  verifyAuthToken,
  signSupportToken,
  verifySupportToken,
} from '../../../lib/jwt';
import { requireRole } from '../../../middleware/requireRole';
import { supportGuard } from '../../../middleware/supportGuard';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../lib/errors';

describe('Password Utility', () => {
  it('hashes password with bcrypt and verifies correctly', async () => {
    const raw = 'Password123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true);

    const matches = await comparePassword(raw, hash);
    expect(matches).toBe(true);

    const wrongMatches = await comparePassword('WrongPassword', hash);
    expect(wrongMatches).toBe(false);
  });
});

describe('JWT Utilities', () => {
  it('signs and verifies primary auth tokens', () => {
    const payload = {
      userId: 'user-123',
      email: 'admin@acme.test',
      role: UserRole.AGENCY_ADMIN,
      agencyId: 'agency-123',
      clientId: null,
    };

    const token = signAuthToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAuthToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.email).toBe('admin@acme.test');
    expect(decoded.role).toBe(UserRole.AGENCY_ADMIN);
    expect(decoded.agencyId).toBe('agency-123');
  });

  it('signs and verifies support mode tokens', () => {
    const payload = {
      superAdminId: 'super-1',
      supportAgencyId: 'agency-99',
      supportAgencyName: 'Target Agency',
    };

    const token = signSupportToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifySupportToken(token);
    expect(decoded.superAdminId).toBe('super-1');
    expect(decoded.supportAgencyId).toBe('agency-99');
    expect(decoded.supportAgencyName).toBe('Target Agency');
    expect(decoded.isSupportMode).toBe(true);
  });
});

describe('requireRole Middleware', () => {
  it('allows access when user has the required role', () => {
    const middleware = requireRole(UserRole.AGENCY_ADMIN);
    const req: any = {
      user: {
        userId: 'u1',
        role: UserRole.AGENCY_ADMIN,
      },
    };
    const next = vi.fn();

    middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies access when user does not have the required role', () => {
    const middleware = requireRole(UserRole.SUPER_ADMIN);
    const req: any = {
      user: {
        userId: 'u2',
        role: UserRole.AGENCY_ADMIN,
      },
    };
    const next = vi.fn();

    expect(() => middleware(req, {} as any, next)).toThrowError(AppError);
  });

  it('allows SUPER_ADMIN in support mode to access workspace roles', () => {
    const middleware = requireRole(UserRole.AGENCY_ADMIN, UserRole.AGENCY_MEMBER);
    const req: any = {
      user: {
        userId: 'super-admin-1',
        role: UserRole.SUPER_ADMIN,
      },
      support: {
        superAdminId: 'super-admin-1',
        supportAgencyId: 'agency-1',
      },
    };
    const next = vi.fn();

    middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('supportGuard Middleware', () => {
  it('allows GET requests in support mode', () => {
    const req: any = {
      method: 'GET',
      support: {
        superAdminId: 's1',
        supportAgencyId: 'a1',
      },
    };
    const next = vi.fn();

    supportGuard(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks POST requests in support mode with 403 SUPPORT_MODE_READ_ONLY', () => {
    const req: any = {
      method: 'POST',
      support: {
        superAdminId: 's1',
        supportAgencyId: 'a1',
      },
    };
    const next = vi.fn();

    expect(() => supportGuard(req, {} as any, next)).toThrowError(AppError);
    try {
      supportGuard(req, {} as any, next);
    } catch (err: any) {
      expect(err.code).toBe('SUPPORT_MODE_READ_ONLY');
      expect(err.status).toBe(403);
    }
  });

  it('blocks PATCH and DELETE in support mode', () => {
    const reqPatch: any = {
      method: 'PATCH',
      support: { superAdminId: 's1', supportAgencyId: 'a1' },
    };
    expect(() => supportGuard(reqPatch, {} as any, vi.fn())).toThrowError(AppError);

    const reqDelete: any = {
      method: 'DELETE',
      support: { superAdminId: 's1', supportAgencyId: 'a1' },
    };
    expect(() => supportGuard(reqDelete, {} as any, vi.fn())).toThrowError(AppError);
  });
});
