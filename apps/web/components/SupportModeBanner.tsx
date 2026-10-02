'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '../lib/use-me';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ArrowLeft, Loader2, Clock } from 'lucide-react';

export function SupportModeBanner() {
  const { data: meData, refetch } = useMe();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const isSupportMode = meData?.isSupportMode || meData?.support?.isSupportMode;
  const agencyName = meData?.supportAgencyName || meData?.support?.supportAgencyName || 'Agency';
  const supportAgencyId = meData?.supportAgencyId || meData?.support?.supportAgencyId;
  const supportExpiresAt = meData?.supportExpiresAt || meData?.support?.supportExpiresAt;

  useEffect(() => {
    if (!isSupportMode || !supportExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const targetTime = new Date(supportExpiresAt).getTime();

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        // Expired — refetch me and redirect to /admin
        refetch().then(() => {
          queryClient.invalidateQueries();
          router.push('/admin');
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isSupportMode, supportExpiresAt, refetch, queryClient, router]);

  if (!isSupportMode) {
    return null;
  }

  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleExit = async () => {
    setIsExiting(true);
    try {
      await api.post('/api/v1/admin/support-session/exit');
      await refetch();
      queryClient.invalidateQueries();
      if (supportAgencyId) {
        router.push(`/admin/agencies/${supportAgencyId}`);
      } else {
        router.push('/admin');
      }
    } catch (err) {
      console.error('Failed to exit support session', err);
      router.push('/admin');
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <div
      role="banner"
      className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-900 shadow-sm"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 font-medium">
          <span className="rounded bg-amber-100 p-1 text-amber-800">
            <ShieldAlert className="w-4 h-4" />
          </span>
          <span>
            Support mode — viewing <strong className="font-semibold text-foreground underline decoration-amber-500">{agencyName}</strong> — read-only
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 rounded border border-amber-200 bg-white px-2.5 py-1 font-mono text-xs text-amber-900">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatCountdown(timeLeft)}</span>
          </div>

          <button
            onClick={handleExit}
            disabled={isExiting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {isExiting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5" />
            )}
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
