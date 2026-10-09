import { useMemo, useState, type ReactNode } from 'react';
import { Download, ExternalLink, Search } from 'lucide-react';
import { Alert, Card, Chip, InputGroup, Link, Skeleton, Toolbar } from '@heroui/react';
import type { EvidenceFile } from '../../contract';
import { FileTypeBadge } from '../status-chip';
import { PathLink } from '../path-link';
import { DiffTextView, ImageView, JsonView, MarkdownView, TextView, VideoView, YamlView } from './renderers';
import { encodingNotes, formatBytes, isPlainEncoding, shortSha } from './format';
import { TEXT_KINDS, useBlobText, type BlobText } from './use-blob-text';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { CopyButton } from './renderers/common';
import { TimeAgo } from '../time-ago';

export const concept: Concept = 'C8';

const SEARCHABLE = new Set(['text', 'json', 'diff']);
function Note({ children, tone }: { readonly children: ReactNode; readonly tone?: 'warning' | 'failed' }) {
  return <Alert status={tone === 'failed' ? 'danger' : tone === 'warning' ? 'warning' : 'default'}><Alert.Content><Alert.Description>{children}</Alert.Description></Alert.Content></Alert>;
}

function Body({ file, query, blob }: { readonly file: EvidenceFile; readonly query: string; readonly blob: BlobText }) {
  if (blob.status === 'error' && blob.httpStatus === 410) return <Note tone="warning">{t('Archived evidence is unavailable.')}</Note>;
  if (file.kind === 'image') return <ImageView file={file} />;
  if (file.kind === 'video') return <VideoView file={file} />;
  if (file.kind === 'audio') return <audio src={file.href} controls preload="metadata" aria-label={file.name} className="w-full"><track kind="captions" /></audio>;
  if (!TEXT_KINDS.has(file.kind)) {
    return <Note>{file.kind === 'pdf' ? t('PDF file') : t('Binary file')} ({formatBytes(file.bytes)}, {file.mediaType}) {t('cannot be previewed.')} <Link href={file.href} target="_blank" rel="noreferrer">{t('Open raw ↗')}</Link></Note>;
  }
  if (blob.status === 'loading' || blob.status === 'idle') return <output className="block space-y-2" aria-label={t('Loading')}>
    {[80, 60, 90, 45, 70].map(w => <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />)}</output>;
  if (blob.status === 'error') return <Note tone="failed">{t('Could not load the content ({error}).', { error: blob.error ?? '' })} <Link href={file.href} target="_blank" rel="noreferrer">{t('Open raw ↗')}</Link></Note>;
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
    {blob.truncated ? <div className="mb-2"><Note tone="warning">{t('Large file ({size}) — only the first 2000 lines are shown.', { size: formatBytes(file.bytes) })} <Link href={file.href} target="_blank" rel="noreferrer">{t('Open the full raw file ↗')}</Link></Note></div> : null}
    {view}
  </>;
}

/** Right-hand frame: toolbar, meta line and the type-dispatched body of one evidence file. */
export function EvidenceViewer({ file }: { readonly file: EvidenceFile }) {
  const [query, setQuery] = useState('');
  const blob = useBlobText(file);
  const canSearch = SEARCHABLE.has(file.kind);
  const encoding = file.encoding;
  const sourceEncoding = blob.sourceEncoding;
  const note = !isPlainEncoding(encoding) ? encodingNotes[encoding as string] : sourceEncoding && sourceEncoding !== 'utf-8' ? t('{encoding} → decoded', { encoding: sourceEncoding }) : null;
  const sha = useMemo(() => shortSha(file.sha), [file.sha]);
  return <Card<"section"> render={props => <section {...props} />} className="min-w-0 gap-0 overflow-hidden p-0" aria-label={t('View {name}', { name: file.name })}>
    <Card.Header className="flex-row flex-wrap items-center gap-2 border-b px-4 py-3">
      <FileTypeBadge kind={file.kind} />
      <Card.Title className="min-w-0 flex-1 truncate" title={file.name}>{file.label ?? file.base}</Card.Title>
      <span className="text-xs text-muted-foreground">{formatBytes(file.bytes)}</span>
      {note ? <Chip size="sm" variant="soft"><Chip.Label>{note}</Chip.Label></Chip> : null}
    </Card.Header>
    <Toolbar aria-label={t('View {name}', { name: file.name })} className="flex w-full flex-wrap items-center gap-3 border-b px-4 py-3">
      {canSearch ? <InputGroup className="min-w-40 flex-1">
        <InputGroup.Prefix><Search className="size-4 text-muted-foreground" aria-hidden="true" /></InputGroup.Prefix>
        <InputGroup.Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search the content')} aria-label={t('Search the content')} />
      </InputGroup> : <span className="flex-1" />}
      {TEXT_KINDS.has(file.kind) ? <CopyButton value={blob.text} label={blob.truncated ? t('Copy loaded preview') : t('Copy text')} disabled={blob.status !== 'ready'} /> : null}
      <Link href={file.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm"><ExternalLink className="size-3.5" aria-hidden="true" />{t('Open raw ↗')}</Link>
      <Link href={`${file.href}?download=1`} download className="inline-flex items-center gap-1 text-sm"><Download className="size-3.5" aria-hidden="true" />{t('Download')}</Link>
    </Toolbar>
    <dl className="grid min-w-0 gap-x-6 gap-y-3 border-b px-4 py-4 text-xs sm:grid-cols-2">
      <div className="min-w-0"><dt className="text-muted-foreground">sha256</dt><dd className="m-0 inline-flex flex-wrap items-center gap-2"><code className="font-mono" title={file.sha}>{sha}</code><CopyButton value={file.sha} label={t('Copy')} /></dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">{t('Source')}</dt><dd className="m-0 break-words">{t('Origin: {origin}', { origin: file.origin })}</dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">{t('Project')} · {t('Scope')}</dt><dd className="m-0 break-words">{file.project}{file.scopeRef ? ` · ${file.scopeRef}` : ''}</dd></div>
      <div className="min-w-0"><dt className="text-muted-foreground">{t('Artifact recorded at')}</dt><dd className="m-0"><TimeAgo at={file.createdAt} />{file.archived ? <span className="ml-2 text-muted-foreground">{t('Archived')}</span> : null}</dd></div>
      {file.redaction ? <div className="min-w-0 sm:col-span-2"><dt className="sr-only">{t('The server redacted sensitive information')}</dt><dd className="m-0"><Chip size="sm" color="warning" variant="soft" title={t('The server redacted sensitive information')}><Chip.Label>{t('Redacted: {detail}', { detail: file.redaction })}</Chip.Label></Chip></dd></div> : null}
      <div className="min-w-0 sm:col-span-2"><dt className="mb-1 text-muted-foreground">{t('On the machine:')}</dt><dd className="m-0 min-w-0"><PathLink path={file.hostPath} kind="file" /></dd></div>
    </dl>
    {blob.truncated && canSearch ? <p className="m-0 border-b px-4 py-3 text-xs text-muted-foreground">{t('Search and copy apply to the loaded preview only.')}</p> : null}
    <Card.Content className="max-h-[70vh] min-w-0 overflow-auto p-4"><Body file={file} query={query} blob={blob} /></Card.Content>
  </Card>;
}
