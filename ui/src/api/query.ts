import { useEffect, useRef, useState } from 'react';
import type { Envelope, ReadErrorEnvelope, ReadErrorMeta, ReadSource } from '../contract';
import { t } from '../i18n/t';

export type QuerySnapshot<T> = {
  data: T | null;
  meta: Envelope<T>['meta'] | null;
  loading: boolean;
  error: string | null;
  errorCode?: string | null;
  errorMeta?: ReadErrorMeta | null;
  observedAt: number | null;
};

type Subscription = { topics: string[]; intervalMs: number; validate: (data: unknown) => boolean };
type QueryRecord = {
  url: string;
  state: QuerySnapshot<unknown>;
  etag: string | null;
  listeners: Map<() => void, Subscription>;
  timer: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
  pendingRefresh: boolean;
  readVersion: number;
};

const records = new Map<string, QueryRecord>();
const pageReads = new Map<string, { owners: Set<symbol>; state: QuerySnapshot<unknown> }>();
const liveListeners = new Set<() => void>();
const healthListeners = new Set<() => void>();
let liveStatus: 'live' | 'polling' | 'hidden' = document.hidden ? 'hidden' : 'polling';
let live: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let liveTopics = '';
let queryHealth = { latestAt: null as number | null, latestSuccessfulReadAt: null as number | null, staleCount: 0, errorCount: 0, sources: [] as string[], stale: [] as string[] };

function getRecord(url: string): QueryRecord {
  const existing = records.get(url);
  if (existing) return existing;
  const record: QueryRecord = {
    url, state: { data: null, meta: null, loading: false, error: null, errorCode: null, errorMeta: null, observedAt: null },
    etag: null, listeners: new Map(), timer: null, controller: null, pendingRefresh: false, readVersion: 0,
  };
  records.set(url, record);
  return record;
}

function updateHealth(): void {
  const activeByUrl = new Map([...records.values()].filter((item) => item.listeners.size > 0).map((item) => [item.url, item.state]));
  pageReads.forEach((read, url) => { if (!activeByUrl.has(url)) activeByUrl.set(url, read.state); });
  const active = [...activeByUrl.values()];
  const at = active.flatMap((item) => item.meta ? [item.meta.at] : []);
  const successfulReads = active.flatMap((item) => item.observedAt === null ? [] : [item.observedAt]);
  const stale = [...new Set(active.flatMap((item) => [...(item.meta?.stale ?? []), ...(item.errorMeta?.stale ?? [])]))];
  queryHealth = {
    latestAt: at.length ? Math.max(...at) : null,
    latestSuccessfulReadAt: successfulReads.length ? Math.max(...successfulReads) : null,
    staleCount: stale.length,
    errorCount: active.filter((item) => item.error).length,
    sources: [...new Set(active.flatMap((item) => [...(item.meta?.sources ?? []), ...(item.errorMeta?.sources ?? [])].map((source) => `${source.db}:${source.rel}`)))],
    stale,
  };
  healthListeners.forEach((listener) => listener());
}

