'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, CircleAlert, FolderKanban, MessageSquareText } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Dashboard = {
  projects: { total: number; byStatus: Record<string, number> };
  tasks: { total: number; byStatus: Record<string, number>; overdue: number; dueSoon: number };
  clients: { total: number };
  teamMembers: { total: number };
  feedback: { pending: number };
};

type Project = { id: string; name: string; status: string; progress: number; dueDate?: string | null; client: { companyName: string } };

export default function AgencyDashboardPage() {
  const { agency } = useAuth();
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

  const cards = [
    { label: 'Total clients', value: dashboard?.clients.total ?? 0, icon: BriefcaseBusiness },
    { label: 'Active projects', value: dashboard?.projects.byStatus.ACTIVE ?? 0, icon: FolderKanban },
    { label: 'Due soon', value: dashboard?.tasks.dueSoon ?? 0, icon: CircleAlert },
    { label: 'Completed', value: dashboard?.projects.byStatus.COMPLETED ?? 0, icon: CheckCircle2 },
    { label: 'Pending feedback', value: dashboard?.feedback.pending ?? 0, icon: MessageSquareText },
  ];
  const taskStatusRows = [
    { key: 'TODO', label: 'To do', className: 'task-bar-fill--todo' },
    { key: 'IN_PROGRESS', label: 'In progress', className: 'task-bar-fill--progress' },
    { key: 'REVIEW', label: 'Review', className: 'task-bar-fill--review' },
    { key: 'DONE', label: 'Done', className: 'task-bar-fill--done' },
  ];
  const largestTaskStatusCount = Math.max(1, ...taskStatusRows.map(({ key }) => dashboard?.tasks.byStatus[key] ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{agency?.name ?? 'Agency workspace'}</p>
        </div>
        <Link href="/app/projects" className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">New project</Link>
      </div>

      {error && <p role="alert" className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map((card) => <div key={card.label} className="surface-card h-24 animate-pulse" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="surface-card p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon aria-hidden className="h-4 w-4 text-indigo-600" /></div>
              <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="surface-card p-5">
        <h2 className="text-base font-bold text-white">Tasks by status</h2>
        {loading ? <div className="mt-4 space-y-3">{taskStatusRows.map(({ key }) => <div key={key} className="h-4 animate-pulse rounded bg-border" />)}</div> : (
          <div className="mt-4 space-y-3">
            {taskStatusRows.map(({ key, label, className }) => {
              const count = dashboard?.tasks.byStatus[key] ?? 0;
              return <div key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <div className="task-bar-track" role="progressbar" aria-label={`${label} tasks`} aria-valuemin={0} aria-valuemax={largestTaskStatusCount} aria-valuenow={count}>
                  <div className={`task-bar-fill ${className}`} style={{ width: `${(count / largestTaskStatusCount) * 100}%` }} />
                </div>
                <span className="text-right text-xs font-semibold text-foreground">{count}</span>
              </div>;
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
      {projects.some((project) => project.dueDate) && <section className="surface-card p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">Upcoming deadlines</h2>
          <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">Projects <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        {projects.filter((project) => project.dueDate).length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No upcoming deadlines.</div>
        ) : (
          <div className="divide-y divide-border">
            {projects.filter((project) => project.dueDate).slice(0, 4).map((project) => (
              <Link key={project.id} href={`/app/projects/${project.id}`} className="flex items-center justify-between gap-3 py-3">
                <div><p className="text-sm font-semibold text-white">{project.name}</p><p className="text-xs text-muted-foreground">{project.client?.companyName ?? 'Client'} · Project</p></div>
                <span className="status-pill shrink-0 bg-amber-100 text-amber-800">Due {new Date(project.dueDate!).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
      </section>}
      <section className="surface-card p-5">
        <div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-base font-bold text-white">Recent projects</h2><Link href="/app/projects" className="text-sm font-medium text-indigo-600">All projects</Link></div>
        {loading ? <p className="py-5 text-sm text-muted-foreground">Loading projects…</p> : projects.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects yet.</p>
        ) : <div className="divide-y divide-border">{projects.slice(0, 4).map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="block py-3"><p className="text-sm font-semibold text-white">{project.name}</p><p className="mt-1 text-xs text-muted-foreground">{project.client?.companyName ?? 'Client'} · {project.status.replace('_', ' ').toLowerCase()}</p></Link>)}</div>}
      </section>
      </div>
    </div>
  );
}
