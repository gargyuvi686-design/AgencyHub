'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Project = { id: string; name: string; status: string; progress: number; dueDate?: string | null; client: { companyName: string } };
type Overview = { totalProjects: number; activeProjects: number; visibleMeetings: number; pendingApprovals: number; feedbackAwaitingReply: number; projects: Project[] };

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

  const clientName = overview?.projects[0]?.client.companyName;

  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-bold tracking-tight text-white">Welcome back, {user?.name.split(' ')[0]}</h1><p className="mt-1 text-sm text-muted-foreground">{clientName}</p></header>
      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      {!loading && overview && overview.pendingApprovals + overview.feedbackAwaitingReply > 0 && <aside className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3" role="status"><p className="text-sm font-medium text-amber-900">{overview.pendingApprovals + overview.feedbackAwaitingReply} items need your attention</p><Link href="/portal#projects" className="text-sm font-semibold text-amber-900 underline underline-offset-4">Review now</Link></aside>}

      <section id="projects">
        <h2 className="mb-3 text-base font-bold text-white">Your projects</h2>
        {loading ? <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="surface-card h-36 animate-pulse" />)}</div> : !overview?.projects.length ? <p className="surface-card p-8 text-center text-sm text-muted-foreground">No projects are available yet.</p> : <div className="grid gap-4 md:grid-cols-2">{overview.projects.map((project) => <Link key={project.id} href={`/portal/projects/${project.id}`} className="surface-card block p-5 transition-colors hover:border-teal-300"><p className="text-base font-bold text-white">{project.name}</p><p className="mt-1 text-sm text-muted-foreground">{project.dueDate ? `Due ${new Date(project.dueDate).toLocaleDateString()}` : project.status.replace('_', ' ').toLowerCase()}</p><div className="progress-track mt-4"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${project.progress ?? 0}%` }} /></div><p className="mt-2 text-xs font-semibold text-muted-foreground">{project.progress ?? 0}% complete</p></Link>)}</div>}
      </section>
    </div>
  );
}
