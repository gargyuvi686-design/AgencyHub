'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import Link from 'next/link';
import {
  Building2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  FolderKanban,
  Users,
  Briefcase,
} from 'lucide-react';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';

interface AgencyListItem {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: 'ACTIVE' | 'SUSPENDED';
  plan: string;
  createdAt: string;
  _count: {
    users: number;
    clients: number;
    projects: number;
  };
}

interface AgenciesResponse {
  data: AgencyListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export default function AgenciesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // URL state
  const qParam = searchParams.get('q') || '';
  const statusParam = searchParams.get('status') || 'ALL';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local search input state for smooth debouncing
  const [searchInput, setSearchInput] = useState(qParam);

  // Sync search input if URL changes externally
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  const updateQuery = React.useCallback(
    (updates: Record<string, string | null>) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || (key === 'status' && value === 'ALL')) {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      }

      startTransition(() => {
        router.push(`/admin/agencies?${current.toString()}`);
      });
    },
    [searchParams, router],
  );

  // Debounce search update to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== qParam) {
        updateQuery({ q: searchInput || null, page: '1' });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput, qParam, updateQuery]);

  // Build query string for API
  const apiQueryString = new URLSearchParams();
  if (qParam) apiQueryString.set('q', qParam);
  if (statusParam && statusParam !== 'ALL') apiQueryString.set('status', statusParam);
  apiQueryString.set('page', pageParam.toString());
  apiQueryString.set('limit', '10');

  const { data, isLoading, isError, error, refetch } = useQuery<AgenciesResponse>({
    queryKey: ['admin', 'agencies', qParam, statusParam, pageParam],
    queryFn: () => api.get(`/api/v1/admin/agencies?${apiQueryString.toString()}`),
  });

  const agencies = data?.data || [];
  const meta = data?.meta || { page: 1, limit: 10, total: 0 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-purple-400" />
            <span>Agencies Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, and inspect tenant workspaces across the platform.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by agency name, slug, or email..."
            className="pl-9 bg-slate-900 border-slate-800"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-48 shrink-0">
          <Select
            value={statusParam}
            onValueChange={(val) => updateQuery({ status: val, page: '1' })}
          >
            <SelectTrigger className="bg-slate-900 border-slate-800">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active Only</SelectItem>
              <SelectItem value="SUSPENDED">Suspended Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        {isError ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
            <div className="text-sm font-semibold text-white">Failed to load agencies</div>
            <div className="text-xs text-slate-400">{(error as any)?.message || 'An error occurred'}</div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-900/90">
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Clients</TableHead>
                <TableHead className="text-center">Projects</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : agencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500 text-sm">
                    No agencies found matching your search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                agencies.map((agency) => (
                  <TableRow key={agency.id} className="group hover:bg-slate-800/40">
                    <TableCell className="font-semibold text-white">
                      <Link
                        href={`/admin/agencies/${agency.id}`}
                        className="hover:text-purple-400 transition-colors"
                      >
                        {agency.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {agency.slug}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {agency.contactEmail}
                    </TableCell>
                    <TableCell>
                      {agency.status === 'ACTIVE' ? (
                        <Badge variant="success">ACTIVE</Badge>
                      ) : (
                        <Badge variant="danger">SUSPENDED</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono text-slate-300">
                      {agency._count.users}
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono text-slate-300">
                      {agency._count.clients}
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono text-slate-300">
                      {agency._count.projects}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(agency.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/agencies/${agency.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-200 transition-colors"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        {!isLoading && !isError && agencies.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{agencies.length}</span> of{' '}
              <span className="font-semibold text-white">{meta.total}</span> agencies
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
