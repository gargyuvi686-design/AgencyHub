'use client';

import React from 'react';
import { useAuth } from '../../lib/auth-context';
import {
  Building2,
  FolderKanban,
  CheckCircle2,
  Users,
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export default function AgencyDashboardPage() {
  const { user, agency, support } = useAuth();

  const isSupport = support?.inSupportMode;
  const agencyName = agency?.name || support?.supportAgencyName || 'Acme Digital Agency';

  return (
    <div className="space-y-8">
      {/* Workspace Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Workspace Active</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {agencyName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Logged in as <strong className="text-slate-200">{user?.name}</strong> ({user?.email}) ·{' '}
            <span className="font-mono text-xs text-indigo-400">
              {isSupport ? 'SUPER_ADMIN (Support Read-Only)' : user?.role}
            </span>
          </p>
        </div>
      </div>

      {/* Tenancy Verification Card */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Tenant Scoping Verified</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Every request in this workspace is authenticated via httpOnly session cookies.
              Tenant operational tables carry <code className="text-indigo-300 font-mono">agency_id</code>,
              automatically injected and enforced at the server repository layer.
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                Agency ID: {user?.agencyId || support?.supportAgencyId || 'acme-digital'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-emerald-400 border border-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Auth &amp; RBAC Active (Phase 1)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="p-2 w-fit rounded-lg bg-indigo-500/10 text-indigo-400 mb-3">
            <FolderKanban className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Projects &amp; Tasks</h3>
          <p className="text-xs text-slate-400 mt-1">
            Scoped to this agency. Milestone approval and client sharing controls.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="p-2 w-fit rounded-lg bg-blue-500/10 text-blue-400 mb-3">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Client Accounts</h3>
          <p className="text-xs text-slate-400 mt-1">
            Isolated customer portals with custom portal logins.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400 mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Team Invitations</h3>
          <p className="text-xs text-slate-400 mt-1">
            Role-gated invites for Admins and Collaborators.
          </p>
        </div>
      </div>
    </div>
  );
}
