'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

export function SupportModeBanner() {
  const { support, exitSupportMode } = useAuth();
  const [isExiting, setIsExiting] = useState(false);

  if (!support?.inSupportMode) {
    return null;
  }

  const handleExit = async () => {
    setIsExiting(true);
    try {
      await exitSupportMode();
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 backdrop-blur-sm sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 font-medium">
          <span className="p-1 rounded bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </span>
          <span>
            <strong className="text-amber-300 font-semibold">SUPPORT MODE:</strong> Viewing{' '}
            <span className="underline decoration-amber-400 font-bold text-white">
              {support.supportAgencyName || 'Agency Workspace'}
            </span>{' '}
            as Super Admin. All mutations are strictly blocked (Read-Only).
          </span>
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
          <span>Exit Support Mode</span>
        </button>
      </div>
    </div>
  );
}
