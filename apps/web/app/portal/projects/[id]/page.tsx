'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

type Milestone = { id: string; title: string; status: string; dueDate?: string | null; requiresClientApproval: boolean; approvalStatus: string };
type Project = { id: string; name: string; description?: string | null; status: string; priority: string; progress: number; dueDate?: string | null; client: { companyName: string }; milestones: Milestone[] };
type Meeting = { id: string; title: string; meetingDate: string; notes?: string | null; creator: { name: string } };

export default function PortalProjectPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ data: Project }>(`/api/v1/portal/projects/${params.id}`),
      api.get<{ data: Meeting[] }>(`/api/v1/portal/projects/${params.id}/meetings`),
    ])
      .then(([projectResponse, meetingResponse]) => {
        setProject(projectResponse.data);
        setMeetings(meetingResponse.data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load this project.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="py-10 text-sm text-slate-400">Loading project…</p>;
  if (error || !project) return <div role="alert" className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || 'Project not found.'}</div>;

  return (
    <div className="space-y-8">
      <header className="border-b border-slate-800 pb-6">
        <p className="text-sm text-emerald-300"><Link href="/portal" className="hover:text-white">My projects</Link> / {project.client.companyName}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold text-white">{project.name}</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">{project.description || 'No description provided.'}</p></div><span className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">{project.status.replace('_', ' ').toLowerCase()}</span></div>
        <div className="mt-6 max-w-xl"><div className="flex justify-between text-xs text-slate-400"><span>Project progress</span><span>{project.progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${project.progress}%` }} /></div></div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Milestones</h2>
        {project.milestones.length === 0 ? <p className="border border-dashed border-slate-700 p-6 text-sm text-slate-400">No milestones have been shared.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{project.milestones.map((milestone) => <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium text-white">{milestone.title}</p>{milestone.requiresClientApproval && <p className="mt-1 text-xs text-amber-300">Approval: {milestone.approvalStatus.toLowerCase().replace('_', ' ')}</p>}</div><div className="text-right"><p className="text-xs text-slate-300">{milestone.status.replace('_', ' ').toLowerCase()}</p>{milestone.dueDate && <p className="mt-1 text-xs text-slate-500">Due {new Date(milestone.dueDate).toLocaleDateString()}</p>}</div></div>)}</div>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Shared meetings</h2>
        {meetings.length === 0 ? <p className="border border-dashed border-slate-700 p-6 text-sm text-slate-400">No meetings have been shared.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{meetings.map((meeting) => <article key={meeting.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium text-white">{meeting.title}</h3><time className="text-xs text-slate-400">{new Date(meeting.meetingDate).toLocaleString()}</time></div>{meeting.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{meeting.notes}</p>}<p className="mt-2 text-xs text-slate-500">Recorded by {meeting.creator.name}</p></article>)}</div>}
      </section>
    </div>
  );
}