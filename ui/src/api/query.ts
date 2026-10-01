import { useEffect, useState } from 'react';
import type { Envelope } from '../contract';
import { t } from '../i18n/t';

export type QuerySnapshot<T> = {
  data: T | null;
  meta: Envelope<T>['meta'] | null;
  loading: boolean;
  error: string | null;
  observedAt: number | null;
};

type Subscription = { topics: string[]; intervalMs: number };
type QueryRecord = {
  url: string;
  state: QuerySnapshot<unknown>;
  etag: string | null;
  listeners: Map<() => void, Subscription>;
  timer: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
};

const records = new Map<string, QueryRecord>();
const liveListeners = new Set<() => void>();
const healthListeners = new Set<() => void>();
let liveStatus: 'live' | 'polling' | 'hidden' = document.hidden ? 'hidden' : 'polling';
let live: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let liveTopics = '';
let queryHealth = { latestAt: null as number | null, staleCount: 0, errorCount: 0, sources: [] as string[], stale: [] as string[] };

function getRecord(url: string): QueryRecord {
  const existing = records.get(url);
  if (existing) return existing;
  const record: QueryRecord = {
    url, state: { data: null, meta: null, loading: false, error: null, observedAt: null },
    etag: null, listeners: new Map(), timer: null, controller: null,
  };
  records.set(url, record);
  return record;
}

function publish(record: QueryRecord, patch: Partial<QuerySnapshot<unknown>>): void {
  record.state = { ...record.state, ...patch };
  record.listeners.forEach((_subscription, listener) => listener());
  const active = [...records.values()].filter((item) => item.listeners.size > 0);
  const at = active.map((item) => item.state.meta?.at ?? 0).filter(Boolean);
  queryHealth = {
    latestAt: at.length ? Math.max(...at) : null,
    staleCount: active.reduce((sum, item) => sum + (item.state.meta?.stale?.length ?? 0), 0),
    errorCount: active.filter((item) => item.state.error).length,
    sources: [...new Set(active.flatMap((item) => item.state.meta?.sources?.map((source) => `${source.db}:${source.rel}`) ?? []))],
    stale: [...new Set(active.flatMap((item) => item.state.meta?.stale ?? []))],
  };
  healthListeners.forEach((listener) => listener());
}

function setLiveStatus(status: typeof liveStatus): void {
  if (liveStatus === status) return;
  liveStatus = status;
  liveListeners.forEach((listener) => listener());
}

function clearSchedule(record: QueryRecord): void {
  if (record.timer) clearTimeout(record.timer);
  record.timer = null;
}

function schedule(record: QueryRecord): void {
  clearSchedule(record);
  if (document.hidden || record.listeners.size === 0) return;
  const interval = Math.min(...[...record.listeners.values()].map((item) => item.intervalMs));
  if (Number.isFinite(interval) && interval > 0) {
    record.timer = setTimeout(() => { void request(record); }, interval);
  }
}

async function request(record: QueryRecord): Promise<void> {
  if (document.hidden || record.listeners.size === 0 || record.controller) return;
  clearSchedule(record);
  const controller = new AbortController();
  record.controller = controller;
  publish(record, { loading: record.state.data === null, error: null });
  try {
    const response = await fetch(record.url, {
      method: 'GET',
      headers: record.etag ? { 'If-None-Match': record.etag } : undefined,
      signal: controller.signal,
    });
    if (response.status === 304) {
      publish(record, { loading: false, observedAt: Date.now(), error: null });
      return;
    }
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try { const body = await response.json() as { error?: { message?: string } }; message = body.error?.message ?? message; }
      catch { /* A status code is enough when the response is not JSON. */ }
      throw new Error(message);
    }
    const envelope = await response.json() as Envelope<unknown>;
    record.etag = response.headers.get('ETag') ?? envelope.meta.etag ?? null;
    publish(record, { data: envelope.data, meta: envelope.meta, loading: false, observedAt: Date.now(), error: null });
  } catch (error) {
    if (!controller.signal.aborted) publish(record, { loading: false, error: error instanceof Error ? error.message : t('Could not read the data.') });
  } finally {
    record.controller = null;
    schedule(record);
  }
}

