'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, Copy, UserPlus } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';

type Member = { id: string; name: string; email: string; role: 'AGENCY_ADMIN' | 'AGENCY_MEMBER'; isActive: boolean; lastLoginAt: string | null };
type Invitation = { id: string; email: string; role: string; createdAt: string; expiresAt: string };

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'AGENCY_ADMIN' | 'AGENCY_MEMBER'>('AGENCY_MEMBER');
  const [acceptLink, setAcceptLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const response = await api.get<{ data: Member[]; pendingInvitations: Invitation[] }>('/api/v1/team');
    setMembers(response.data);
    setInvitations(response.pendingInvitations);
  }

  useEffect(() => {
    if (user?.role !== 'AGENCY_ADMIN') {
      setLoading(false);
      return;
    }
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load the team.')).finally(() => setLoading(false));
  }, [user?.role]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.post<{ data: { acceptLink: string } }>('/api/v1/team/invites', { email, role });
      setAcceptLink(`${window.location.origin}${response.data.acceptLink}`);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(member: Member, nextRole: Member['role']) {
    setError('');
    try {
      const response = await api.patch<{ data: Member }>(`/api/v1/team/${member.id}`, { role: nextRole });
      setMembers((current) => current.map((item) => item.id === member.id ? response.data : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the role.');
    }
  }

  async function deactivate() {
    if (!deactivateTarget) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(`/api/v1/team/${deactivateTarget.id}`);
      setMembers((current) => current.map((item) => item.id === deactivateTarget.id ? { ...item, isActive: false } : item));
      setDeactivateTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deactivate this member.');
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(acceptLink);
    setCopied(true);
  }

  if (user?.role !== 'AGENCY_ADMIN') return <p className="border-y border-border py-6 text-sm text-muted-foreground">Administrator access required.</p>;

  return <div className="space-y-8">
    <header><h1 className="text-2xl font-bold tracking-tight text-white">Team</h1><p className="mt-1 text-sm text-muted-foreground">Members and invitations</p></header>
    {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    <section>
      <h2 className="mb-3 text-base font-bold text-white">Invite a member</h2>
      <form onSubmit={invite} className="grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email address" placeholder="name@company.com" className="h-10 min-w-0 border border-input bg-card px-3 text-sm text-white placeholder:text-muted-foreground" />
        <select value={role} onChange={(event) => setRole(event.target.value as Member['role'])} aria-label="Invitation role" className="h-10 border border-input bg-card px-3 text-sm text-white"><option value="AGENCY_MEMBER">Member</option><option value="AGENCY_ADMIN">Admin</option></select>
        <Button disabled={busy}><UserPlus className="mr-2 h-4 w-4" />Create invite</Button>
      </form>
      {acceptLink && <div className="mt-3 flex flex-wrap gap-2"><input readOnly aria-label="Accept invite link" value={acceptLink} className="h-10 min-w-0 flex-1 border border-input bg-muted px-3 text-sm text-foreground" /><Button type="button" variant="outline" onClick={() => void copyInviteLink()}><span className="flex items-center gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}</span></Button></div>}
    </section>
    <section>
      <h2 className="mb-3 text-base font-bold text-white">Members</h2>
      {loading ? <div className="surface-card h-32 animate-pulse" /> : <div className="divide-y divide-border border-y border-border">{members.map((member) => <div key={member.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{member.name}{!member.isActive && <span className="ml-2 text-xs text-muted-foreground">Inactive</span>}</p><p className="mt-1 truncate text-xs text-muted-foreground">{member.email}</p></div><select value={member.role} disabled={!member.isActive || busy} onChange={(event) => void updateRole(member, event.target.value as Member['role'])} aria-label={`Role for ${member.name}`} className="h-9 border border-input bg-card px-2 text-sm text-white disabled:opacity-50"><option value="AGENCY_ADMIN">Admin</option><option value="AGENCY_MEMBER">Member</option></select><Button type="button" variant="outline" size="sm" disabled={!member.isActive || busy || member.id === user.id} onClick={() => setDeactivateTarget(member)}>Deactivate</Button></div>)}</div>}
    </section>
    <section>
      <h2 className="mb-3 text-base font-bold text-white">Pending invites</h2>
      {invitations.length === 0 ? <p className="border-y border-border py-4 text-sm text-muted-foreground">No pending invites.</p> : <div className="divide-y divide-border border-y border-border">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap justify-between gap-2 py-4"><div><p className="text-sm font-medium text-white">{invitation.email}</p><p className="mt-1 text-xs text-muted-foreground">{invitation.role.replace('AGENCY_', '').toLowerCase()}</p></div><p className="text-xs text-muted-foreground">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div>)}</div>}
    </section>
    <Dialog open={Boolean(deactivateTarget)} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Deactivate member?</DialogTitle><DialogDescription>{deactivateTarget?.name} will lose access to this workspace.</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)}>Cancel</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void deactivate()}>Deactivate</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}