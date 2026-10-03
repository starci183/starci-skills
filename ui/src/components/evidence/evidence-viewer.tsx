import { useMemo, useState, type ReactNode } from 'react';
import { Download, ExternalLink, Search } from 'lucide-react';
import type { EvidenceFile } from '../../contract';
import { FileTypeBadge } from '../status-chip';
import { PathLink } from '../path-link';
import { DiffTextView, ImageView, JsonView, MarkdownView, TextView, VideoView, YamlView } from './renderers';
import { encodingNotes, formatBytes, isPlainEncoding, shortSha } from './format';
import { TEXT_KINDS, useBlobText, type BlobText } from './use-blob-text';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { CopyButton } from './renderers/common';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TimeAgo } from '../time-ago';

export const concept: Concept = 'C8';

const SEARCHABLE = new Set(['text', 'json', 'diff']);
const btn = 'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50';

function Note({ children, tone }: { children: ReactNode; tone?: 'warning' | 'failed' }) {
  return <div className="rounded-md border border-border px-3 py-2 text-sm" data-tone={tone}
    style={tone ? { borderColor: 'var(--tone-line)', background: 'var(--tone-bg)' } : undefined}>{children}</div>;
}

function Body({ file, query, blob }: { file: EvidenceFile; query: string; blob: BlobText }) {
  if (blob.status === 'error' && blob.httpStatus === 410) return <Note tone="warning">{t('Archived evidence is unavailable.')}</Note>;
  if (file.kind === 'image') return <ImageView file={file} />;
  if (file.kind === 'video') return <VideoView file={file} />;
  if (file.kind === 'audio') return <audio src={file.href} controls preload="metadata" className="w-full" />;
  if (!TEXT_KINDS.has(file.kind)) {
    return <Note>{file.kind === 'pdf' ? t('PDF file') : t('Binary file')} ({formatBytes(file.bytes)}, {file.mediaType}) {t('cannot be previewed.')} <a className="underline" href={file.href} target="_blank" rel="noreferrer">{t('Open raw ↗')}</a></Note>;
  }
  if (blob.status === 'loading' || blob.status === 'idle') return <div className="space-y-2" role="status" aria-label={t('Loading')}>
    {[80, 60, 90, 45, 70].map((w, i) => <div key={i} className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />)}</div>;
  if (blob.status === 'error') return <Note tone="failed">{t('Could not load the content ({error}).', { error: blob.error ?? '' })} <a className="underline" href={file.href} target="_blank" rel="noreferrer">{t('Open raw ↗')}</a></Note>;
  if (blob.text.trim() === '') return <Note>{t('Empty file (no content).')}</Note>;
  const { text } = blob;
  const searching = query.trim() !== '';
  const view = (() => {
    if (file.kind === 'text') return <TextView text={text} query={query} />;
    if (file.kind === 'json') return searching ? <TextView text={text} query={query} /> : <JsonView text={text} />;
    if (file.kind === 'diff') return searching ? <TextView text={text} query={query} /> : <DiffTextView text={text} />;
    if (file.kind === 'yaml') return <YamlView text={text} />;
    return <MarkdownView text={text} />;
  })();
  return <>
    {blob.truncated ? <div className="mb-2"><Note tone="warning">{t('Large file ({size}) — only the first 2000 lines are shown.', { size: formatBytes(file.bytes) })} <a className="underline" href={file.href} target="_blank" rel="noreferrer">{t('Open the full raw file ↗')}</a></Note></div> : null}
    {view}
  </>;
}

/** Right-hand frame: toolbar, meta line and the type-dispatched body of one evidence file. */
export function EvidenceViewer({ file }: { file: EvidenceFile }) {
  const [query, setQuery] = useState('');
  const blob = useBlobText(file);
  const canSearch = SEARCHABLE.has(file.kind);
  const encoding = file.encoding;
  const sourceEncoding = blob.sourceEncoding;
  const note = !isPlainEncoding(encoding) ? encodingNotes[encoding as string] : sourceEncoding && sourceEncoding !== 'utf-8' ? t('{encoding} → decoded', { encoding: sourceEncoding }) : null;
  const sha = useMemo(() => shortSha(file.sha), [file.sha]);
  return <section className="min-w-0 rounded-lg border bg-card" aria-label={t('View {name}', { name: file.name })}>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <FileTypeBadge kind={file.kind} />
      <span className="min-w-0 flex-1 truncate font-medium" title={file.name}>{file.label ?? file.base}</span>
      <span className="text-xs text-muted-foreground">{formatBytes(file.bytes)}</span>
      {note ? <span className="rounded border border-border bg-muted px-2 text-xs">{note}</span> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      {canSearch ? <label className="relative flex min-w-40 flex-1 items-center">
        <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search the content')}
          className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-sm" aria-label={t('Search the content')} />
      </label> : <span className="flex-1" />}
      {TEXT_KINDS.has(file.kind) ? <CopyButton value={blob.text} label={blob.truncated ? t('Copy loaded preview') : t('Copy text')} disabled={blob.status !== 'ready'} /> : null}
      <Button variant="outline" size="xs" asChild className={btn}><a href={file.href} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" aria-hidden="true" />{t('Open raw ↗')}</a></Button>
      <Button variant="outline" size="xs" asChild className={btn}><a href={`${file.href}?download=1`} download><Download className="size-3.5" aria-hidden="true" />{t('Download')}</a></Button>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">sha256 <code className="font-mono" title={file.sha}>{sha}</code><CopyButton value={file.sha} label={t('Copy')} /></span>
      <span>{t('Origin: {origin}', { origin: file.origin })}</span>
      <span>{file.project}{file.scopeRef ? ` · ${file.scopeRef}` : ''}</span>
      <TimeAgo at={file.createdAt} />
      {file.archived ? <span>{t('Archived')}</span> : null}
      {file.redaction ? <span data-tone="warning" className="rounded border px-2" style={{ borderColor: 'var(--tone-line)', background: 'var(--tone-bg)' }} title={t('The server redacted sensitive information')}>{t('Redacted: {detail}', { detail: file.redaction })}</span> : null}
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1">{t('On the machine:')} <PathLink path={file.hostPath} kind="file" /></span>
    </div>
    {blob.truncated && canSearch ? <p className="m-0 border-b px-3 py-2 text-xs text-muted-foreground">{t('Search and copy apply to the loaded preview only.')}</p> : null}
    <div className="max-h-[70vh] min-w-0 overflow-auto p-3"><Body file={file} query={query} blob={blob} /></div>
  </section>;
}
