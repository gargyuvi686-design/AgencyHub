'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

type Client = { id: string; companyName: string };
type Project = { id: string; name: string; status: string; priority: string; progress: number; client: { companyName: string }; dueDate?: string | null };

export default function ProjectsPage() {
  const { user, support } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', clientId: '', status: 'PLANNING', priority: 'MEDIUM' });
  const readOnly = Boolean(support?.inSupportMode || support?.isSupportMode);
  const canCreate = user?.role === 'AGENCY_ADMIN' && !readOnly;

  const load = useCallback(async () => {
    try {
      const [projectResponse, clientResponse] = await Promise.all([
        api.get<{ data: Project[] }>('/api/v1/projects?limit=100'),
        api.get<{ data: Client[] }>('/api/v1/clients?limit=100'),
      ]);
      setProjects(projectResponse.data);
      setClients(clientResponse.data);
      if (clientResponse.data[0]) setForm((current) => ({ ...current, clientId: current.clientId || clientResponse.data[0].id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/v1/projects', form);
      setForm((current) => ({ ...current, name: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <header><p className="text-sm text-muted-foreground">Workspace / Projects</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Project delivery</h1></header>
      {readOnly && <p className="border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Support mode is read-only.</p>}
      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      {canCreate && <form onSubmit={createProject} className="surface-card grid gap-3 p-4 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <input required aria-label="Project name" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground" />
        <select required aria-label="Client" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground"><option value="">Choose client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select>
        <select aria-label="Project status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground"><option value="PLANNING">Planning</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option></select>
        <select aria-label="Project priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 rounded-lg border border-input bg-white px-3 text-sm text-foreground"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
        <button disabled={busy || clients.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? 'Creating…' : 'Create'}</button>
      </form>}

      {loading ? <p className="py-8 text-sm text-muted-foreground">Loading projects…</p> : projects.length === 0 ? <p className="surface-card p-8 text-center text-sm text-muted-foreground">No projects yet. Add a client before creating a project.</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="surface-card block p-5 transition-colors hover:border-indigo-300"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{project.name}</p><p className="mt-1 text-xs text-muted-foreground">{project.client?.companyName} · {project.status.replace('_', ' ').toLowerCase()}</p></div><span className="status-pill bg-green-100 text-green-800">{project.status.replace('_', ' ').toLowerCase()}</span></div><div className="progress-track mt-4 bg-indigo-50"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${project.progress ?? 0}%` }} /></div><p className="mt-2 text-right text-xs text-muted-foreground">{project.progress ?? 0}% complete</p></Link>)}
        </div>
      )}
    </div>
  );
}