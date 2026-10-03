'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

type Comment = { id: string; body: string; createdAt: string; author: { name: string; role: string } };
type FeedbackItem = { id: string; title: string; description: string; status: string; createdAt: string; submitter: { name: string }; project: { id: string; name: string }; comments: Comment[] };
const statuses = ['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'DECLINED'];

export default function FeedbackInboxPage() {
  const { support } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const readOnly = Boolean(support?.inSupportMode || support?.isSupportMode);

  const load = useCallback(async () => {
    const response = await api.get<{ data: FeedbackItem[] }>(`/api/v1/feedback${filter ? `?status=${filter}` : ''}`);
    setItems(response.data);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load feedback.')).finally(() => setLoading(false));
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/v1/feedback/${id}`, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update feedback.');
    } finally {
      setBusy(false);
    }
  }

  async function reply(event: FormEvent, id: string) {
    event.preventDefault();
    const body = drafts[id]?.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/feedback/${id}/comments`, { body });
      setDrafts((current) => ({ ...current, [id]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your reply.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight text-white">Feedback</h1><p className="mt-1 text-sm text-muted-foreground">Inbox across your projects</p></div><label className="flex items-center gap-2 text-xs text-muted-foreground">Status<select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter feedback by status" className="h-9 border border-input bg-card px-2 text-sm text-white"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label></header>
    {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <div className="surface-card h-40 animate-pulse" /> : items.length === 0 ? <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">No feedback matches this filter.</p> : <div className="divide-y divide-border border-y border-border">{items.map((item) => <article key={item.id} className="space-y-4 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">{item.project.name} · {item.submitter.name} · {new Date(item.createdAt).toLocaleDateString()}</p></div><select value={item.status} disabled={readOnly || busy} onChange={(event) => void updateStatus(item.id, event.target.value)} aria-label={`Status for ${item.title}`} className="h-9 border border-input bg-card px-2 text-xs text-white disabled:opacity-50">{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></header>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
      <div className="space-y-3 border-l border-input pl-4">{item.comments.map((comment) => <div key={comment.id}><p className="text-xs text-cyan-200">{comment.author.name} · {new Date(comment.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p></div>)}
        {!readOnly && <form onSubmit={(event) => void reply(event, item.id)} className="flex gap-2"><input required aria-label={`Reply to ${item.title}`} value={drafts[item.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Write a reply" className="h-9 min-w-0 flex-1 border border-input bg-background px-3 text-sm text-white placeholder:text-muted-foreground" /><button disabled={busy} className="h-9 border border-cyan-500/40 px-3 text-xs text-cyan-200 disabled:opacity-50">Reply</button></form>}
      </div>
    </article>)}</div>}
  </div>;
}