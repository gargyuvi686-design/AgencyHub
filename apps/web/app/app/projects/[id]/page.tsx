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
type AiActionItem = { title: string; assigneeHint: string | null; dueDate: string | null };
type AiSummary = { summary: string; decisions: string[]; actionItems: AiActionItem[] };
type Meeting = { id: string; title: string; meetingDate: string; notes?: string | null; visibleToClient: boolean; aiSummary?: AiSummary | null };
type FeedbackComment = { id: string; body: string; createdAt: string; author: { name: string; role: string } };
type FeedbackItem = { id: string; title: string; description: string; status: string; createdAt: string; submitter: { name: string }; comments: FeedbackComment[] };
type ProjectFile = { id: string; uploadedBy: string; originalName: string; mimeType: string; sizeBytes: number; visibleToClient: boolean; createdAt: string; uploader: { name: string } };
type Tab = 'Tasks' | 'Milestones' | 'Meetings' | 'Members' | 'Feedback' | 'Files';

const tabs: Tab[] = ['Tasks', 'Milestones', 'Meetings', 'Members', 'Feedback', 'Files'];
const feedbackStatuses = ['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'DECLINED'];
const feedbackStatusStyles: Record<string, string> = {
  OPEN: 'border-rose-500/40 text-rose-200',
  IN_REVIEW: 'border-amber-500/40 text-amber-200',
  IN_PROGRESS: 'border-cyan-500/40 text-cyan-200',
  RESOLVED: 'border-emerald-500/40 text-emerald-200',
  DECLINED: 'border-slate-600 text-slate-300',
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, support } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [aiSummaries, setAiSummaries] = useState<Record<string, AiSummary>>({});
  const [aiItems, setAiItems] = useState<Record<string, AiActionItem[]>>({});
  const [aiSelected, setAiSelected] = useState<Record<string, boolean[]>>({});
  const [aiPanelMeeting, setAiPanelMeeting] = useState<string | null>(null);
  const [aiBusyMeeting, setAiBusyMeeting] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      const [projectResponse, taskResponse, milestoneResponse, meetingResponse, feedbackResponse, filesResponse] = await Promise.all([
        api.get<{ data: Project }>(`/api/v1/projects/${projectId}`),
        api.get<{ data: Task[] }>(`/api/v1/projects/${projectId}/tasks?limit=100`),
        api.get<{ data: Milestone[] }>(`/api/v1/projects/${projectId}/milestones`),
        api.get<{ data: Meeting[] }>(`/api/v1/projects/${projectId}/meetings`),
        api.get<{ data: FeedbackItem[] }>(`/api/v1/projects/${projectId}/feedback`),
        api.get<{ data: ProjectFile[] }>(`/api/v1/projects/${projectId}/files`),
      ]);
      const feedbackWithComments = await Promise.all(feedbackResponse.data.map(async (item) => {
        const comments = await api.get<{ data: FeedbackComment[] }>(`/api/v1/feedback/${item.id}/comments`);
        return { ...item, comments: comments.data };
      }));
      setProject(projectResponse.data);
      setTasks(taskResponse.data);
      setMilestones(milestoneResponse.data);
      setMeetings(meetingResponse.data);
      setAiSummaries((current) => {
        const saved: Record<string, AiSummary> = {};
        for (const meeting of meetingResponse.data) {
          if (meeting.aiSummary) saved[meeting.id] = meeting.aiSummary;
        }
        return { ...saved, ...current };
      });
      setFeedback(feedbackWithComments);
      setFiles(filesResponse.data);
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

  async function generateMeetingSummary(meeting: Meeting) {
    setAiBusyMeeting(meeting.id);
    setAiPanelMeeting(meeting.id);
    setAiError('');
    setAiSuccess('');
    try {
      const response = await api.post<{ data: AiSummary }>(`/api/v1/meetings/${meeting.id}/ai-summary`);
      const summary = response.data;
      setAiSummaries((current) => ({ ...current, [meeting.id]: summary }));
      setAiItems((current) => ({ ...current, [meeting.id]: summary.actionItems.map((item) => ({ ...item })) }));
      setAiSelected((current) => ({ ...current, [meeting.id]: summary.actionItems.map(() => true) }));
      setMeetings((current) => current.map((item) => item.id === meeting.id ? { ...item, aiSummary: summary } : item));
      setAiPanelMeeting(meeting.id);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not create an AI summary. Please try again.');
    } finally {
      setAiBusyMeeting(null);
    }
  }

  async function createSummaryTasks(meetingId: string) {
    const items = (aiItems[meetingId] ?? []).filter((_item, index) => aiSelected[meetingId]?.[index]);
    if (!items.length) {
      setAiError('Select at least one action item to create a task.');
      return;
    }
    setAiBusyMeeting(meetingId);
    setAiError('');
    setAiSuccess('');
    try {
      const response = await api.post<{ data: Task[] }>(`/api/v1/meetings/${meetingId}/ai-summary/create-tasks`, { items });
      setAiSuccess(`${response.data.length} task${response.data.length === 1 ? '' : 's'} created.`);
      await load();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not create tasks. Please try again.');
    } finally {
      setAiBusyMeeting(null);
    }
  }

  function updateAiItem(meetingId: string, index: number, field: keyof AiActionItem, value: string) {
    setAiItems((current) => ({
      ...current,
      [meetingId]: (current[meetingId] ?? []).map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: value || null }
        : item),
    }));
  }

  async function updateFeedbackStatus(feedbackId: string, status: string) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/feedback/${feedbackId}`, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update feedback status.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedbackComment(event: FormEvent, feedbackId: string) {
    event.preventDefault();
    const body = commentDrafts[feedbackId]?.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/feedback/${feedbackId}/comments`, { body });
      setCommentDrafts((current) => ({ ...current, [feedbackId]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post reply.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadProjectFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    setBusy(true);
    setError('');
    try {
      await api.upload(`/api/v1/projects/${projectId}/files`, formData);
      setSelectedFile(null);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFileVisibility(file: ProjectFile) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/files/${file.id}`, { visibleToClient: !file.visibleToClient });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update file visibility.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProjectFile(fileId: string) {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/api/v1/files/${fileId}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete file.');
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
        {meetings.length === 0 ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No meetings recorded.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{meetings.map((meeting) => {
          const summary = aiSummaries[meeting.id];
          const items = aiItems[meeting.id] ?? summary?.actionItems ?? [];
          const selected = aiSelected[meeting.id] ?? items.map(() => true);
          return <article key={meeting.id} className="space-y-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-white">{meeting.title}</p><p className="mt-1 text-xs text-slate-400">{new Date(meeting.meetingDate).toLocaleString()}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={readOnly || aiBusyMeeting === meeting.id} onClick={() => summary ? setAiPanelMeeting(aiPanelMeeting === meeting.id ? null : meeting.id) : void generateMeetingSummary(meeting)} className="border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-50">{aiBusyMeeting === meeting.id ? 'Working…' : summary ? 'AI summary' : 'Generate AI summary'}</button><button type="button" disabled={readOnly || busy} onClick={() => void toggleMeeting(meeting)} aria-pressed={meeting.visibleToClient} className={`border px-3 py-1.5 text-xs disabled:opacity-50 ${meeting.visibleToClient ? 'border-emerald-500/40 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>{meeting.visibleToClient ? 'Shared with client' : 'Not shared'}</button></div></div>
            {aiError && aiPanelMeeting === meeting.id && !summary && <p role="alert" className="text-sm text-rose-200">{aiError}</p>}
            {aiPanelMeeting === meeting.id && summary && <div className="space-y-4 border border-slate-700 bg-slate-900/50 p-4">
              <div><h3 className="text-sm font-semibold text-white">Summary</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{summary.summary}</p></div>
              <div><h3 className="text-sm font-semibold text-white">Decisions</h3>{summary.decisions.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">{summary.decisions.map((decision, index) => <li key={`${meeting.id}-decision-${index}`}>{decision}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No decisions listed.</p>}</div>
              <div className="space-y-3"><h3 className="text-sm font-semibold text-white">Action items</h3>{items.map((item, index) => <div key={`${meeting.id}-action-${index}`} className="grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selected[index] ?? false} onChange={(event) => setAiSelected((current) => ({ ...current, [meeting.id]: items.map((_value, itemIndex) => itemIndex === index ? event.target.checked : (current[meeting.id]?.[itemIndex] ?? true)) }))} /><input aria-label="Action item title" value={item.title} onChange={(event) => updateAiItem(meeting.id, index, 'title', event.target.value)} className="h-9 border border-slate-700 bg-slate-950 px-2 text-sm text-white" /><input aria-label="Assignee name hint" placeholder="Assignee hint" value={item.assigneeHint ?? ''} onChange={(event) => updateAiItem(meeting.id, index, 'assigneeHint', event.target.value)} className="h-9 border border-slate-700 bg-slate-950 px-2 text-sm text-white placeholder:text-slate-500" /><input type="date" aria-label="Due date" value={item.dueDate ?? ''} onChange={(event) => updateAiItem(meeting.id, index, 'dueDate', event.target.value)} className="h-9 border border-slate-700 bg-slate-950 px-2 text-sm text-white" /></div>)}</div>
              {aiError && aiPanelMeeting === meeting.id && <p role="alert" className="text-sm text-rose-200">{aiError}</p>}{aiSuccess && <p role="status" className="text-sm text-emerald-200">{aiSuccess}</p>}
              <button type="button" disabled={readOnly || aiBusyMeeting === meeting.id || !items.length} onClick={() => void createSummaryTasks(meeting.id)} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{aiBusyMeeting === meeting.id ? 'Creating…' : 'Create selected tasks'}</button>
            </div>}
            {aiError && aiPanelMeeting !== meeting.id && aiBusyMeeting === null && <p role="alert" className="text-sm text-rose-200">{aiError}</p>}
          </article>;
        })}</div>}
      </section>}

      {tab === 'Members' && <section className="space-y-4">
        {!project.members.length && !isAdmin ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No members assigned.</p> : null}
        {isAdmin && !readOnly ? <form onSubmit={(event) => submit(event, () => api.put(`/api/v1/projects/${projectId}/members`, { userIds: selectedMembers }))} className="space-y-4">
          {team.map((member) => <label key={member.id} className="flex items-center gap-3 border-b border-slate-800 py-3 text-sm text-white"><input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={(event) => setSelectedMembers(event.target.checked ? [...selectedMembers, member.id] : selectedMembers.filter((id) => id !== member.id))} />{member.name}<span className="text-xs text-slate-500">{member.email} · {member.role.replace('AGENCY_', '').toLowerCase()}</span></label>)}
          <button disabled={busy} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">Save members</button>
        </form> : <div className="divide-y divide-slate-800 border-y border-slate-800">{project.members.map(({ user: member }) => <div key={member.id} className="py-3"><p className="text-sm text-white">{member.name}</p><p className="mt-1 text-xs text-slate-400">{member.email} · {member.role.replace('AGENCY_', '').toLowerCase()}</p></div>)}</div>}
      </section>}

      {tab === 'Feedback' && <section className="space-y-4">
        {feedback.length === 0 ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No client feedback on this project.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{feedback.map((item) => <article key={item.id} className="space-y-4 py-5">
          <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-white">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{item.submitter.name} · {new Date(item.createdAt).toLocaleDateString()}</p></div><label className="flex items-center gap-2"><span className={`border px-2 py-1 text-xs ${feedbackStatusStyles[item.status] ?? feedbackStatusStyles.OPEN}`}>{item.status.replace('_', ' ').toLowerCase()}</span><select aria-label={`Status for ${item.title}`} disabled={readOnly || busy} value={item.status} onChange={(event) => void updateFeedbackStatus(item.id, event.target.value)} className="h-8 border border-slate-700 bg-slate-900 px-2 text-xs text-white disabled:opacity-50">{feedbackStatuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label></header>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{item.description}</p>
          <div className="space-y-3 border-l border-slate-700 pl-4">{item.comments.length === 0 ? <p className="text-xs text-slate-500">No replies yet.</p> : item.comments.map((comment) => <div key={comment.id}><p className="text-xs text-cyan-200">{comment.author.name} · {new Date(comment.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{comment.body}</p></div>)}
            {!readOnly && <form onSubmit={(event) => submitFeedbackComment(event, item.id)} className="flex gap-2"><input required aria-label={`Reply to ${item.title}`} placeholder="Write a reply" value={commentDrafts[item.id] ?? ''} onChange={(event) => setCommentDrafts({ ...commentDrafts, [item.id]: event.target.value })} className="h-9 min-w-0 flex-1 border border-slate-700 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500" /><button disabled={busy} className="h-9 border border-cyan-500/40 px-3 text-xs text-cyan-200 disabled:opacity-50">Reply</button></form>}
          </div>
        </article>)}</div>}
      </section>}

      {tab === 'Files' && <section className="space-y-4">
        {!readOnly && <form onSubmit={uploadProjectFile} className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-5"><input required type="file" aria-label="Choose project file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="min-w-0 flex-1 text-sm text-slate-300 file:mr-3 file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:text-white" /><button disabled={busy || !selectedFile} className="h-10 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Uploading…' : 'Upload file'}</button></form>}
        {files.length === 0 ? <p className="border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">No files uploaded.</p> : <div className="divide-y divide-slate-800 border-y border-slate-800">{files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{file.originalName}</p><p className="mt-1 text-xs text-slate-400">{file.uploader.name} · {(file.sizeBytes / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><a href={`/api/v1/files/${file.id}/download`} className="border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400">Download</a><button type="button" disabled={readOnly || busy} aria-pressed={file.visibleToClient} onClick={() => void toggleFileVisibility(file)} className={`border px-3 py-1.5 text-xs disabled:opacity-50 ${file.visibleToClient ? 'border-emerald-500/40 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>{file.visibleToClient ? 'Shared' : 'Private'}</button>{(isAdmin || file.uploadedBy === user?.id) && !readOnly && <button type="button" disabled={busy} onClick={() => void deleteProjectFile(file.id)} className="border border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-50">Delete</button>}</div></div>)}</div>}
      </section>}
    </div>
  );
}