'use client';

import React from 'react';
import { useAuth } from '../../lib/auth-context';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';

export default function ClientPortalOverviewPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Client Access Portal</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Welcome, {user?.name}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review your deliverables, approve milestone sign-offs, and track active project progress.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Assigned Projects</div>
          <div className="text-2xl font-bold text-white mt-1">1</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Active development
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Milestone Approvals</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">1</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Ready for review
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Tenancy Isolation</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">Isolated</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Only your client data visible
          </div>
        </div>
      </div>
    </div>
  );
}
