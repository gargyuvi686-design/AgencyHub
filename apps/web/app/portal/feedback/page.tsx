'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type Comment = { id: string; body: string; createdAt: string; author: { name: string; role: string } };
type FeedbackItem = { id: string; title: string; description: string; status: string; createdAt: string; project: { id: string; name: string }; comments: Comment[] };

export default function PortalFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const response = await api.get<{ data: FeedbackItem[] }>('/api/v1/portal/feedback');
    setItems(response.data);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load feedback.')).finally(() => setLoading(false));
  }, []);

  async function reply(event: FormEvent, id: string) {
    event.preventDefault();
    const body = drafts[id]?.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/v1/portal/feedback/${id}/comments`, { body });
      setDrafts((current) => ({ ...current, [id]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your reply.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold tracking-tight text-white">Feedback</h1><p className="mt-1 text-sm text-muted-foreground">Conversations across your projects</p></header>
    {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <div className="surface-card h-40 animate-pulse" /> : items.length === 0 ? <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">No feedback conversations yet.</p> : <div className="divide-y divide-border border-y border-border">{items.map((item) => <article key={item.id} className="space-y-4 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">{item.project.name} · {new Date(item.createdAt).toLocaleDateString()}</p></div><span className="status-pill bg-muted text-foreground">{item.status.replace('_', ' ').toLowerCase()}</span></header>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>
      <div className="space-y-3 border-l border-input pl-4">{item.comments.map((comment) => <div key={comment.id}><p className="text-xs text-emerald-200">{comment.author.name} · {new Date(comment.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p></div>)}
        <form onSubmit={(event) => void reply(event, item.id)} className="flex gap-2"><input required aria-label={`Reply to ${item.title}`} value={drafts[item.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add a comment" className="h-9 min-w-0 flex-1 border border-input bg-background px-3 text-sm text-white placeholder:text-muted-foreground" /><button disabled={busy} className="h-9 border border-emerald-500/40 px-3 text-xs text-emerald-200 disabled:opacity-50">Reply</button></form>
      </div>
    </article>)}</div>}
  </div>;
}