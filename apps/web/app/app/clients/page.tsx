'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

type Client = { id: string; companyName: string; contactName: string; email: string; activeProjectsCount?: number };

export default function ClientsPage() {
  const { user, support } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ companyName: '', contactName: '', email: '', phone: '' });
  const readOnly = Boolean(support?.inSupportMode || support?.isSupportMode);
  const canCreate = user?.role === 'AGENCY_ADMIN' && !readOnly;

  const load = useCallback(() => api.get<{ data: Client[] }>(`/api/v1/clients?limit=100&q=${encodeURIComponent(query)}`)
    .then((response) => setClients(response.data))
    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load clients.'))
    .finally(() => setLoading(false)), [query]);

  useEffect(() => { void load(); }, [load]);

  async function createClient(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/v1/clients', form);
      setForm({ companyName: '', contactName: '', email: '', phone: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create client.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Workspace / Clients</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Client directory</h1></div>
        <label className="flex h-10 min-w-56 items-center gap-2 rounded-lg border border-input bg-white px-3 text-muted-foreground"><Search className="h-4 w-4" /><input aria-label="Search clients" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" placeholder="Search clients" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </header>

      {readOnly && <p className="border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Support mode is read-only.</p>}
      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      {canCreate && <form onSubmit={createClient} className="surface-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <input required aria-label="Company name" placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" />
        <input required aria-label="Contact name" placeholder="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" />
        <input required type="email" aria-label="Contact email" placeholder="Contact email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" />
        <input aria-label="Phone" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" />
        <button disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? 'Creating…' : 'Add client'}</button>
      </form>}

      {loading ? <p className="py-8 text-sm text-muted-foreground">Loading clients…</p> : clients.length === 0 ? <p className="surface-card p-8 text-center text-sm text-muted-foreground">No clients found.</p> : (
        <div className="surface-card divide-y divide-border px-5">
          {clients.map((client) => <div key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-white">{client.companyName}</p><p className="mt-1 text-xs text-muted-foreground">{client.contactName} · {client.email}</p></div><p className="text-xs text-muted-foreground">{client.activeProjectsCount ?? 0} active projects</p></div>)}
        </div>
      )}
    </div>
  );
}