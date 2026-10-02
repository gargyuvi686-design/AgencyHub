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
      <header className="border-b border-slate-800 pb-5"><p className="text-sm text-cyan-300">Workspace / Projects</p><h1 className="mt-1 text-3xl font-semibold text-white">Project delivery</h1></header>
      {readOnly && <p className="border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Support mode is read-only.</p>}
      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      {canCreate && <form onSubmit={createProject} className="grid gap-3 border-b border-slate-800 pb-6 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
        <input required aria-label="Project name" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500" />
        <select required aria-label="Client" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm text-white"><option value="">Choose client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select>
        <select aria-label="Project status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm text-white"><option value="PLANNING">Planning</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option></select>
        <select aria-label="Project priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm text-white"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
        <button disabled={busy || clients.length === 0} className="inline-flex h-10 items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? 'Creating…' : 'Create'}</button>
      </form>}

      {loading ? <p className="py-8 text-sm text-slate-400">Loading projects…</p> : projects.length === 0 ? <p className="border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No projects yet. Add a client before creating a project.</p> : (
        <div className="divide-y divide-slate-800 border-y border-slate-800">
          {projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="grid gap-3 py-4 transition-colors hover:bg-slate-900/50 sm:grid-cols-[1fr_auto_8rem] sm:items-center sm:px-3"><div><p className="font-medium text-white">{project.name}</p><p className="mt-1 text-xs text-slate-400">{project.client?.companyName} · {project.status.replace('_', ' ').toLowerCase()}</p></div><div className="h-1.5 w-full overflow-hidden rounded bg-slate-800 sm:w-32"><div className="h-full bg-cyan-400" style={{ width: `${project.progress ?? 0}%` }} /></div><p className="text-right text-xs text-slate-400">{project.progress ?? 0}%</p></Link>)}
        </div>
      )}
    </div>
  );
}