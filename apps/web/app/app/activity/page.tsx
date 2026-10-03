'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type ActivityItem = { id: string; eventType: string; actorType: string; createdAt: string; projectId: string | null; metadata: Record<string, unknown> | null };
type ActivityPage = { data: ActivityItem[]; meta: { page: number; totalPages: number; total: number } };

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextPage: number) {
    const response = await api.get<ActivityPage>(`/api/v1/activity?page=${nextPage}&limit=20`);
    setItems((current) => nextPage === 1 ? response.data : [...current, ...response.data]);
    setTotalPages(response.meta.totalPages);
    setPage(nextPage);
  }

  useEffect(() => {
    load(1).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load activity.')).finally(() => setLoading(false));
  }, []);

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold tracking-tight text-white">Activity</h1><p className="mt-1 text-sm text-muted-foreground">Recent events across your agency</p></header>
    {error && <p role="alert" className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {loading ? <div className="surface-card h-40 animate-pulse" /> : items.length === 0 ? <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">No activity yet.</p> : <div className="divide-y divide-border border-y border-border">{items.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div><p className="text-sm font-medium text-white">{item.eventType.replaceAll('.', ' ').replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted-foreground">{item.actorType.toLowerCase()}{item.projectId ? ` · Project ${item.projectId}` : ''}</p>{item.metadata && <p className="mt-1 text-xs text-muted-foreground">{Object.values(item.metadata).filter((value): value is string => typeof value === 'string').join(' · ')}</p>}</div><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></article>)}</div>}
    {!loading && page < totalPages && <button type="button" onClick={() => void load(page + 1).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load more activity.'))} className="h-10 border border-input px-4 text-sm text-foreground">Load more</button>}
  </div>;
}