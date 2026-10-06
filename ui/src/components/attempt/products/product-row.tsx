import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ProductFile } from '../../../contract';
import type { Concept } from '../../concept';
import { DiffTextView, JsonView, MarkdownView, TextView, YamlView } from '../../evidence/renderers';
import { PathLink } from '../../path-link';
import type { Status } from '../../status';
import { FileTypeBadge, StatusChip } from '../../status-chip';
import { formatBytes } from '../frame/util';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C8';

const statusView: Record<ProductFile['status'], { status: Status; label: string }> = {
  added: { status: 'success', label: t('added') }, modified: { status: 'running', label: t('modified') }, deleted: { status: 'failed', label: t('deleted') },
  unchanged: { status: 'queued', label: t('unchanged') }, missing: { status: 'retry', label: t('unreadable') },
};

function Content({ file }: Readonly<{ file: ProductFile }>) {
  if (file.content == null) {
    return <p className="rounded-lg border p-3 text-sm text-muted-foreground">{file.error ?? (file.status === 'deleted' ? t('The file was deleted in this commit, so it has no content.') : t('The server has not sent this file\'s content. See the "Changes" tab for what the op edited.'))}</p>;
  }
  return <div className="min-w-0">
    {file.truncated ? <p className="mb-2 text-xs text-muted-foreground">{t('Large file: only the beginning is shown.')}</p> : null}
    {file.kind === 'yaml' ? <YamlView text={file.content} /> : file.kind === 'json' ? <JsonView text={file.content} /> : file.kind === 'markdown' ? <MarkdownView text={file.content} /> : <TextView text={file.content} query="" />}
  </div>;
}

function Diff({ file }: Readonly<{ file: ProductFile }>) {
  if (!file.diff) return <p className="rounded-lg border p-3 text-sm text-muted-foreground">{file.status === 'unchanged' ? t('This file is unchanged from its parent commit.') : t('No comparison available for this file.')}</p>;
  return <div className="min-w-0">{file.diffTruncated ? <p className="mb-2 text-xs text-muted-foreground">{t('Long diff: only the beginning is shown.')}</p> : null}<DiffTextView text={file.diff} /></div>;
}

/** One file the op wrote to the repo: status, path, size; opens into content and diff tabs. */
export function ProductRow({ file, defaultOpen = false, extra }: Readonly<{ file: ProductFile; defaultOpen?: boolean; extra?: ReactNode }>) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<'content' | 'diff'>(file.content == null && file.diff ? 'diff' : 'content');
  const view = statusView[file.status];
  const id = `product-${file.path.replace(/[^\w-]/g, '_')}`;
  return <li className="min-w-0 py-2 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" title={open ? t('Collapse') : t('Show content')}>
        <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>
      <StatusChip status={view.status} label={view.label} />
      <span className="order-last min-w-0 basis-full break-all text-sm sm:order-none sm:flex-1 sm:basis-auto">{file.hostPath ? <PathLink path={file.hostPath} kind="file" label={file.path} /> : <code className="font-mono text-xs">{file.path}</code>}</span>
      <FileTypeBadge kind={file.kind} />
      <span className="text-xs tabular-nums text-muted-foreground">{file.bytes == null ? '—' : formatBytes(file.bytes)}</span>
      {extra}
    </div>
    {open ? <div id={id} className="mt-2 min-w-0 sm:pl-8">
      <div role="tablist" aria-label={t('View file')} className="mb-2 flex gap-1 text-sm">
        {([['content', t('Content')], ['diff', t('Changes')]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${tab === key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}>{label}</button>)}
      </div>
      {tab === 'content' ? <Content file={file} /> : <Diff file={file} />}
    </div> : null}
  </li>;
}
