'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { ApiException, api } from '../../lib/api';
import { getRoleHome, UserRole } from '../../lib/auth-context';

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function acceptInvite(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This invitation link is missing its token.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post<{ data: { user: { role: UserRole } } }>('/api/v1/auth/accept-invite', { token, name, password });
      router.replace(getRoleHome(response.data.user.role));
    } catch (err) {
      setError(err instanceof ApiException ? err.error.message : err instanceof Error ? err.message : 'Unable to accept this invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-300 to-amber-300" />
      <section className="w-full max-w-md border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-8">
        <div className="mb-7 flex h-11 w-11 items-center justify-center border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><KeyRound className="h-5 w-5" /></div>
        <p className="text-sm text-emerald-300">Account invitation</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Finish setting up</h1>
        <p className="mt-2 text-sm text-slate-400">Choose your name and password to activate access.</p>

        {error && <p role="alert" className="mt-5 flex gap-2 border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        {!token && <p className="mt-5 flex gap-2 border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Invitation token not found in this link.</p>}

        <form onSubmit={acceptInvite} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">Full name<input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" /></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" /></label>
          <label className="block text-sm text-slate-300">Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 h-11 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-400" /></label>
          <button disabled={busy || !token} className="flex h-11 w-full items-center justify-center gap-2 bg-emerald-300 px-4 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{busy ? 'Activating…' : 'Accept invitation'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-400"><Link href="/login" className="text-emerald-300 hover:text-white">Return to sign in</Link></p>
      </section>
    </main>
  );
}