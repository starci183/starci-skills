import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Envelope, ReadErrorEnvelope, ReadErrorMeta, ReadSource } from '../contract';
import { t } from '../i18n/t';
import { byCodeUnit } from '../lib/utils';

/**
 * The state of one cached API read as a component sees it: the data and its provenance, whether a
 * read is in flight, and the failure with its code if the last read failed.
 */
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

const getRecord = (url: string): QueryRecord => {
  const existing = records.get(url);
  if (existing) return existing;
  const record: QueryRecord = {
    url, state: { data: null, meta: null, loading: false, error: null, errorCode: null, errorMeta: null, observedAt: null },
    etag: null, listeners: new Map(), timer: null, controller: null, pendingRefresh: false, readVersion: 0,
  };
  records.set(url, record);
  return record;
};

const updateHealth = (): void => {
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
};

const publish = (record: QueryRecord, patch: Partial<QuerySnapshot<unknown>>): void => {
  record.state = { ...record.state, ...patch };
  record.listeners.forEach((_subscription, listener) => listener());
  updateHealth();
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isReadSource = (source: unknown): source is ReadSource => {
  return isObject(source) && typeof source.db === 'string' && typeof source.rel === 'string'
    && (source.at === undefined || source.at === null || typeof source.at === 'number' && Number.isFinite(source.at))
    && (source.readAt === undefined || source.readAt === null || typeof source.readAt === 'number' && Number.isFinite(source.readAt))
    && (source.availability === undefined || typeof source.availability === 'string' && ['available', 'missing', 'unavailable', 'unsupported', 'pending'].includes(source.availability))
    && (source.code === undefined || typeof source.code === 'string' && ['DB_MISSING', 'DB_UNAVAILABLE', 'SCHEMA_UNSUPPORTED', 'READ_FAILED'].includes(source.code))
    && (source.error === undefined || source.error === null || typeof source.error === 'string')
    && (source.ledgerId === undefined || typeof source.ledgerId === 'string')
    && (source.name === undefined || typeof source.name === 'string');
};

const isReadMeta = (meta: unknown): meta is ReadErrorMeta => {
  return isObject(meta) && typeof meta.at === 'number' && Number.isFinite(meta.at)
    && Array.isArray(meta.sources) && meta.sources.every(isReadSource)
    && (meta.stale === undefined || Array.isArray(meta.stale) && meta.stale.every((source: unknown) => typeof source === 'string'));
};

/**
 * Checks that a parsed response body has the shape of a successful read envelope, so unexpected
 * server output is rejected instead of rendered.
 */
export const isEnvelope = (value: unknown): value is Envelope<unknown> => {
  if (!isObject(value) || !Object.hasOwn(value, 'data') || !isObject(value.meta)) return false;
  const meta = value.meta;
  return typeof meta.etag === 'string' && (meta.next === undefined || meta.next === null || typeof meta.next === 'string') && isReadMeta(meta);
};

/**
 * Checks that a parsed response body has the shape of the server's failed-read envelope, so its code
 * and provenance can be trusted.
 */
export const isReadErrorEnvelope = (value: unknown): value is ReadErrorEnvelope => {
  return isObject(value) && isObject(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string'
    && (value.meta === undefined || isReadMeta(value.meta));
};

/**
 * Returns a failed-read body as a typed envelope, or throws the translated invalid-response error
 * when it does not have that shape.
 */
export const readErrorEnvelope = (value: unknown): ReadErrorEnvelope => {
  if (!isReadErrorEnvelope(value)) throw new Error(t('The API returned an invalid response.'));
  return value;
};

/**
 * Validates a successful response body and its payload with the caller's check, throwing the
 * translated invalid-response error when either is wrong.
 */
export const readEnvelope = <T>(value: unknown, validate: (data: unknown) => data is T): Envelope<T> => {
  if (!isEnvelope(value) || !validate(value.data)) throw new Error(t('The API returned an invalid response.'));
  return { ...value, data: value.data };
};

const setLiveStatus = (status: typeof liveStatus): void => {
  if (liveStatus === status) return;
  liveStatus = status;
  liveListeners.forEach((listener) => listener());
};

const clearSchedule = (record: QueryRecord): void => {
  if (record.timer) clearTimeout(record.timer);
  record.timer = null;
};

const schedule = (record: QueryRecord): void => {
  clearSchedule(record);
  if (document.hidden || record.listeners.size === 0) return;
  const interval = Math.min(...[...record.listeners.values()].map((item) => item.intervalMs));
  if (Number.isFinite(interval) && interval > 0) {
    record.timer = setTimeout(() => { void request(record); }, interval);
  }
};

type ReadOutcome = { code: string; meta: ReadErrorMeta | null };

/** Reads the failure message, code and provenance from a non-OK response; a status code alone is enough when the body is not JSON. */
const readHttpFailure = async (response: Response): Promise<{ message: string; code: string; meta: ReadErrorMeta | null }> => {
  const failure = { message: `HTTP ${response.status}`, code: `HTTP_${response.status}`, meta: null as ReadErrorMeta | null };
  try {
    const body: unknown = await response.json();
    if (isReadErrorEnvelope(body)) {
      failure.message = body.error.message;
      failure.code = body.error.code;
      failure.meta = body.meta ?? null;
    }
  }
  catch { /* A status code is enough when the response is not JSON. */ }
  return failure;
};

/** Records the failure code and meta of a non-OK response on `outcome` and throws its message with the HTTP status kept as the cause. */
const throwHttpFailure = async (response: Response, outcome: ReadOutcome): Promise<never> => {
  const failure = await readHttpFailure(response);
  outcome.code = failure.code;
  outcome.meta = failure.meta;
  throw new Error(failure.message, { cause: response.status });
};

const applyNotModified = (record: QueryRecord, outcome: ReadOutcome): void => {
  if (record.state.meta === null) {
    outcome.code = 'INVALID_RESPONSE';
    throw new Error(t('The API returned an invalid response.'));
  }
  record.readVersion += 1;
  publish(record, { loading: false, observedAt: Date.now(), error: null, errorCode: null, errorMeta: null });
};

/** Reads a response that is not a 304: a non-OK answer is thrown with its status kept as the cause, an OK one is validated and published. */
const readFresh = async (record: QueryRecord, controller: AbortController, response: Response, outcome: ReadOutcome): Promise<void> => {
  if (!response.ok) {
    return throwHttpFailure(response, outcome);
  }
  outcome.code = 'INVALID_RESPONSE';
  const envelope: unknown = await response.json();
  if (controller.signal.aborted) return;
  if (!isEnvelope(envelope) || [...record.listeners.values()].some((subscription) => !subscription.validate(envelope.data))) throw new Error(t('The API returned an invalid response.'));
  record.etag = response.headers.get('ETag') ?? envelope.meta.etag ?? null;
  record.readVersion += 1;
  publish(record, { data: envelope.data, meta: envelope.meta, loading: false, observedAt: Date.now(), error: null, errorCode: null, errorMeta: null });
};

const readRecord = async (record: QueryRecord, controller: AbortController, outcome: ReadOutcome): Promise<void> => {
  const response = await fetch(record.url, {
    method: 'GET',
    headers: record.etag ? { 'If-None-Match': record.etag } : {},
    signal: controller.signal,
  });
  if (controller.signal.aborted) return;
  if (response.status === 304) applyNotModified(record, outcome);
  else await readFresh(record, controller, response, outcome);
};

const request = async (record: QueryRecord, refreshAfterCurrent = false): Promise<void> => {
  if (document.hidden || record.listeners.size === 0) return;
  if (record.controller) {
    if (refreshAfterCurrent || record.controller.signal.aborted) record.pendingRefresh = true;
    return;
  }
  clearSchedule(record);
  record.pendingRefresh = false;
  const controller = new AbortController();
  record.controller = controller;
  const outcome: ReadOutcome = { code: 'READ_FAILED', meta: null };
  publish(record, { loading: record.state.meta === null });
  try {
    await readRecord(record, controller, outcome);
  } catch (error) {
    if (!controller.signal.aborted) publish(record, { loading: false, error: error instanceof Error ? error.message : t('Could not read the data.'), errorCode: outcome.code, errorMeta: outcome.meta });
  } finally {
    record.controller = null;
    if (controller.signal.aborted && record.state.loading) publish(record, { loading: false });
    if (record.pendingRefresh && !document.hidden && record.listeners.size > 0) void request(record);
    else schedule(record);
  }
};

const activeTopics = (): string[] => {
  const topics = new Set<string>();
  records.forEach((record) => record.listeners.forEach((subscription) => subscription.topics.forEach((topic) => topics.add(topic))));
  return [...topics].sort(byCodeUnit);
};

const closeLive = (): void => {
  live?.close();
  live = null;
  liveTopics = '';
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
};

const connectLive = (): void => {
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
};

const syncLive = (): void => {
  if (document.hidden) { closeLive(); setLiveStatus('hidden'); return; }
  connectLive();
};

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

/**
 * Subscribes a component to a GET endpoint through the shared cache: one request per URL, ETag
 * revalidation, invalidation from the live stream and polling that pauses while the tab is hidden.
 */
export const useApiQuery = <T>(url: string, options: { topics?: string[]; intervalMs?: number; enabled?: boolean; validate?: (data: unknown) => data is T } = {}): QuerySnapshot<T> => {
  const { intervalMs = 30_000, enabled = true } = options;
  const topicKey = (options.topics ?? []).join('\u0000');
  const validate = useRef(options.validate);
  useEffect(() => { validate.current = options.validate; }, [options.validate]);
  const subscribe = useCallback((onChange: () => void) => {
    if (!enabled) return () => undefined;
    const record = getRecord(url);
    record.listeners.set(onChange, { topics: topicKey ? topicKey.split('\u0000') : [], intervalMs, validate: (data) => validate.current?.(data) ?? true });
    updateHealth();
    if (record.state.meta === null) void request(record);
    else schedule(record);
    syncLive();
    return () => {
      record.listeners.delete(onChange);
      if (record.listeners.size === 0) { clearSchedule(record); record.controller?.abort(); }
      updateHealth();
      syncLive();
    };
  }, [url, topicKey, intervalMs, enabled]);
  const getSnapshot = useCallback(() => getRecord(url).state as QuerySnapshot<T>, [url]);
  return useSyncExternalStore(subscribe, getSnapshot);
};

/** Asks the shared cache to re-read a URL now, for callers that know its data has just changed. */
export const refreshQuery = (url: string): void => {
  const record = getRecord(url);
  if (record.listeners.size) void request(record, true);
};

type PagedOptions<T> = { topics?: string[]; intervalMs?: number; enabled?: boolean; getKey?: (row: T) => string; validateRow?: (row: unknown) => row is T };
/**
 * A query snapshot for a cursor-paged list, extended with the next cursor, the load-more and refresh
 * actions and the state of the additional pages.
 */
export type PagedQuerySnapshot<T> = QuerySnapshot<T[]> & {
  next: string | null; loadMore: () => void; loadingMore: boolean; loadMoreError: string | null;
  loadMoreErrorCode: string | null; loadMoreErrorMeta: ReadErrorMeta | null;
  refresh: () => void; resetPages: () => void;
  pageMeta: Envelope<T[]>['meta'][];
};

type PagedState<T> = { url: string; pages: Envelope<T[]>[]; next?: string | null; loading: boolean; error: string | null;
  errorCode?: string | null; errorMeta?: ReadErrorMeta | null; observedAt: number | null; firstReadVersion?: number };

const rowsValidator = <T>(validateRow: ((row: unknown) => row is T) | undefined): (data: unknown) => data is T[] => {
  return (data): data is T[] => Array.isArray(data) && (!validateRow || data.every(validateRow));
};

/** Drops this owner's claim on each held additional page and forgets pages nobody else holds. */
const releaseHeldPages = (token: symbol, held: Set<string>): void => {
  for (const pageUrl of held) {
    const read = pageReads.get(pageUrl);
    read?.owners.delete(token);
    if (read?.owners.size === 0) pageReads.delete(pageUrl);
  }
  held.clear();
  updateHealth();
};

/** Fetches one additional page; resolves null once the request is no longer current. */
const fetchPageEnvelope = async <T>(pageUrl: string, signal: AbortSignal, stillCurrent: () => boolean,
  validateRow: ((row: unknown) => row is T) | undefined, outcome: ReadOutcome): Promise<Envelope<T[]> | null> => {
  const response = await fetch(pageUrl, { method: 'GET', signal });
  if (!stillCurrent()) return null;
  if (!response.ok) {
    return throwHttpFailure(response, outcome);
  }
  outcome.code = 'INVALID_RESPONSE';
  const payload: unknown = await response.json();
  const envelope = readEnvelope<T[]>(payload, rowsValidator(validateRow));
  return stillCurrent() ? envelope : null;
};

const uniqueRows = <T>(rows: T[] | null, keyOf: ((row: T) => string) | undefined): T[] | null => {
  if (!rows || !keyOf) return rows;
  const unique = new Map<string, T>();
  for (const row of rows) { const key = keyOf(row); if (!unique.has(key)) unique.set(key, row); }
  return [...unique.values()];
};

/** Additional pages retain their own read provenance; changing the base URL invalidates their epoch. */
export const usePagedApiQuery = <T>(url: string, options: PagedOptions<T> = {}): PagedQuerySnapshot<T> => {
  const base = useApiQuery<T[]>(url, { ...options, validate: rowsValidator(options.validateRow) });
  const [more, setMore] = useState<PagedState<T>>({ url, pages: [], loading: false, error: null, observedAt: null });
  const identity = useRef(url);
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const heldPages = useRef(new Set<string>());
  const owner = useRef(Symbol('page-reader'));
  const enabled = options.enabled !== false;
  const current: PagedState<T> = more.url === url ? more : { url, pages: [], loading: false, error: null, observedAt: null };
  const releasePages = () => releaseHeldPages(owner.current, heldPages.current);
  useEffect(() => {
    identity.current = url;
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
      releaseHeldPages(token, held);
    };
  }, [url, enabled]);
  const awaitingFirstRead = current.firstReadVersion !== undefined && getRecord(url).readVersion <= current.firstReadVersion;
  const pagedNext = current.next === undefined ? base.meta?.next ?? null : current.next;
  const next = awaitingFirstRead ? null : pagedNext;
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
      const outcome: ReadOutcome = { code: 'READ_FAILED', meta: null };
      try {
        const envelope = await fetchPageEnvelope<T>(pageUrl, requestController.signal, stillCurrent, options.validateRow, outcome);
        if (envelope === null) return;
        const observedAt = Date.now();
        read.state = { data: envelope.data, meta: envelope.meta, loading: false, error: null, errorCode: null, errorMeta: null, observedAt }; updateHealth();
        setMore((previousState) => {
          const state = previousState.url === url ? previousState : { url, pages: [], loading: false, error: null, observedAt: null };
          return { ...state, pages: [...state.pages, envelope], next: envelope.meta.next ?? null, loading: false, error: null, errorCode: null, errorMeta: null, observedAt };
        });
      } catch (error) {
        if (!stillCurrent()) return;
        const message = error instanceof Error ? error.message : t('Could not load the next page.');
        read.state = { ...read.state, loading: false, error: message, errorCode: outcome.code, errorMeta: outcome.meta }; updateHealth();
        setMore({ ...current, loading: false, error: message, errorCode: outcome.code, errorMeta: outcome.meta });
      } finally {
        if (controller.current === requestController) controller.current = null;
      }
    })();
  };
  const rows = base.data === null && !current.pages.length ? null : [...(base.data ?? []), ...current.pages.flatMap((page) => page.data)];
  const data = uniqueRows(rows, options.getKey);
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
};

const subscribeLive = (listener: () => void): () => void => {
  liveListeners.add(listener);
  return () => { liveListeners.delete(listener); };
};

const subscribeHealth = (listener: () => void): () => void => {
  healthListeners.add(listener);
  return () => { healthListeners.delete(listener); };
};

/**
 * Reports whether updates currently arrive over the live stream, by polling, or are paused because
 * the tab is hidden.
 */
export const useLiveStatus = (): typeof liveStatus => {
  return useSyncExternalStore(subscribeLive, () => liveStatus);
};

/**
 * Summarises every active read for the header: the latest observation, the failing and stale
 * sources, and how many reads are failing.
 */
export const useQueryHealth = (): typeof queryHealth => {
  return useSyncExternalStore(subscribeHealth, () => queryHealth);
};