function publish(record: QueryRecord, patch: Partial<QuerySnapshot<unknown>>): void {
  record.state = { ...record.state, ...patch };
  record.listeners.forEach((_subscription, listener) => listener());
  updateHealth();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isReadSource(source: unknown): source is ReadSource {
  return isObject(source) && typeof source.db === 'string' && typeof source.rel === 'string'
    && (source.at === undefined || source.at === null || typeof source.at === 'number' && Number.isFinite(source.at))
    && (source.readAt === undefined || source.readAt === null || typeof source.readAt === 'number' && Number.isFinite(source.readAt))
    && (source.availability === undefined || typeof source.availability === 'string' && ['available', 'missing', 'unavailable', 'unsupported', 'pending'].includes(source.availability))
    && (source.code === undefined || typeof source.code === 'string' && ['DB_MISSING', 'DB_UNAVAILABLE', 'SCHEMA_UNSUPPORTED', 'READ_FAILED'].includes(source.code))
    && (source.error === undefined || source.error === null || typeof source.error === 'string')
    && (source.ledgerId === undefined || typeof source.ledgerId === 'string')
    && (source.name === undefined || typeof source.name === 'string');
}

function isReadMeta(meta: unknown): meta is ReadErrorMeta {
  return isObject(meta) && typeof meta.at === 'number' && Number.isFinite(meta.at)
    && Array.isArray(meta.sources) && meta.sources.every(isReadSource)
    && (meta.stale === undefined || Array.isArray(meta.stale) && meta.stale.every((source: unknown) => typeof source === 'string'));
}

export function isEnvelope(value: unknown): value is Envelope<unknown> {
  if (!isObject(value) || !Object.hasOwn(value, 'data') || !isObject(value.meta)) return false;
  const meta = value.meta;
  return typeof meta.etag === 'string' && (meta.next === undefined || meta.next === null || typeof meta.next === 'string') && isReadMeta(meta);
}

export function isReadErrorEnvelope(value: unknown): value is ReadErrorEnvelope {
  return isObject(value) && isObject(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string'
    && (value.meta === undefined || isReadMeta(value.meta));
}

export function readErrorEnvelope(value: unknown): ReadErrorEnvelope {
  if (!isReadErrorEnvelope(value)) throw new Error(t('The API returned an invalid response.'));
  return value;
}

export function readEnvelope(value: unknown): Envelope<unknown>;
export function readEnvelope<T>(value: unknown, validate: (data: unknown) => data is T): Envelope<T>;
export function readEnvelope(value: unknown, validate?: (data: unknown) => boolean): Envelope<unknown> {
  if (!isEnvelope(value) || validate && !validate(value.data)) throw new Error(t('The API returned an invalid response.'));
  return value;
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

async function request(record: QueryRecord, refreshAfterCurrent = false): Promise<void> {
  if (document.hidden || record.listeners.size === 0) return;
  if (record.controller) {
    if (refreshAfterCurrent || record.controller.signal.aborted) record.pendingRefresh = true;
    return;
  }
  clearSchedule(record);
  record.pendingRefresh = false;
  const controller = new AbortController();
  record.controller = controller;
  let errorCode = 'READ_FAILED';
  let errorMeta: ReadErrorMeta | null = null;
  publish(record, { loading: record.state.meta === null });
  try {
    const response = await fetch(record.url, {
      method: 'GET',
      headers: record.etag ? { 'If-None-Match': record.etag } : undefined,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    if (response.status === 304) {
      if (record.state.meta === null) {
        errorCode = 'INVALID_RESPONSE';
        throw new Error(t('The API returned an invalid response.'));
      }
      record.readVersion += 1;
      publish(record, { loading: false, observedAt: Date.now(), error: null, errorCode: null, errorMeta: null });
      return;
    }
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      errorCode = `HTTP_${response.status}`;
      try {
        const body: unknown = await response.json();
        if (isReadErrorEnvelope(body)) {
          message = body.error.message;
          errorCode = body.error.code;
          errorMeta = body.meta ?? null;
        }
      }
      catch { /* A status code is enough when the response is not JSON. */ }
      throw new Error(message);
    }
    errorCode = 'INVALID_RESPONSE';
    const envelope: unknown = await response.json();
    if (controller.signal.aborted) return;
    if (!isEnvelope(envelope) || [...record.listeners.values()].some((subscription) => !subscription.validate(envelope.data))) throw new Error(t('The API returned an invalid response.'));
    record.etag = response.headers.get('ETag') ?? envelope.meta.etag ?? null;
    record.readVersion += 1;
    publish(record, { data: envelope.data, meta: envelope.meta, loading: false, observedAt: Date.now(), error: null, errorCode: null, errorMeta: null });
  } catch (error) {
    if (!controller.signal.aborted) publish(record, { loading: false, error: error instanceof Error ? error.message : t('Could not read the data.'), errorCode, errorMeta });
  } finally {
    record.controller = null;
    if (controller.signal.aborted && record.state.loading) publish(record, { loading: false });
    if (record.pendingRefresh && !document.hidden && record.listeners.size > 0) void request(record);
    else schedule(record);
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
  source.onopen = () => { if (live === source) setLiveStatus('live'); };
  const invalidate = (event: MessageEvent<string>) => {
    if (live !== source) return;
    try {
      const mark: unknown = JSON.parse(event.data);
      if (!isObject(mark) || typeof mark.topic !== 'string') return;
      const markedTopic = mark.topic;
      records.forEach((record) => {
        if ([...record.listeners.values()].some((subscription) => subscription.topics.some((topic) => markedTopic === topic || markedTopic.startsWith(`${topic}:`)))) {
          void request(record, true);
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
    records.forEach((record) => { if (record.listeners.size) void request(record, true); });
    syncLive();
  }
});

export function useApiQuery<T>(url: string, options: { topics?: string[]; intervalMs?: number; enabled?: boolean; validate?: (data: unknown) => data is T } = {}): QuerySnapshot<T> {
  const { intervalMs = 30_000, enabled = true } = options;
  const topicKey = (options.topics ?? []).join('\u0000');
  const validate = useRef(options.validate);
  validate.current = options.validate;
  const [snapshot, setSnapshot] = useState<{ url: string; state: QuerySnapshot<T> }>(() => ({ url, state: getRecord(url).state as QuerySnapshot<T> }));
  useEffect(() => {
    const record = getRecord(url);
    setSnapshot({ url, state: record.state as QuerySnapshot<T> });
    if (!enabled) return;
    const listener = () => setSnapshot({ url, state: record.state as QuerySnapshot<T> });
    record.listeners.set(listener, { topics: topicKey ? topicKey.split('\u0000') : [], intervalMs, validate: (data) => validate.current?.(data) ?? true });
    updateHealth();
    if (record.state.meta === null) void request(record);
    else schedule(record);
    syncLive();
    return () => {
      record.listeners.delete(listener);
      if (record.listeners.size === 0) { clearSchedule(record); record.controller?.abort(); }
      updateHealth();
      syncLive();
    };
  }, [url, topicKey, intervalMs, enabled]);
  return snapshot.url === url ? snapshot.state : getRecord(url).state as QuerySnapshot<T>;
}

export function refreshQuery(url: string): void {
  const record = getRecord(url);
  if (record.listeners.size) void request(record, true);
}

type PagedOptions<T> = { topics?: string[]; intervalMs?: number; enabled?: boolean; getKey?: (row: T) => string; validateRow?: (row: unknown) => row is T };
export type PagedQuerySnapshot<T> = QuerySnapshot<T[]> & {
  next: string | null; loadMore: () => void; loadingMore: boolean; loadMoreError: string | null;
  loadMoreErrorCode: string | null; loadMoreErrorMeta: ReadErrorMeta | null;
  refresh: () => void; resetPages: () => void;
  pageMeta: Envelope<T[]>['meta'][];
};

/** Additional pages retain their own read provenance; changing the base URL invalidates their epoch. */
export function usePagedApiQuery<T>(url: string, options: PagedOptions<T> = {}): PagedQuerySnapshot<T> {
  const base = useApiQuery<T[]>(url, { ...options, validate: (data): data is T[] => Array.isArray(data) && (!options.validateRow || data.every(options.validateRow)) });
  const [more, setMore] = useState<{ url: string; pages: Envelope<T[]>[]; next?: string | null; loading: boolean; error: string | null;
    errorCode?: string | null; errorMeta?: ReadErrorMeta | null; observedAt: number | null; firstReadVersion?: number }>({ url, pages: [], loading: false, error: null, observedAt: null });
  const identity = useRef(url);
  identity.current = url;
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const heldPages = useRef(new Set<string>());
  const owner = useRef(Symbol('page-reader'));
  const enabled = options.enabled !== false;
  const current = more.url === url ? more : { url, pages: [], loading: false, error: null, observedAt: null, next: undefined };
  const releasePages = () => {
    const token = owner.current;
    const held = heldPages.current;
    for (const pageUrl of held) {
        const read = pageReads.get(pageUrl);
        read?.owners.delete(token);
        if (read?.owners.size === 0) pageReads.delete(pageUrl);
    }
    held.clear(); updateHealth();
  };
  useEffect(() => {
    const token = owner.current;
    const held = heldPages.current;
    const hidden = () => {
      if (!document.hidden) return;
      epoch.current += 1;
      controller.current?.abort(); controller.current = null;
      for (const pageUrl of held) {
        const read = pageReads.get(pageUrl);
        if (read) read.state = { ...read.state, loading: false };
      }
      setMore((state) => ({ ...state, loading: false })); updateHealth();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      epoch.current += 1;
      controller.current?.abort(); controller.current = null;
      for (const pageUrl of held) {
        const read = pageReads.get(pageUrl);
        read?.owners.delete(token);
        if (read?.owners.size === 0) pageReads.delete(pageUrl);
      }
      held.clear(); updateHealth();
    };
  }, [url, enabled]);
  const awaitingFirstRead = current.firstReadVersion !== undefined && getRecord(url).readVersion <= current.firstReadVersion;
  const next = awaitingFirstRead ? null : current.next === undefined ? base.meta?.next ?? null : current.next;
  const refresh = () => {
    epoch.current += 1;
    controller.current?.abort(); controller.current = null;
    releasePages();
    const record = getRecord(url);
    setMore({ url, pages: [], loading: false, error: null, observedAt: null, firstReadVersion: record.readVersion });
    record.controller?.abort();
    refreshQuery(url);
  };
  const loadMore = () => {
    if (!enabled || document.hidden || !next || controller.current || identity.current !== url) return;
    const params = new URL(url, window.location.origin);
    params.searchParams.set('cursor', next);
    const pageUrl = `${params.pathname}${params.search}`;
    const requestController = new AbortController();
    const requestEpoch = epoch.current;
    controller.current = requestController;
    const stillCurrent = () => !requestController.signal.aborted && identity.current === url && epoch.current === requestEpoch;
    const previous = pageReads.get(pageUrl);
    const read = previous ?? { owners: new Set<symbol>(), state: { data: null, meta: null, error: null, errorCode: null, loading: true, observedAt: null } };
    read.state = { ...read.state, loading: true };
    read.owners.add(owner.current); pageReads.set(pageUrl, read); heldPages.current.add(pageUrl); updateHealth();
    setMore({ ...current, loading: true, error: null });
    void (async () => {
      let errorCode = 'READ_FAILED';
      let errorMeta: ReadErrorMeta | null = null;
      try {
        const response = await fetch(pageUrl, { method: 'GET', signal: requestController.signal });
        if (!stillCurrent()) return;
        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          errorCode = `HTTP_${response.status}`;
          try {
            const body: unknown = await response.json();
            if (isReadErrorEnvelope(body)) { message = body.error.message; errorCode = body.error.code; errorMeta = body.meta ?? null; }
          } catch { /* Retain the HTTP status for a non-JSON failure. */ }
          throw new Error(message);
        }
        errorCode = 'INVALID_RESPONSE';
        const payload: unknown = await response.json();
        const envelope = readEnvelope<T[]>(payload, (data): data is T[] => Array.isArray(data) && (!options.validateRow || data.every(options.validateRow)));
        if (!stillCurrent()) return;
        const observedAt = Date.now();
        read.state = { data: envelope.data, meta: envelope.meta, loading: false, error: null, errorCode: null, errorMeta: null, observedAt }; updateHealth();
        setMore((previousState) => {
          const state = previousState.url === url ? previousState : { url, pages: [], loading: false, error: null, observedAt: null };
          return { ...state, pages: [...state.pages, envelope], next: envelope.meta.next ?? null, loading: false, error: null, errorCode: null, errorMeta: null, observedAt };
        });
      } catch (error) {
        if (!stillCurrent()) return;
        const message = error instanceof Error ? error.message : t('Could not load the next page.');
        read.state = { ...read.state, loading: false, error: message, errorCode, errorMeta }; updateHealth();
        setMore({ ...current, loading: false, error: message, errorCode, errorMeta });
      } finally {
        if (controller.current === requestController) controller.current = null;
      }
    })();
  };
  const rows = base.data === null && !current.pages.length ? null : [...(base.data ?? []), ...current.pages.flatMap((page) => page.data)];
  const keyOf = options.getKey;
  const unique = new Map<string, T>();
  if (rows && keyOf) for (const row of rows) { const key = keyOf(row); if (!unique.has(key)) unique.set(key, row); }
  const data = rows && keyOf ? [...unique.values()] : rows;
  const metas = [...(base.meta ? [base.meta] : []), ...current.pages.map((page) => page.meta)];
  const meta = base.meta && current.pages.length ? {
    ...base.meta,
    sources: [...new Map(metas.flatMap((item) => item.sources).map((source) => [JSON.stringify(source), source])).values()],
    stale: [...new Set(metas.flatMap((item) => item.stale ?? []))],
    next,
  } : base.meta;
  const reads = [base.observedAt, current.observedAt].filter((at): at is number => at !== null);
  return { ...base, data, meta, observedAt: reads.length ? Math.max(...reads) : null, next, loadMore, loadingMore: current.loading, loadMoreError: current.error,
    loadMoreErrorCode: current.errorCode ?? null, loadMoreErrorMeta: current.errorMeta ?? null, refresh, resetPages: refresh, pageMeta: metas };
}

export function useLiveStatus(): typeof liveStatus {
  const [status, setStatus] = useState(liveStatus);
  useEffect(() => {
    const listener = () => setStatus(liveStatus);
    liveListeners.add(listener);
    setStatus(liveStatus);
    return () => { liveListeners.delete(listener); };
  }, []);
  return status;
}

export function useQueryHealth(): typeof queryHealth {
  const [health, setHealth] = useState(queryHealth);
  useEffect(() => {
    const listener = () => setHealth(queryHealth);
    healthListeners.add(listener);
    setHealth(queryHealth);
    return () => { healthListeners.delete(listener); };
  }, []);
  return health;
}
