'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type WorkTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
};

type MyWork = { openTasks: WorkTask[] };
const priorityStyles: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-amber-100 text-amber-900',
  LOW: 'bg-muted text-foreground',
  URGENT: 'bg-red-100 text-red-800',
};

export default function MyWorkPage() {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: MyWork }>('/api/v1/my-work')
      .then((response) => setTasks(response.data.openTasks))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load your work.'))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const sections = [
    { title: 'Overdue', items: tasks.filter((task) => task.dueDate && new Date(task.dueDate) < today) },
    { title: 'Due this week', items: tasks.filter((task) => task.dueDate && new Date(task.dueDate) >= today && new Date(task.dueDate) <= weekEnd) },
    { title: 'Other open', items: tasks.filter((task) => !task.dueDate || new Date(task.dueDate) > weekEnd) },
  ];

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold tracking-tight text-white">My Work</h1><p className="mt-1 text-sm text-muted-foreground">Open tasks assigned to you</p></header>
    {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <div className="surface-card h-40 animate-pulse" /> : sections.map(({ title, items }) => <section key={title}>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-bold text-white">{title}</h2><span className="text-xs text-muted-foreground">{items.length}</span></div>
      {items.length === 0 ? <p className="border-y border-border py-4 text-sm text-muted-foreground">Nothing here.</p> : <div className="divide-y divide-border border-y border-border">{items.map((task) => <Link key={task.id} href={`/app/projects/${task.projectId}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-muted/30">
        <div><p className="text-sm font-semibold text-white">{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{task.projectName}</span><span className={`status-pill ${priorityStyles[task.priority] ?? 'bg-muted text-foreground'}`}>{task.priority === 'URGENT' ? 'Urgent (legacy)' : task.priority[0] + task.priority.slice(1).toLowerCase()}</span>{task.assignee && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[9px] font-semibold text-cyan-900">{task.assignee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>{task.assignee.name}</span>}</div></div>
        <span className={`status-pill ${title === 'Overdue' ? 'bg-red-100 text-red-800' : task.dueDate ? 'bg-amber-100 text-amber-800' : 'bg-muted text-foreground'}`}>{task.dueDate ? `${title === 'Overdue' ? 'Overdue' : 'Due'} ${new Date(task.dueDate).toLocaleDateString()}` : task.status.replace('_', ' ').toLowerCase()}</span>
      </Link>)}</div>}
    </section>)}
  </div>;
}