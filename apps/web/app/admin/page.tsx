'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Building2,
  Users,
  Briefcase,
  FolderKanban,
  CheckCircle2,
  Ban,
  ArrowRight,
  Activity as ActivityIcon,
  Shield,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '../../components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

interface AdminStats {
  totalAgencies: number;
  activeAgencies: number;
  suspendedAgencies: number;
  totalUsers: number;
  totalClients: number;
  totalProjects: number;
}

interface ActivityItem {
  id: string;
  eventType: string;
  agencyId: string | null;
  actorType: string;
  createdAt: string;
  agency?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function AdminDashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery<{ data: AdminStats }>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/api/v1/admin/stats'),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{
    data: ActivityItem[];
  }>({
    queryKey: ['admin', 'activity', { limit: 5 }],
    queryFn: () => api.get('/api/v1/admin/activity?limit=5'),
  });

  const stats = statsData?.data;
  const recentActivities = activityData?.data || [];

  const donutData = stats
    ? [
        { name: 'Active', value: stats.activeAgencies, color: '#10b981' },
        { name: 'Suspended', value: stats.suspendedAgencies, color: '#ef4444' },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Platform Overview</h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time metrics, agency health breakdown, and platform activity.
        </p>
      </div>

      {/* 6 Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Agencies */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Agencies</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-white">{stats?.totalAgencies ?? 0}</div>
          )}
        </div>

        {/* Active Agencies */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-emerald-400">{stats?.activeAgencies ?? 0}</div>
          )}
        </div>

        {/* Suspended Agencies */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Suspended</span>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-red-400">{stats?.suspendedAgencies ?? 0}</div>
          )}
        </div>

        {/* Users */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Users</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-white">{stats?.totalUsers ?? 0}</div>
          )}
        </div>

        {/* Clients */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Clients</span>
            <Briefcase className="w-4 h-4 text-indigo-400" />
          </div>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-white">{stats?.totalClients ?? 0}</div>
          )}
        </div>

        {/* Projects */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Projects</span>
            <FolderKanban className="w-4 h-4 text-pink-400" />
          </div>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-2xl font-bold text-white">{stats?.totalProjects ?? 0}</div>
          )}
        </div>
      </div>

      {/* Middle Section: Donut Chart + Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Donut of Active vs Suspended */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Agency Status Distribution</h2>
            <p className="text-xs text-slate-400 mt-1">Ratio of active to suspended tenant accounts</p>
          </div>

          <div className="h-56 w-full flex items-center justify-center my-2">
            {statsLoading ? (
              <Skeleton className="h-44 w-44 rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">Active ({stats?.activeAgencies ?? 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-300">Suspended ({stats?.suspendedAgencies ?? 0})</span>
            </div>
          </div>
        </div>

        {/* 5 Latest Platform Activity Items */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Recent Activity</h2>
              <p className="text-xs text-slate-400 mt-1">Latest platform-wide audit log events</p>
            </div>
            <Link
              href="/admin/activity"
              className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No recent activity recorded yet.
              </div>
            ) : (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <ActivityIcon className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <span className="font-semibold text-white font-mono text-xs mr-2">
                        {act.eventType}
                      </span>
                      {act.agency && (
                        <span className="text-xs text-slate-300">
                          on <strong className="text-white">{act.agency.name}</strong>
                        </span>
                      )}
                      <div className="text-[11px] text-slate-500">
                        Actor: {act.actorType}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>
                      {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
