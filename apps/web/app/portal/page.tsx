'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, FolderKanban } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Project = { id: string; name: string; status: string; progress: number; dueDate?: string | null; client: { companyName: string } };
type Overview = { totalProjects: number; activeProjects: number; visibleMeetings: number; projects: Project[] };

export default function ClientPortalOverviewPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: Overview }>('/api/v1/portal/overview')
      .then((response) => setOverview(response.data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load your projects.'))
      .finally(() => setLoading(false));
  }, []);

  const summary = [
    { label: 'Projects', value: overview?.totalProjects ?? 0, icon: FolderKanban },
    { label: 'In progress', value: overview?.activeProjects ?? 0, icon: ArrowUpRight },
    { label: 'Shared meetings', value: overview?.visibleMeetings ?? 0, icon: CalendarDays },
  ];

  return (
    <div className="space-y-8">
      <header className="border-b border-slate-800 pb-6"><p className="text-sm text-emerald-300">Client portal / Projects</p><h1 className="mt-1 text-3xl font-semibold text-white">Welcome, {user?.name}</h1><p className="mt-2 text-sm text-slate-400">Your current project status and shared updates.</p></header>
      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      {loading ? <div className="grid gap-3 sm:grid-cols-3">{summary.map((item) => <div key={item.label} className="h-24 animate-pulse border border-slate-800 bg-slate-900/60" />)}</div> : <div className="grid gap-3 sm:grid-cols-3">{summary.map(({ label, value, icon: Icon }) => <div key={label} className="border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center justify-between text-sm text-slate-400"><span>{label}</span><Icon aria-hidden className="h-4 w-4 text-emerald-300" /></div><p className="mt-3 text-3xl font-semibold text-white">{value}</p></div>)}</div>}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Your projects</h2>
        {loading ? <p className="text-sm text-slate-500">Loading projects…</p> : !overview?.projects.length ? <p className="border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No projects are available yet.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{overview.projects.map((project) => <Link key={project.id} href={`/portal/projects/${project.id}`} className="grid gap-3 py-4 hover:bg-slate-900/50 sm:grid-cols-[1fr_auto_8rem] sm:items-center sm:px-3"><div><p className="font-medium text-white">{project.name}</p><p className="mt-1 text-xs text-slate-400">{project.status.replace('_', ' ').toLowerCase()}{project.dueDate ? ` · Due ${new Date(project.dueDate).toLocaleDateString()}` : ''}</p></div><div className="h-1.5 w-full overflow-hidden rounded bg-slate-800 sm:w-32"><div className="h-full bg-emerald-400" style={{ width: `${project.progress ?? 0}%` }} /></div><p className="text-right text-xs text-slate-400">{project.progress ?? 0}%</p></Link>)}</div>}
      </section>
    </div>
  );
}
