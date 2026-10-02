'use client';

import React from 'react';
import { useAuth } from '../../lib/auth-context';
import {
  Building2,
  FolderKanban,
  Sparkles,
  ShieldAlert,
  Users,
  Briefcase,
  Layers,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export default function AgencyDashboardPage() {
  const { user, agency, support } = useAuth();

  const isSupport = support?.inSupportMode || (support as any)?.isSupportMode;
  const agencyName = agency?.name || support?.supportAgencyName || 'Acme Digital Agency';

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Agency Workspace</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-indigo-400" />
              <span>{agencyName}</span>
            </h1>

            <p className="text-sm text-slate-400">
              Authenticated as <strong className="text-white">{user?.name}</strong> ({user?.email}) ·{' '}
              <span className="font-mono text-xs text-indigo-300">
                {isSupport ? 'SUPER_ADMIN (Support Read-Only)' : user?.role}
              </span>
            </p>
          </div>

          <div>
            {isSupport ? (
              <Badge variant="warning" className="text-xs py-1 px-3">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                Support Mode Active
              </Badge>
            ) : (
              <Badge variant="success" className="text-xs py-1 px-3">
                Workspace Active
              </Badge>
            )}
          </div>
        </div>

        {/* Phase 4 Callout */}
        <div className="mt-8 p-6 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-indigo-500/20 text-indigo-400 mb-2">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Workspace arrives in Phase 4
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Full agency team invites, client management, project Kanban boards, and milestone tracking
            will be unlocked in Phase 4.
          </p>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
          <div className="p-2 w-fit rounded-lg bg-indigo-500/10 text-indigo-400 mb-3">
            <FolderKanban className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Projects &amp; Tasks</h3>
          <p className="text-xs text-slate-400 mt-1">
            Scoped to {agencyName}. Full isolation guaranteed at the repository layer.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
          <div className="p-2 w-fit rounded-lg bg-blue-500/10 text-blue-400 mb-3">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Client Portals</h3>
          <p className="text-xs text-slate-400 mt-1">
            Dedicated customer access with project milestone review.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
          <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400 mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-white text-sm">Team Invitations</h3>
          <p className="text-xs text-slate-400 mt-1">
            Collaborators and admins with scoped permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
