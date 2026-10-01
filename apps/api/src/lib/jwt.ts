import jwt from 'jsonwebtoken';
import { type CookieOptions } from 'express';
import { env } from '../config/env';
import { UserRole } from '@prisma/client';

export const AUTH_COOKIE_NAME = 'token';
export const SUPPORT_COOKIE_NAME = 'support_token';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  agencyId: string | null;
  clientId: string | null;
}

export interface SupportTokenPayload {
  superAdminId: string;
  supportAgencyId: string;
  supportAgencyName?: string;
  isSupportMode: true;
}

/**
 * Standard cookie configuration for session cookies.
 */
export function getCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'lax' : 'lax',
    maxAge: maxAgeMs,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/**
 * Sign standard user JWT (7 days).
 */
export function signAuthToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'agencyhub',
    audience: 'agencyhub-app',
  });
}

/**
 * Verify standard user JWT.
 */
export function verifyAuthToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'agencyhub',
    audience: 'agencyhub-app',
  }) as TokenPayload;
}

/**
 * Sign short-lived support mode JWT (2 hours).
 */
export function signSupportToken(payload: Omit<SupportTokenPayload, 'isSupportMode'>): string {
  return jwt.sign({ ...payload, isSupportMode: true }, env.JWT_SECRET, {
    expiresIn: '2h',
    issuer: 'agencyhub-support',
    audience: 'agencyhub-app',
  });
}

/**
 * Verify support mode JWT.
 */
export function verifySupportToken(token: string): SupportTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'agencyhub-support',
    audience: 'agencyhub-app',
  }) as SupportTokenPayload;
}
