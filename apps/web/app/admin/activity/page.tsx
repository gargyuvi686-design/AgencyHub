'use client';

import React, { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Shield,
  User,
  Building2,
  AlertCircle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { Badge } from '../../../components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface ActivityLogItem {
  id: string;
  agencyId: string | null;
  actorType: 'SUPER_ADMIN' | 'AGENCY_USER' | 'CLIENT' | 'SYSTEM';
  actorId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  visibleToClient: boolean;
  metadata?: any;
  createdAt: string;
  agency?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface ActivityResponse {
  data: ActivityLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

const EVENT_TYPES = [
  { value: 'ALL', label: 'All Event Types' },
  { value: 'support.entered', label: 'support.entered' },
  { value: 'support.exited', label: 'support.exited' },
  { value: 'agency.suspended', label: 'agency.suspended' },
  { value: 'agency.activated', label: 'agency.activated' },
  { value: 'auth.login', label: 'auth.login' },
  { value: 'auth.logout', label: 'auth.logout' },
];

export default function AdminActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const eventTypeParam = searchParams.get('eventType') || 'ALL';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const updateQuery = (updates: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || (key === 'eventType' && value === 'ALL')) {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    }

    startTransition(() => {
      router.push(`/admin/activity?${current.toString()}`);
    });
  };

  const apiQuery = new URLSearchParams();
  if (eventTypeParam && eventTypeParam !== 'ALL') {
    apiQuery.set('eventType', eventTypeParam);
  }
  apiQuery.set('page', pageParam.toString());
  apiQuery.set('limit', '15');

  const { data, isLoading, isError, error, refetch } = useQuery<ActivityResponse>({
    queryKey: ['admin', 'activity', eventTypeParam, pageParam],
    queryFn: () => api.get(`/api/v1/admin/activity?${apiQuery.toString()}`),
  });

  const activities = data?.data || [];
  const meta = data?.meta || { page: 1, limit: 15, total: 0 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ActivityIcon className="w-6 h-6 text-purple-400" />
            <span>Platform Activity Feed</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            System-wide audit trail of security, support, and administrative events.
          </p>
        </div>

        {/* Event Type Filter */}
        <div className="w-full sm:w-60">
          <Select
            value={eventTypeParam}
            onValueChange={(val) => updateQuery({ eventType: val, page: '1' })}
          >
            <SelectTrigger className="bg-slate-900 border-slate-800">
              <SelectValue placeholder="Event Type: All" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((et) => (
                <SelectItem key={et.value} value={et.value}>
                  {et.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        {isError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
            <div className="text-sm font-semibold text-white">Failed to load activity log</div>
            <div className="text-xs text-slate-400">
              {(error as any)?.message || 'An error occurred'}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No activity records match the selected criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {activities.map((item) => {
              const isSupportEvent = item.eventType.startsWith('support.');
              const isAgencyEvent = item.eventType.startsWith('agency.');

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <span
                      className={`p-2 rounded-lg shrink-0 border ${
                        isSupportEvent
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : isAgencyEvent
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.actorType === 'SUPER_ADMIN' ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {item.eventType}
                        </span>

                        {item.agency && (
                          <Link
                            href={`/admin/agencies/${item.agency.id}`}
                            className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
                          >
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{item.agency.name}</span>
                          </Link>
                        )}

                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          {item.actorType}
                        </Badge>
                      </div>

                      {item.metadata?.superAdminEmail && (
                        <div className="text-xs text-slate-400 mt-1">
                          Super Admin: <span className="text-slate-300">{item.metadata.superAdminEmail}</span>
                        </div>
                      )}
                      {item.metadata?.reason && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Reason: <span className="text-slate-300 italic">{item.metadata.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 sm:text-right shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && !isError && activities.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{activities.length}</span> of{' '}
              <span className="font-semibold text-white">{meta.total}</span> events
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam <= 1}
                onClick={() => updateQuery({ page: (pageParam - 1).toString() })}
                className="h-8 px-2 border-slate-800 text-slate-300"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <span className="px-2 font-mono">
                Page {pageParam} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={pageParam >= totalPages}
                onClick={() => updateQuery({ page: (pageParam + 1).toString() })}
                className="h-8 px-2 border-slate-800 text-slate-300"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
