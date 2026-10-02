'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { UserCheck, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, agency, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div data-theme="portal" className="portal-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5 font-bold text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white"><UserCheck className="h-4 w-4" /></span>
            <span className="truncate">{agency?.name || 'AgencyHub'}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium" aria-label="Client portal navigation">
            <Link href="/portal" aria-current={pathname === '/portal' ? 'page' : undefined} className={`rounded-lg px-3 py-2 ${pathname === '/portal' ? 'text-teal-700' : 'text-muted-foreground hover:bg-muted'}`}>Overview</Link>
            <Link href="/portal#projects" aria-current={pathname.startsWith('/portal/projects') ? 'page' : undefined} className={`rounded-lg px-3 py-2 ${pathname.startsWith('/portal/projects') ? 'text-teal-700' : 'text-muted-foreground hover:bg-muted'}`}>Projects</Link>
          </nav>
          <button onClick={() => logout()} title="Sign out" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
