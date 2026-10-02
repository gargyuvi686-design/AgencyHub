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
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 backdrop-blur-md sticky top-0 z-50 transition-all shadow-md"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 font-medium">
          <span className="p-1 rounded bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </span>
          <span>
            Support mode — viewing <strong className="text-white font-semibold underline decoration-amber-400">{agencyName}</strong> — read-only
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded bg-slate-950/40 border border-amber-500/30 text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatCountdown(timeLeft)}</span>
          </div>

          <button
            onClick={handleExit}
            disabled={isExiting}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors shadow-sm disabled:opacity-50"
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
