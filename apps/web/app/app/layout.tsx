'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Building2, LogOut, Loader2, LayoutDashboard, Briefcase, Users, FolderKanban } from 'lucide-react';
import Link from 'next/link';

export default function AgencyAppLayout({ children }: { children: React.ReactNode }) {
  const { user, agency, support, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else {
        const isAgencyUser =
          user.role === 'AGENCY_ADMIN' || user.role === 'AGENCY_MEMBER';
        const isSuperAdminInSupport =
          user.role === 'SUPER_ADMIN' && support?.inSupportMode;

        if (!isAgencyUser && !isSuperAdminInSupport) {
          router.push('/login');
        }
      }
    }
  }, [user, support, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  const displayName = agency?.name || support?.supportAgencyName || 'Agency Workspace';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Workspace Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/app" className="flex items-center gap-2.5 font-bold text-lg text-white">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Building2 className="w-5 h-5" />
              </span>
              <span>{displayName}</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-400">
              <Link
                href="/app"
                className="px-3 py-1.5 rounded-md hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[11px] text-indigo-400 font-mono">
                {support?.inSupportMode ? 'SUPPORT MODE' : user.role}
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
