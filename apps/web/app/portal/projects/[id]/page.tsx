'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

type Milestone = { id: string; title: string; status: string; dueDate?: string | null; requiresClientApproval: boolean; approvalStatus: string };
type Project = { id: string; name: string; description?: string | null; status: string; priority: string; progress: number; dueDate?: string | null; client: { companyName: string }; milestones: Milestone[] };
type Meeting = { id: string; title: string; meetingDate: string; notes?: string | null; creator: { name: string } };
type FeedbackComment = { id: string; body: string; createdAt: string; author: { name: string; role: string } };
type FeedbackItem = { id: string; title: string; description: string; status: string; createdAt: string; submitter: { name: string }; comments: FeedbackComment[] };
type ProjectFile = { id: string; originalName: string; sizeBytes: number; mimeType: string; createdAt: string; uploader: { name: string } };

const feedbackStatusStyles: Record<string, string> = {
  OPEN: 'border-rose-500/40 text-rose-200',
  IN_REVIEW: 'border-amber-500/40 text-amber-200',
  IN_PROGRESS: 'border-cyan-500/40 text-cyan-200',
  RESOLVED: 'border-emerald-500/40 text-emerald-200',
  DECLINED: 'border-border text-muted-foreground',
};

export default function PortalProjectPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackForm, setFeedbackForm] = useState({ title: '', description: '' });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [projectResponse, meetingResponse, feedbackResponse, filesResponse] = await Promise.all([
      api.get<{ data: Project }>(`/api/v1/portal/projects/${params.id}`),
      api.get<{ data: Meeting[] }>(`/api/v1/portal/projects/${params.id}/meetings`),
        api.get<{ data: FeedbackItem[] }>(`/api/v1/portal/projects/${params.id}/feedback`),
        api.get<{ data: ProjectFile[] }>(`/api/v1/portal/projects/${params.id}/files`),
      ]);
      const feedbackWithComments = await Promise.all(feedbackResponse.data.map(async (item) => {
        const comments = await api.get<{ data: FeedbackComment[] }>(`/api/v1/portal/feedback/${item.id}/comments`);
        return { ...item, comments: comments.data };
      }));
      setProject(projectResponse.data);
      setMeetings(meetingResponse.data);
      setFeedback(feedbackWithComments);
      setFiles(filesResponse.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this project.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/portal/projects/${params.id}/feedback`, feedbackForm);
      setFeedbackForm({ title: '', description: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(event: FormEvent, feedbackId: string) {
    event.preventDefault();
    const body = commentDrafts[feedbackId]?.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/portal/feedback/${feedbackId}/comments`, { body });
      setCommentDrafts((current) => ({ ...current, [feedbackId]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="py-10 text-sm text-muted-foreground">Loading project…</p>;
  if (error || !project) return <div role="alert" className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error || 'Project not found.'}</div>;

  return (
    <div className="portal-project space-y-8">
      <header className="border-b border-border pb-6">
        <p className="text-sm text-emerald-300"><Link href="/portal" className="hover:text-white">My projects</Link> / {project.client.companyName}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold text-white">{project.name}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.description || 'No description provided.'}</p></div><span className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">{project.status.replace('_', ' ').toLowerCase()}</span></div>
        <div className="mt-6 max-w-xl"><div className="flex justify-between text-xs text-muted-foreground"><span>Project progress</span><span>{project.progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-emerald-400" style={{ width: `${project.progress}%` }} /></div></div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Milestones</h2>
        {project.milestones.length === 0 ? <p className="border border-dashed border-input p-6 text-sm text-muted-foreground">No milestones have been shared.</p> : <div className="divide-y divide-border border-y border-border">{project.milestones.map((milestone) => <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium text-white">{milestone.title}</p>{milestone.requiresClientApproval && <p className="mt-1 text-xs text-amber-300">Approval: {milestone.approvalStatus.toLowerCase().replace('_', ' ')}</p>}</div><div className="text-right"><p className="text-xs text-muted-foreground">{milestone.status.replace('_', ' ').toLowerCase()}</p>{milestone.dueDate && <p className="mt-1 text-xs text-muted-foreground">Due {new Date(milestone.dueDate).toLocaleDateString()}</p>}</div></div>)}</div>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Shared meetings</h2>
        {meetings.length === 0 ? <p className="border border-dashed border-input p-6 text-sm text-muted-foreground">No meetings have been shared.</p> : <div className="divide-y divide-border border-y border-border">{meetings.map((meeting) => <article key={meeting.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium text-white">{meeting.title}</h3><time className="text-xs text-muted-foreground">{new Date(meeting.meetingDate).toLocaleString()}</time></div>{meeting.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{meeting.notes}</p>}<p className="mt-2 text-xs text-muted-foreground">Recorded by {meeting.creator.name}</p></article>)}</div>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Shared files</h2>
        {files.length === 0 ? <p className="border border-dashed border-input p-6 text-sm text-muted-foreground">No files have been shared.</p> : <div className="divide-y divide-border border-y border-border">{files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{file.originalName}</p><p className="mt-1 text-xs text-muted-foreground">{file.uploader.name} · {(file.sizeBytes / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString()}</p></div><a href={`/api/v1/portal/files/${file.id}/download`} className="border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10">Download</a></div>)}</div>}
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div><p className="text-sm text-emerald-300">Project conversation</p><h2 className="mt-1 text-lg font-semibold text-white">Feedback</h2></div>
        {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        <form onSubmit={submitFeedback} className="space-y-3 border-b border-border pb-5">
          <input required maxLength={255} aria-label="Feedback title" placeholder="Short title" value={feedbackForm.title} onChange={(event) => setFeedbackForm({ ...feedbackForm, title: event.target.value })} className="h-10 w-full border border-input bg-card px-3 text-sm text-white placeholder:text-muted-foreground" />
          <textarea required maxLength={5000} aria-label="Feedback details" placeholder="Describe your feedback" value={feedbackForm.description} onChange={(event) => setFeedbackForm({ ...feedbackForm, description: event.target.value })} rows={3} className="w-full border border-input bg-card px-3 py-2 text-sm text-white placeholder:text-muted-foreground" />
          <button disabled={busy} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Sending…' : 'Submit feedback'}</button>
        </form>
        {feedback.length === 0 ? <p className="border border-dashed border-input p-6 text-sm text-muted-foreground">No feedback yet.</p> : <div className="divide-y divide-border border-y border-border">{feedback.map((item) => <article key={item.id} className="space-y-4 py-5">
          <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-white">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.submitter.name} · {new Date(item.createdAt).toLocaleDateString()}</p></div><span className={`border px-2.5 py-1 text-xs ${feedbackStatusStyles[item.status] ?? feedbackStatusStyles.OPEN}`}>{item.status.replace('_', ' ').toLowerCase()}</span></header>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
          <div className="space-y-3 border-l border-input pl-4">{item.comments.length === 0 ? <p className="text-xs text-muted-foreground">No replies yet.</p> : item.comments.map((comment) => <div key={comment.id}><p className="text-xs text-emerald-200">{comment.author.name} · {new Date(comment.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p></div>)}
            <form onSubmit={(event) => submitComment(event, item.id)} className="flex gap-2"><input required aria-label={`Reply to ${item.title}`} placeholder="Add a comment" value={commentDrafts[item.id] ?? ''} onChange={(event) => setCommentDrafts({ ...commentDrafts, [item.id]: event.target.value })} className="h-9 min-w-0 flex-1 border border-input bg-background px-3 text-sm text-white placeholder:text-muted-foreground" /><button disabled={busy} className="h-9 border border-emerald-500/40 px-3 text-xs text-emerald-200 disabled:opacity-50">Reply</button></form>
          </div>
        </article>)}</div>}
      </section>
    </div>
  );
}