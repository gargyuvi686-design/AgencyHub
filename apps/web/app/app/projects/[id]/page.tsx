'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';

type Member = { id: string; name: string; email: string; role: string };
type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate?: string | null;
  client: { companyName: string };
  members: Array<{ id: string; userId: string; user: Member }>;
};
type Task = { id: string; title: string; status: string; priority: string; dueDate?: string | null };
type Milestone = { id: string; title: string; status: string; dueDate?: string | null; requiresClientApproval: boolean; approvalStatus: string };
type Meeting = { id: string; title: string; meetingDate: string; notes?: string | null; visibleToClient: boolean };
type Tab = 'Tasks' | 'Milestones' | 'Meetings' | 'Members';

const tabs: Tab[] = ['Tasks', 'Milestones', 'Meetings', 'Members'];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, support } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('Tasks');
  const [taskTitle, setTaskTitle] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [meetingForm, setMeetingForm] = useState({ title: '', meetingDate: '', visibleToClient: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const readOnly = Boolean(support?.inSupportMode || support?.isSupportMode);
  const isAdmin = user?.role === 'AGENCY_ADMIN';

  const load = useCallback(async () => {
    try {
      const [projectResponse, taskResponse, milestoneResponse, meetingResponse] = await Promise.all([
        api.get<{ data: Project }>(`/api/v1/projects/${projectId}`),
        api.get<{ data: Task[] }>(`/api/v1/projects/${projectId}/tasks?limit=100`),
        api.get<{ data: Milestone[] }>(`/api/v1/projects/${projectId}/milestones`),
        api.get<{ data: Meeting[] }>(`/api/v1/projects/${projectId}/meetings`),
      ]);
      setProject(projectResponse.data);
      setTasks(taskResponse.data);
      setMilestones(milestoneResponse.data);
      setMeetings(meetingResponse.data);
      setSelectedMembers(projectResponse.data.members.map((member) => member.userId));
      if (user?.role === 'AGENCY_ADMIN') {
        const teamResponse = await api.get<{ data: Member[] }>('/api/v1/team');
        setTeam(teamResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project.');
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.role]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent, action: () => Promise<unknown>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMeeting(meeting: Meeting) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/meetings/${meeting.id}`, { visibleToClient: !meeting.visibleToClient });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update meeting visibility.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="py-10 text-sm text-slate-400">Loading project…</p>;
  if (!project) return <div role="alert" className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || 'Project not found.'}</div>;

  return (
    <div className="space-y-7">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-sm text-cyan-300"><Link href="/app/projects" className="hover:text-white">Projects</Link> / {project.client.companyName}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold text-white">{project.name}</h1><p className="mt-2 text-sm text-slate-400">{project.description || 'No project description.'}</p></div>
          <div className="min-w-36"><div className="flex justify-between text-xs text-slate-400"><span>Progress</span><span>{project.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-cyan-400" style={{ width: `${project.progress}%` }} /></div></div>
        </div>
        {readOnly && <p className="mt-4 inline-block border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">Support mode · changes disabled</p>}
      </header>

      {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      <div role="tablist" aria-label="Project sections" className="flex overflow-x-auto border-b border-slate-800">
        {tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-3 text-sm ${tab === item ? 'border-cyan-300 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>{item}</button>)}
      </div>

      {tab === 'Tasks' && <section className="space-y-4">
        {!readOnly && <form onSubmit={(event) => submit(event, () => api.post(`/api/v1/projects/${projectId}/tasks`, { title: taskTitle }))} className="flex gap-2"><input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} aria-label="New task title" placeholder="Add a task" className="h-10 min-w-0 flex-1 border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500" /><button disabled={busy} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Add task</button></form>}
        {tasks.length === 0 ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No tasks in this project.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{tasks.map((task) => <div key={task.id} className="flex flex-wrap justify-between gap-2 py-3"><span className="text-sm text-white">{task.title}</span><span className="text-xs text-slate-400">{task.status.replace('_', ' ')} · {task.priority.toLowerCase()}</span></div>)}</div>}
      </section>}

      {tab === 'Milestones' && <section className="space-y-4">
        {!readOnly && <form onSubmit={(event) => submit(event, () => api.post(`/api/v1/projects/${projectId}/milestones`, { title: milestoneTitle }))} className="flex gap-2"><input required value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} aria-label="New milestone title" placeholder="Add a milestone" className="h-10 min-w-0 flex-1 border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500" /><button disabled={busy} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Add milestone</button></form>}
        {milestones.length === 0 ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No milestones yet.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{milestones.map((milestone) => <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm text-white">{milestone.title}</p>{milestone.requiresClientApproval && <p className="mt-1 text-xs text-amber-300">Client approval · {milestone.approvalStatus.toLowerCase().replace('_', ' ')}</p>}</div><span className="text-xs text-slate-400">{milestone.status.replace('_', ' ').toLowerCase()}</span></div>)}</div>}
      </section>}

      {tab === 'Meetings' && <section className="space-y-4">
        {!readOnly && <form onSubmit={(event) => submit(event, () => api.post(`/api/v1/projects/${projectId}/meetings`, { ...meetingForm, meetingDate: new Date(meetingForm.meetingDate).toISOString() }))} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"><input required value={meetingForm.title} onChange={(event) => setMeetingForm({ ...meetingForm, title: event.target.value })} aria-label="Meeting title" placeholder="Meeting title" className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-500" /><input required type="datetime-local" value={meetingForm.meetingDate} onChange={(event) => setMeetingForm({ ...meetingForm, meetingDate: event.target.value })} aria-label="Meeting date" className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm text-white" /><label className="flex items-center gap-2 px-2 text-xs text-slate-300"><input type="checkbox" checked={meetingForm.visibleToClient} onChange={(event) => setMeetingForm({ ...meetingForm, visibleToClient: event.target.checked })} />Share with client</label><button disabled={busy} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Record</button></form>}
        {meetings.length === 0 ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No meetings recorded.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{meetings.map((meeting) => <div key={meeting.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm text-white">{meeting.title}</p><p className="mt-1 text-xs text-slate-400">{new Date(meeting.meetingDate).toLocaleString()}</p></div><button type="button" disabled={readOnly || busy} onClick={() => void toggleMeeting(meeting)} aria-pressed={meeting.visibleToClient} className={`border px-3 py-1.5 text-xs disabled:opacity-50 ${meeting.visibleToClient ? 'border-emerald-500/40 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>{meeting.visibleToClient ? 'Shared with client' : 'Not shared'}</button></div>)}</div>}
      </section>}

      {tab === 'Members' && <section className="space-y-4">
        {!project.members.length && !isAdmin ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No members assigned.</p> : null}
        {isAdmin && !readOnly ? <form onSubmit={(event) => submit(event, () => api.put(`/api/v1/projects/${projectId}/members`, { userIds: selectedMembers }))} className="space-y-4">
          {team.map((member) => <label key={member.id} className="flex items-center gap-3 border-b border-slate-800 py-3 text-sm text-white"><input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={(event) => setSelectedMembers(event.target.checked ? [...selectedMembers, member.id] : selectedMembers.filter((id) => id !== member.id))} />{member.name}<span className="text-xs text-slate-500">{member.email} · {member.role.replace('AGENCY_', '').toLowerCase()}</span></label>)}
          <button disabled={busy} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Save members</button>
        </form> : <div className="divide-y divide-slate-800 border-y border-slate-800">{project.members.map(({ user: member }) => <div key={member.id} className="py-3"><p className="text-sm text-white">{member.name}</p><p className="mt-1 text-xs text-slate-400">{member.email} · {member.role.replace('AGENCY_', '').toLowerCase()}</p></div>)}</div>}
      </section>}
    </div>
  );
}