'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { User, Agency } from './auth-context';

export interface MeResponseData {
  user: User;
  agency?: Agency;
  support?: {
    isSupportMode: boolean;
    inSupportMode: boolean;
    supportAgencyId: string;
    supportAgencyName?: string;
    supportAgencySlug?: string;
    supportExpiresAt?: string;
  };
  isSupportMode: boolean;
  supportAgencyId?: string;
  supportAgencyName?: string;
  supportExpiresAt?: string;
}

export function useMe() {
  return useQuery<MeResponseData>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get<{ data: MeResponseData }>('/api/v1/auth/me');
      return res.data;
    },
    staleTime: 1000 * 15,
  });
}
