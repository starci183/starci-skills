import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, CircleAlert, ExternalLink, LoaderCircle, Search } from 'lucide-react';
import { Autocomplete, Button, Description, ListBox, Modal, SearchField } from '@heroui/react';
import { StateChip } from './state-chip';
import { FeedbackState } from './feedback-state';
import { readEnvelope, readErrorEnvelope } from '../api/query';
import { navigate, parseRoute } from '../router';
import { formatAbsolute } from '../i18n/vi';
import { t } from '../i18n/t';
import { UI_STATES, type Envelope, type ReadErrorMeta, type SearchHit, type SearchIdentity, type SearchView } from '../contract';
import type { Concept } from './concept';

export const concept: Concept = 'frame';
type SearchResult = {
  query: string; data: SearchView | null; meta: Envelope<SearchView>['meta'] | null;
  loading: boolean; error: string | null; errorCode: string | null; errorMeta: ReadErrorMeta | null; observedAt: number | null;
};

function isIdentity(value: unknown): value is SearchIdentity {
  return value !== null && typeof value === 'object'
    && 'store' in value && (value.store === 'machine' || value.store === 'ledger')
    && 'ledgerId' in value && (value.ledgerId === null || typeof value.ledgerId === 'string')
    && 'workflow' in value && (value.workflow === null || typeof value.workflow === 'string')
    && 'kind' in value && typeof value.kind === 'string'
    && 'id' in value && typeof value.id === 'string';
}

function isSearchRef(value: unknown): value is NonNullable<SearchHit['ref']> {
  return isIdentity(value) && 'href' in value && typeof value.href === 'string';
}

function isHit(value: unknown): value is SearchHit {
  return value !== null && typeof value === 'object'
    && 'kind' in value && typeof value.kind === 'string'
    && 'id' in value && typeof value.id === 'string'
    && 'href' in value && (value.href === null || typeof value.href === 'string')
    && 'title' in value && typeof value.title === 'string'
    && (!('project' in value) || value.project === undefined || value.project === null || typeof value.project === 'string')
    && 'ui' in value && (UI_STATES as readonly unknown[]).includes(value.ui)
    && 'matched' in value && isIdentity(value.matched)
    && 'ref' in value && (value.ref === null || isSearchRef(value.ref));
}

function isSearchView(value: unknown): value is SearchView {
  return value !== null && typeof value === 'object'
    && 'hits' in value && Array.isArray(value.hits) && value.hits.every(isHit)
    && 'limit' in value && typeof value.limit === 'number' && Number.isSafeInteger(value.limit) && value.limit > 0
    && 'truncated' in value && typeof value.truncated === 'boolean';
}

function hitKey(hit: SearchHit): string {
  const { store, ledgerId, workflow, kind, id } = hit.matched;
  return JSON.stringify([store, ledgerId, workflow, kind, id]);
}

function targetOf(hit: SearchHit): 'route' | 'blob' | null {
  if (hit.href !== hit.ref?.href) return null;
  if (/^\/api\/blob\/[a-f0-9]{64}$/.test(hit.ref.href)) return 'blob';
  return hit.ref.href.startsWith('#/') && parseRoute(hit.ref.href).kind !== 'not-found' ? 'route' : null;
}

function initialResult(query: string): SearchResult {
  return { query, data: null, meta: null, loading: false, error: null, errorCode: null, errorMeta: null, observedAt: null };
}