function activeTopics(): string[] {
  const topics = new Set<string>();
  records.forEach((record) => record.listeners.forEach((subscription) => subscription.topics.forEach((topic) => topics.add(topic))));
  return [...topics].sort();
}

function closeLive(): void {
  live?.close();
  live = null;
  liveTopics = '';
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function connectLive(): void {
  if (document.hidden) return;
  const topics = activeTopics();
  const joined = topics.join(',');
  if (!joined) { closeLive(); setLiveStatus('polling'); return; }
  if (live && liveTopics === joined) return;
  closeLive();
  liveTopics = joined;
  const source = new EventSource(`/api/live?topics=${encodeURIComponent(joined)}`);
  live = source;
  source.onopen = () => setLiveStatus('live');
  const invalidate = (event: MessageEvent<string>) => {
    try {
      const mark = JSON.parse(event.data) as { topic?: string };
      if (!mark.topic) return;
      records.forEach((record) => {
        if ([...record.listeners.values()].some((subscription) => subscription.topics.some((topic) => mark.topic === topic || mark.topic?.startsWith(`${topic}:`)))) {
          void request(record);
        }
      });
    } catch { /* Heartbeats and malformed invalidations do not replace the snapshot. */ }
  };
  source.onmessage = invalidate;
  source.addEventListener('invalidate', invalidate as EventListener);
  source.onerror = () => {
    if (live !== source) return;
    source.close();
    live = null;
    setLiveStatus('polling');
    retryTimer = setTimeout(connectLive, 30_000);
  };
}

function syncLive(): void {
  if (document.hidden) { closeLive(); setLiveStatus('hidden'); return; }
  connectLive();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    records.forEach((record) => { clearSchedule(record); record.controller?.abort(); });
    syncLive();
  } else {
    setLiveStatus('polling');
    records.forEach((record) => { if (record.listeners.size) void request(record); });
    syncLive();
  }
});

export function useApiQuery<T>(url: string, options: { topics?: string[]; intervalMs?: number; enabled?: boolean } = {}): QuerySnapshot<T> {
  const { intervalMs = 30_000, enabled = true } = options;
  const topicKey = (options.topics ?? []).join('\u0000');
  const [snapshot, setSnapshot] = useState<{ url: string; state: QuerySnapshot<T> }>(() => ({ url, state: getRecord(url).state as QuerySnapshot<T> }));
  useEffect(() => {
    const record = getRecord(url);
    setSnapshot({ url, state: record.state as QuerySnapshot<T> });
    if (!enabled) return;
    const listener = () => setSnapshot({ url, state: record.state as QuerySnapshot<T> });
    record.listeners.set(listener, { topics: topicKey ? topicKey.split('\u0000') : [], intervalMs });
    if (record.state.data === null) void request(record);
    else schedule(record);
    syncLive();
    return () => {
      record.listeners.delete(listener);
      if (record.listeners.size === 0) { clearSchedule(record); record.controller?.abort(); }
      syncLive();
    };
  }, [url, topicKey, intervalMs, enabled]);
  return snapshot.url === url ? snapshot.state : getRecord(url).state as QuerySnapshot<T>;
}

export function refreshQuery(url: string): void {
  const record = getRecord(url);
  if (record.listeners.size) void request(record);
}

export function useLiveStatus(): typeof liveStatus {
  const [status, setStatus] = useState(liveStatus);
  useEffect(() => {
    const listener = () => setStatus(liveStatus);
    liveListeners.add(listener);
    return () => { liveListeners.delete(listener); };
  }, []);
  return status;
}

export function useQueryHealth(): typeof queryHealth {
  const [health, setHealth] = useState(queryHealth);
  useEffect(() => {
    const listener = () => setHealth(queryHealth);
    healthListeners.add(listener);
    return () => { healthListeners.delete(listener); };
  }, []);
  return health;
}
