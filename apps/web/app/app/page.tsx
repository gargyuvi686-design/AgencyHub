'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, CircleAlert, FolderKanban, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Dashboard = {
  projects: { total: number; byStatus: Record<string, number> };
  tasks: { total: number; overdue: number; dueSoon: number };
  clients: { total: number };
  teamMembers: { total: number };
};

type Project = { id: string; name: string; status: string; progress: number; client: { companyName: string } };

export default function AgencyDashboardPage() {
  const { agency, support } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Dashboard }>('/api/v1/dashboard'),
      api.get<{ data: Project[] }>('/api/v1/projects?limit=5'),
    ])
      .then(([summary, projectList]) => {
        setDashboard(summary.data);
        setProjects(projectList.data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load workspace.'))
      .finally(() => setLoading(false));
  }, []);

  const readOnly = Boolean(support?.inSupportMode || support?.isSupportMode);
  const cards = [
    { label: 'Projects', value: dashboard?.projects.total ?? 0, icon: FolderKanban, color: 'text-cyan-300' },
    { label: 'Clients', value: dashboard?.clients.total ?? 0, icon: BriefcaseBusiness, color: 'text-amber-300' },
    { label: 'Team members', value: dashboard?.teamMembers.total ?? 0, icon: Users, color: 'text-emerald-300' },
    { label: 'Open tasks', value: dashboard?.tasks.total ?? 0, icon: CircleAlert, color: 'text-rose-300' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <p className="text-sm text-cyan-300">Workspace / Overview</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">{agency?.name ?? 'Agency workspace'}</h1>
          <p className="mt-2 text-sm text-slate-400">A live view of your clients, projects, and delivery.</p>
        </div>
        {readOnly && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">Support mode · read only</span>}
      </div>

      {error && <p role="alert" className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div key={card.label} className="h-28 animate-pulse rounded border border-slate-800 bg-slate-900/60" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between text-sm text-slate-400"><span>{label}</span><Icon aria-hidden className={`h-4 w-4 ${color}`} /></div>
              <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Recent projects</h2>
          <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-white">All projects <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading projects…</p> : projects.length === 0 ? (
          <div className="border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No projects yet.</div>
        ) : (
          <div className="divide-y divide-slate-800 border-y border-slate-800">
            {projects.map((project) => (
              <Link key={project.id} href={`/app/projects/${project.id}`} className="grid gap-3 py-4 transition-colors hover:bg-slate-900/50 sm:grid-cols-[1fr_auto_8rem] sm:items-center sm:px-3">
                <div><p className="font-medium text-white">{project.name}</p><p className="mt-1 text-xs text-slate-400">{project.client?.companyName ?? 'Client'} · {project.status.replace('_', ' ').toLowerCase()}</p></div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800 sm:w-32"><div className="h-full bg-cyan-400" style={{ width: `${project.progress ?? 0}%` }} /></div>
                <p className="text-right text-xs text-slate-400">{project.progress ?? 0}% complete</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/app/clients" className="flex items-center justify-between border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-600"><span className="font-medium text-white">Client directory</span><ArrowUpRight className="h-4 w-4 text-cyan-300" /></Link>
        <Link href="/app/projects" className="flex items-center justify-between border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-600"><span className="font-medium text-white">Project delivery</span><ArrowUpRight className="h-4 w-4 text-cyan-300" /></Link>
      </div>
    </div>
  );
}
