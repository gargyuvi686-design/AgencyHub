'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiException } from '../../../../lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Users,
  FolderKanban,
  Briefcase,
  Calendar,
  Mail,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Ban,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Skeleton } from '../../../../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { useToast } from '../../../../lib/use-toast';
import { useAuth } from '../../../../lib/auth-context';

interface AgencyDetail {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: 'ACTIVE' | 'SUSPENDED';
  suspendedReason?: string | null;
  plan: string;
  createdAt: string;
  _count: {
    users: number;
    clients: number;
    projects: number;
  };
}

const suspendSchema = z.object({
  reason: z
    .string()
    .min(5, 'Suspension reason must be at least 5 characters long')
    .max(500, 'Reason cannot exceed 500 characters'),
});

type SuspendFormData = z.infer<typeof suspendSchema>;

export default function AgencyDetailPage() {
  const params = useParams<{ id: string }>();
  const agencyId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { refreshUser } = useAuth();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [isEnteringSupport, setIsEnteringSupport] = useState(false);

  const { data, isLoading, isError, error } = useQuery<{ data: AgencyDetail }>({
    queryKey: ['admin', 'agencies', agencyId],
    queryFn: () => api.get(`/api/v1/admin/agencies/${agencyId}`),
  });

  const agency = data?.data;

  // React Hook Form for Suspend Dialog
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
    reset: resetSuspendForm,
  } = useForm<SuspendFormData>({
    resolver: zodResolver(suspendSchema),
    defaultValues: { reason: '' },
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: (formData: SuspendFormData) =>
      api.patch(`/api/v1/admin/agencies/${agencyId}/status`, {
        status: 'SUSPENDED',
        reason: formData.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setSuspendOpen(false);
      resetSuspendForm();
      toast({
        title: 'Agency Suspended',
        description: `${agency?.name} has been suspended.`,
        variant: 'destructive',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiException ? err.error.message : 'Failed to suspend agency';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    },
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/admin/agencies/${agencyId}/status`, {
        status: 'ACTIVE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setActivateOpen(false);
      toast({
        title: 'Agency Activated',
        description: `${agency?.name} has been restored to active status.`,
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof ApiException ? err.error.message : 'Failed to activate agency';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    },
  });

  // Enter support mode
  const handleEnterSupportMode = async () => {
    setIsEnteringSupport(true);
    try {
      await api.post(`/api/v1/admin/agencies/${agencyId}/support-session`);
      await refreshUser();
      router.push('/app');
    } catch (err: unknown) {
      const msg =
        err instanceof ApiException
          ? err.error.message
          : 'Failed to initiate support session';
      toast({
        title: 'Support Mode Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsEnteringSupport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !agency) {
    return (
      <div className="p-12 text-center border border-border rounded-2xl bg-card/60 space-y-4">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />
        <h2 className="text-lg font-bold text-white">Agency Not Found</h2>
        <p className="text-sm text-muted-foreground">
          {(error as any)?.message || 'The requested agency does not exist or has been deleted.'}
        </p>
        <Link href="/admin/agencies">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agencies
          </Button>
        </Link>
      </div>
    );
  }

  const isSuspended = agency.status === 'SUSPENDED';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/agencies"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Agencies List</span>
        </Link>
      </div>

      {/* Main Agency Header Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-card/80 border border-border shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Building2 className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {agency.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-muted-foreground">slug: {agency.slug}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground font-mono">ID: {agency.id}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {agency.contactEmail}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Created {new Date(agency.createdAt).toLocaleDateString()}
              </span>
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[11px]">
                Plan: {agency.plan}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Status toggle button */}
            {isSuspended ? (
              <Button
                variant="outline"
                onClick={() => setActivateOpen(true)}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Activate Agency
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSuspendOpen(true)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Ban className="w-4 h-4 mr-2" />
                Suspend Agency
              </Button>
            )}

            {/* Support mode button */}
            <Button
              variant="amber"
              onClick={handleEnterSupportMode}
              disabled={isEnteringSupport}
              className="gap-2"
            >
              {isEnteringSupport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              <span>Enter support mode</span>
            </Button>
          </div>
        </div>

        {/* Suspended Notice Banner if Suspended */}
        {isSuspended && (
          <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3 text-red-200 text-sm">
            <Ban className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-red-300">Account is Currently Suspended</div>
              <div className="text-xs text-red-300/80 mt-1">
                Reason: <strong className="text-white">{agency.suspendedReason || 'No reason provided'}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resource Count Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Users */}
        <div className="p-6 rounded-xl bg-card/60 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{agency._count.users}</div>
          <p className="text-xs text-muted-foreground mt-1">Agency admins &amp; collaborators</p>
        </div>

        {/* Clients */}
        <div className="p-6 rounded-xl bg-card/60 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Clients</span>
            <Briefcase className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white">{agency._count.clients}</div>
          <p className="text-xs text-muted-foreground mt-1">External client accounts</p>
        </div>

        {/* Projects */}
        <div className="p-6 rounded-xl bg-card/60 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Projects</span>
            <FolderKanban className="w-5 h-5 text-pink-400" />
          </div>
          <div className="text-3xl font-bold text-white">{agency._count.projects}</div>
          <p className="text-xs text-muted-foreground mt-1">Active &amp; completed projects</p>
        </div>
      </div>

      {/* Suspend Agency Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              <span>Suspend {agency.name}</span>
            </DialogTitle>
            <DialogDescription>
              Suspending this agency will immediately block all agency users and client accounts
              from logging in or performing any API mutations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit((data) => suspendMutation.mutate(data))} className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-xs font-medium text-muted-foreground mb-1.5">
                Suspension Reason (Required, min 5 characters)
              </label>
              <Input
                id="reason"
                {...register('reason')}
                placeholder="e.g. Terms violation, non-payment, suspicious activity..."
                className="bg-background border-border text-sm"
              />
              {formErrors.reason && (
                <p className="text-xs text-red-400 mt-1.5">{formErrors.reason.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSuspendOpen(false)}
                disabled={suspendMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={suspendMutation.isPending}
              >
                {suspendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                <span>Confirm Suspension</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activate Agency Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Activate {agency.name}</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore active status for {agency.name}? All member and
              client logins will be unblocked immediately.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActivateOpen(false)}
              disabled={activateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {activateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              <span>Confirm Activation</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