function RestoreSearchFocus({ restore }: Readonly<{ restore: () => void }>) {
  useEffect(() => () => {
    // Run after the modal has unmounted and HeroUI has restored its focus scope.
    requestAnimationFrame(() => requestAnimationFrame(restore));
  }, [restore]);
  return null;
}

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<SearchResult>(() => initialResult(''));
  const trigger = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpen = useRef(false);
  const descriptionId = useId();
  const needle = query.trim();
  const current = result.query === needle ? result : null;
  const hits = current?.data?.hits ?? [];
  const loading = Boolean(needle) && (!current || current.loading);
  const error = current?.error;
  const meta = current?.errorMeta ?? current?.meta;
  const partial = Boolean(meta?.stale?.length || meta?.sources.some(source => source.availability && source.availability !== 'available'));
  const provenance = [
    current?.observedAt == null ? '' : t('Last successful API read: {at}', { at: formatAbsolute(current.observedAt) }),
    meta?.sources.length ? t('Sources: {list}', { list: meta.sources.map(source => `${source.db}:${source.rel}`).join(', ') }) : '',
    meta?.stale?.length ? t('Unavailable sources: {list}', { list: meta.stale.join(', ') }) : '',
  ].filter(Boolean).join(' · ');
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  const changeOpen = useCallback((next: boolean) => {
    if (next) {
      const target = document.activeElement;
      returnFocus.current = target instanceof HTMLElement && target !== document.body && target !== document.documentElement ? target : null;
    }
    isOpen.current = next;
    setOpen(next);
  }, []);
  const restoreFocus = useCallback(() => {
    if (isOpen.current) return;
    const target = returnFocus.current?.isConnected ? returnFocus.current : trigger.current;
    target?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && !event.repeat && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        changeOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, changeOpen]);

  useEffect(() => {
    if (!open || !needle) { setResult(initialResult(needle)); return; }
    const controller = new AbortController();
    setResult(previous => ({ ...(previous.query === needle ? previous : initialResult(needle)), loading: true, error: null, errorCode: null, errorMeta: null }));
    const timer = setTimeout(async () => {
      let errorCode = 'READ_FAILED';
      let errorMeta: ReadErrorMeta | null = null;
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal });
        if (!response.ok) {
          errorCode = `HTTP_${response.status}`;
          const payload: unknown = await response.json();
          const failure = readErrorEnvelope(payload);
          errorCode = failure.error.code;
          errorMeta = failure.meta ?? null;
          throw new Error('Search read failed');
        }
        errorCode = 'INVALID_RESPONSE';
        const payload: unknown = await response.json();
        const envelope = readEnvelope(payload, isSearchView);
        const data = { ...envelope.data, hits: [...new Map(envelope.data.hits.map(hit => [hitKey(hit), hit])).values()] };
        if (!controller.signal.aborted) setResult({ query: needle, data, meta: envelope.meta, loading: false, error: null, errorCode: null, errorMeta: null, observedAt: Date.now() });
      } catch {
        if (!controller.signal.aborted) setResult(previous => ({
          ...(previous.query === needle ? previous : initialResult(needle)), loading: false, error: t('Could not read the search.'), errorCode, errorMeta,
        }));
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, needle, retry]);

  const choose = (hit: SearchHit) => {
    const target = targetOf(hit);
    if (!target || !hit.ref) return;
    if (target === 'blob') window.open(hit.ref.href, '_blank', 'noopener,noreferrer');
    else navigate(hit.ref.href);
    changeOpen(false);
  };
  return <Modal isOpen={open} onOpenChange={changeOpen}>
    <Button ref={trigger} variant="outline" className="shell-search-trigger" aria-label={t('Search an id or evidence')} aria-keyshortcuts="Meta+K Control+K">
      <Search className="size-4" aria-hidden="true" /><span>{t('Search an id or evidence')}</span><kbd>{shortcut}</kbd>
    </Button>
    <Modal.Backdrop>
      <Modal.Container placement="center" size="md" className="search-dialog">
        <Modal.Dialog className="command-dialog gap-0 overflow-hidden" aria-describedby={descriptionId}>
          <RestoreSearchFocus restore={restoreFocus} />
          <Modal.CloseTrigger aria-label={t('Close')} />
          <Modal.Header><Modal.Heading>{t('Search in StarCi')}</Modal.Heading><Description id={descriptionId}>{t('Paste a workflow, unit, attempt, decision or blob id.')}</Description></Modal.Header>
          <Modal.Body>
            <Autocomplete.Filter inputValue={query} onInputChange={setQuery}>
              <SearchField autoFocus fullWidth aria-label={t('Search keywords')}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder={t('Enter an id or keyword…')} />
                  <SearchField.ClearButton aria-label={t('Clear search')} />
                </SearchField.Group>
              </SearchField>
              <div className="search-results" aria-busy={loading}>
                {!needle && <output>{t('Enter an id to open its evidence.')}</output>}
                {partial && !error && <output className="flex items-center gap-2 py-2 text-xs text-[var(--status-warning)]" title={provenance}>
                  <CircleAlert className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{t('Some search sources could not be read.')}</span>
                  <Button variant="ghost" size="sm" isDisabled={loading} onPress={() => setRetry(value => value + 1)}>{t('Retry')}</Button>
                </output>}
                {loading && <output className="flex items-center gap-2 px-3 py-4" aria-live="polite"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{t('Searching…')}</output>}
                {error && <div title={provenance}><FeedbackState error onRetry={() => setRetry(value => value + 1)}>{current?.data ? t('Could not refresh the search. Showing the last successful results.') : error}</FeedbackState></div>}
                <ListBox items={hits} aria-label={t('Search results')} selectionMode="none" renderEmptyState={() => !loading && !error && needle ? <output className="block py-6 text-center text-sm">{partial ? t('No matching results from the available sources.') : t('No matching results.')}</output> : null}>
                  {hit => {
                    const target = targetOf(hit);
                    const identity = hit.ref ?? hit.matched;
                    const alias = hit.ref && (hit.matched.kind !== hit.ref.kind || hit.matched.id !== hit.ref.id);
                    return <ListBox.Item id={hitKey(hit)} textValue={hit.title} className="search-hit" isDisabled={target === null} onAction={() => choose(hit)}>
                      <span title={[hit.title, identity.store, identity.ledgerId, hit.project, identity.workflow, identity.kind, identity.id].filter(Boolean).join(' · ')}><strong>{hit.title}</strong><small className="break-all">{identity.kind} · {identity.id}</small>
                        <small className="break-all">{[identity.store === 'machine' ? t('Machine') : identity.ledgerId ?? t('Not observed.'), hit.project, identity.workflow].filter(Boolean).join(' · ')}</small>
                        {alias && <small className="break-all">{t('Matched {kind}: {id}', { kind: hit.matched.kind, id: hit.matched.id })}</small>}
                        {!target && <small>{t('No supported page for this result.')}</small>}
                      </span>
                      <StateChip state={hit.ui} />{target === 'blob' ? <ExternalLink className="size-4 shrink-0" aria-hidden="true" /> : target === 'route' ? <ArrowRight className="size-4 shrink-0" aria-hidden="true" /> : null}
                    </ListBox.Item>;
                  }}
                </ListBox>
                {current?.data?.truncated && <output title={provenance}>{t('Showing the first {n} search results.', { n: hits.length })}</output>}
              </div>
            </Autocomplete.Filter>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>;
}
