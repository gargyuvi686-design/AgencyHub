'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Building2, LogOut, Loader2, LayoutDashboard, Briefcase, FolderKanban, ListTodo, Users, MessageSquareText, Activity } from 'lucide-react';
import Link from 'next/link';

export default function AgencyAppLayout({ children }: { children: React.ReactNode }) {
  const { user, agency, support, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else {
        const isAgencyUser =
          user.role === 'AGENCY_ADMIN' || user.role === 'AGENCY_MEMBER';
        const isSuperAdminInSupport =
          user.role === 'SUPER_ADMIN' && (support?.inSupportMode || (support as any)?.isSupportMode);

        if (user.role === 'SUPER_ADMIN' && !isSuperAdminInSupport) {
          router.push('/admin');
        } else if (!isAgencyUser && !isSuperAdminInSupport) {
          router.push('/login');
        }
      }
    }
  }, [user, support, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  const displayName = agency?.name || support?.supportAgencyName || 'Agency Workspace';

  const navItems = [
    { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/app/projects', label: 'Projects', icon: FolderKanban },
    { href: '/app/clients', label: 'Clients', icon: Briefcase },
    { href: '/app/my-work', label: 'My Work', icon: ListTodo },
    { href: '/app/feedback', label: 'Feedback', icon: MessageSquareText },
    { href: '/app/activity', label: 'Activity', icon: Activity },
    ...(user.role === 'AGENCY_ADMIN' ? [{ href: '/app/team', label: 'Team', icon: Users }] : []),
  ];
  const isActive = (href: string, exact = false) => exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="app-shell min-h-screen bg-background text-foreground lg:flex">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-3 lg:hidden">
        <Link href="/app" className="flex min-w-0 items-center gap-2.5 font-bold text-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><Building2 className="h-4 w-4" /></span>
          <span className="truncate">AgencyHub</span>
        </Link>
        <button onClick={() => logout()} title="Sign out" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
      </header>

      <aside className="hidden w-[230px] shrink-0 border-r border-border bg-white lg:flex lg:min-h-screen lg:flex-col">
        <Link href="/app" className="flex h-[68px] items-center gap-2.5 border-b border-border px-5 font-bold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><Building2 className="h-4 w-4" /></span>
          <span>AgencyHub</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3" aria-label="Workspace navigation">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link key={href} href={href} aria-current={isActive(href, exact) ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive(href, exact) ? 'bg-indigo-50 text-indigo-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="truncate text-xs font-semibold text-foreground">{user.name}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{displayName}</div>
          <button onClick={() => logout()} title="Sign out" className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <nav className="flex flex-wrap gap-1 border-b border-border bg-white px-3 py-2 lg:hidden" aria-label="Workspace navigation">
          {navItems.map(({ href, label, exact }) => (
            <Link key={href} href={href} aria-current={isActive(href, exact) ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${isActive(href, exact) ? 'bg-indigo-50 text-indigo-700' : 'text-muted-foreground hover:bg-muted'}`}>{label}</Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
