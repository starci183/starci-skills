import { useMemo, useState, type ReactNode } from 'react';
import { Copy, Download, ExternalLink, Search } from 'lucide-react';
import type { EvidenceFile } from '../../contract';
import { FileTypeBadge } from '../status-chip';
import { PathLink } from '../path-link';
import { DiffTextView, ImageView, JsonView, MarkdownView, TextView, VideoView, YamlView } from './renderers';
import { encodingNotes, formatBytes, isPlainEncoding, shortSha } from './format';
import { TEXT_KINDS, useBlobText, type BlobText } from './use-blob-text';
import type { Concept } from '../concept';

export const concept: Concept = 'C8';

const SEARCHABLE = new Set(['text', 'json', 'diff']);
const btn = 'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50';

function CopyButton({ value, label, disabled }: { value: string; label: string; disabled?: boolean }) {
  const [done, setDone] = useState(false);
  return <button type="button" className={btn} disabled={disabled} onClick={() => {
    void navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }, () => undefined);
  }}><Copy className="size-3.5" aria-hidden="true" />{done ? 'Đã chép' : label}</button>;
}

function Note({ children, tone }: { children: ReactNode; tone?: 'warning' | 'failed' }) {
  return <div className="rounded-md border border-border px-3 py-2 text-sm" data-tone={tone}
    style={tone ? { borderColor: 'var(--tone-line)', background: 'var(--tone-bg)' } : undefined}>{children}</div>;
}

function Body({ file, query, blob }: { file: EvidenceFile; query: string; blob: BlobText }) {
  if (file.kind === 'image') return <ImageView file={file} />;
  if (file.kind === 'video') return <VideoView file={file} />;
  if (file.kind === 'audio') return <audio src={file.href} controls preload="metadata" className="w-full" />;
  if (!TEXT_KINDS.has(file.kind)) {
    return <Note>{file.kind === 'pdf' ? 'Tệp PDF' : 'Tệp nhị phân'} ({formatBytes(file.bytes)}, {file.mediaType}) không xem trực tiếp được. <a className="underline" href={file.href} target="_blank" rel="noreferrer">Mở thô ↗</a></Note>;
  }
  if (blob.status === 'loading' || blob.status === 'idle') return <div className="animate-pulse space-y-2" role="status" aria-label="Đang tải">
    {[80, 60, 90, 45, 70].map((w, i) => <div key={i} className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />)}</div>;
  if (blob.status === 'error') return <Note tone="failed">Không tải được nội dung ({blob.error}). <a className="underline" href={file.href} target="_blank" rel="noreferrer">Mở thô ↗</a></Note>;
  if (blob.text.trim() === '') return <Note>Tệp rỗng (không có nội dung).</Note>;
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
    {blob.truncated ? <div className="mb-2"><Note tone="warning">Tệp lớn ({formatBytes(file.bytes)}) — chỉ hiện 2000 dòng đầu. <a className="underline" href={file.href} target="_blank" rel="noreferrer">Mở tệp thô đầy đủ ↗</a></Note></div> : null}
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
  const note = !isPlainEncoding(encoding) ? encodingNotes[encoding as string] : sourceEncoding && sourceEncoding !== 'utf-8' ? `${sourceEncoding} → đã giải mã` : null;
  const sha = useMemo(() => shortSha(file.sha), [file.sha]);
  return <section className="min-w-0 rounded-lg border bg-card" aria-label={`Xem ${file.name}`}>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <FileTypeBadge kind={file.kind} />
      <span className="min-w-0 flex-1 truncate font-medium" title={file.name}>{file.label ?? file.base}</span>
      <span className="text-xs text-muted-foreground">{formatBytes(file.bytes)}</span>
      {note ? <span className="rounded border border-border bg-muted px-1.5 text-xs">{note}</span> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      {canSearch ? <label className="relative flex min-w-40 flex-1 items-center">
        <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" aria-hidden="true" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trong nội dung"
          className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-sm" aria-label="Tìm trong nội dung" />
      </label> : <span className="flex-1" />}
      {TEXT_KINDS.has(file.kind) ? <CopyButton value={blob.text} label="Sao chép" disabled={blob.status !== 'ready'} /> : null}
      <a className={btn} href={file.href} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" aria-hidden="true" />Mở thô ↗</a>
      <a className={btn} href={`${file.href}?download=1`} download><Download className="size-3.5" aria-hidden="true" />Tải về</a>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">sha256 <code className="font-mono" title={file.sha}>{sha}</code><CopyButton value={file.sha} label="Chép" /></span>
      {file.redaction ? <span data-tone="warning" className="rounded border px-1.5" style={{ borderColor: 'var(--tone-line)', background: 'var(--tone-bg)' }} title="Máy chủ đã che thông tin nhạy cảm">Đã che: {file.redaction}</span> : null}
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1">Trên máy: <PathLink path={file.hostPath} kind="file" /></span>
    </div>
    <div className="max-h-[70vh] min-w-0 overflow-auto p-3"><Body file={file} query={query} blob={blob} /></div>
  </section>;
}
