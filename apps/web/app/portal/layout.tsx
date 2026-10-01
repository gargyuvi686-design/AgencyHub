'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { UserCheck, LogOut, Loader2, FolderKanban } from 'lucide-react';
import Link from 'next/link';

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'CLIENT') {
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'CLIENT') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Client Portal Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="flex items-center gap-2.5 font-bold text-lg text-white">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <UserCheck className="w-5 h-5" />
              </span>
              <span>Client Portal</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-400">
              <Link
                href="/portal"
                className="px-3 py-1.5 rounded-md hover:text-white hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
              >
                <FolderKanban className="w-4 h-4" />
                <span>My Projects</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[11px] text-emerald-400 font-mono">CLIENT_USER</div>
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

      {/* Main Client Portal View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
