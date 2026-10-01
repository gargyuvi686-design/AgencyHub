'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiException } from './api';

export type UserRole = 'SUPER_ADMIN' | 'AGENCY_ADMIN' | 'AGENCY_MEMBER' | 'CLIENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  agencyId: string | null;
  clientId: string | null;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  plan: 'FREE' | 'PRO';
}

export interface SupportContextInfo {
  inSupportMode: boolean;
  supportAgencyId?: string;
  supportAgencyName?: string;
  supportAgencySlug?: string;
}

interface AuthContextType {
  user: User | null;
  agency: Agency | null;
  support: SupportContextInfo | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ role: UserRole; targetUrl: string }>;
  logout: () => Promise<void>;
  exitSupportMode: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getRoleHome(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin';
    case 'AGENCY_ADMIN':
    case 'AGENCY_MEMBER':
      return '/app';
    case 'CLIENT':
      return '/portal';
    default:
      return '/login';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [support, setSupport] = useState<SupportContextInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{
        data: {
          user: User;
          agency?: Agency;
          support?: SupportContextInfo;
        };
      }>('/api/v1/auth/me');

      setUser(res.data.user);
      setAgency(res.data.agency || null);
      setSupport(res.data.support || null);
    } catch {
      setUser(null);
      setAgency(null);
      setSupport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{
        data: {
          user: User;
          agency?: Agency;
        };
      }>('/api/v1/auth/login', { email, password });

      setUser(res.data.user);
      setAgency(res.data.agency || null);

      // Re-fetch me to ensure support mode and cookies are aligned
      const meRes = await api.get<{
        data: {
          user: User;
          agency?: Agency;
          support?: SupportContextInfo;
        };
      }>('/api/v1/auth/me').catch(() => null);

      if (meRes?.data) {
        setUser(meRes.data.user);
        setAgency(meRes.data.agency || null);
        setSupport(meRes.data.support || null);
      }

      const targetUrl = getRoleHome(res.data.user.role);
      router.push(targetUrl);
      return { role: res.data.user.role, targetUrl };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Ignore network failure on logout
    } finally {
      setUser(null);
      setAgency(null);
      setSupport(null);
      router.push('/login');
    }
  };

  const exitSupportMode = async () => {
    try {
      await api.post('/api/v1/admin/support-session/exit');
      await refreshUser();
      router.push('/admin');
    } catch (err) {
      console.error('Failed to exit support session', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        agency,
        support,
        isLoading,
        login,
        logout,
        exitSupportMode,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
