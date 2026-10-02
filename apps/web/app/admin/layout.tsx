'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, getRoleHome } from '../../lib/auth-context';
import {
  Shield,
  LayoutDashboard,
  Building2,
  Activity,
  LogOut,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/agencies', label: 'Agencies', icon: Building2 },
  { href: '/admin/activity', label: 'Activity Feed', icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'SUPER_ADMIN') {
        router.push(getRoleHome(user.role));
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  const isLinkActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden border-b border-slate-800 bg-slate-900/80 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-white text-base">
          <span className="p-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Shield className="w-4 h-4" />
          </span>
          <span>AgencyHub Admin</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:block md:w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between shrink-0 fixed md:sticky top-0 md:top-0 h-auto md:h-screen z-30`}
      >
        <div>
          {/* Brand header */}
          <div className="h-16 px-6 hidden md:flex items-center gap-2.5 border-b border-slate-800/80">
            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Shield className="w-5 h-5" />
            </span>
            <div className="font-bold text-white tracking-tight text-base">AgencyHub Admin</div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Sign Out */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-purple-400 font-mono truncate">{user.email}</div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-slate-800/60 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
