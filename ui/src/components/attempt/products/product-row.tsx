import { useState, type ReactNode } from 'react';
import type { ProductFile } from '../../../contract';
import type { Concept } from '../../concept';
import { DiffTextView, JsonView, MarkdownView, TextView, YamlView } from '../../evidence/renderers';
import { PathLink } from '../../path-link';
import type { Status } from '../../status';
import { FileTypeBadge, StatusChip } from '../../status-chip';
import { formatBytes } from '../frame/util';
import { t } from '../../../i18n/t';
import { Tabs } from '../../ui/tabs';
import { Advanced } from '../../motion';
import { FeedbackState } from '../../feedback-state';

export const concept: Concept = 'C8';

const statusView: Record<ProductFile['status'], { status: Status; label: string }> = {
  added: { status: 'success', label: t('added') }, modified: { status: 'running', label: t('modified') }, deleted: { status: 'failed', label: t('deleted') },
  unchanged: { status: 'queued', label: t('unchanged') }, missing: { status: 'retry', label: t('unreadable') },
};

function Content({ file }: Readonly<{ file: ProductFile }>) {
  if (file.content == null) {
    return <FeedbackState error={Boolean(file.error)}>{file.error ?? (file.status === 'deleted' ? t('The file was deleted in this commit, so it has no content.') : t('The server has not sent this file\'s content. See the "Changes" tab for what the op edited.'))}</FeedbackState>;
  }
  return <div className="min-w-0">
    {file.truncated ? <p className="mb-2 text-xs text-muted-foreground">{t('Large file: only the beginning is shown.')}</p> : null}
    {file.kind === 'yaml' ? <YamlView text={file.content} /> : file.kind === 'json' ? <JsonView text={file.content} /> : file.kind === 'markdown' ? <MarkdownView text={file.content} /> : <TextView text={file.content} query="" />}
  </div>;
}

function Diff({ file }: Readonly<{ file: ProductFile }>) {
  if (!file.diff) return <FeedbackState>{file.status === 'unchanged' ? t('This file is unchanged from its parent commit.') : t('No comparison available for this file.')}</FeedbackState>;
  return <div className="min-w-0">{file.diffTruncated ? <p className="mb-2 text-xs text-muted-foreground">{t('Long diff: only the beginning is shown.')}</p> : null}<DiffTextView text={file.diff} /></div>;
}

/** One file the op wrote to the repo: status, path, size; opens into content and diff tabs. */
export function ProductRow({ file, defaultOpen = false, extra }: Readonly<{ file: ProductFile; defaultOpen?: boolean; extra?: ReactNode }>) {
  const [tab, setTab] = useState<'content' | 'diff'>(file.content == null && file.diff ? 'diff' : 'content');
  const view = statusView[file.status];
  return <li className="min-w-0 py-2 first:pt-0 last:pb-0">
    <Advanced defaultOpen={defaultOpen} title={<span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <StatusChip status={view.status} label={view.label} />
      <code className="order-last min-w-0 basis-full break-all font-mono text-xs leading-5 sm:order-none sm:flex-1 sm:basis-auto">{file.path}</code>
      <FileTypeBadge kind={file.kind} />
      <span className="text-xs font-normal tabular-nums text-muted-foreground">{file.bytes == null ? '—' : formatBytes(file.bytes)}</span>
    </span>}>
    <div className="grid min-w-0 gap-4">
      {file.hostPath || extra ? <div className="flex flex-wrap items-center gap-3">{file.hostPath ? <PathLink path={file.hostPath} kind="file" label={t('open path')} /> : null}{extra}</div> : null}
      <Tabs selectedKey={tab} onSelectionChange={key => setTab(key === 'diff' ? 'diff' : 'content')} variant="secondary" className="min-w-0 gap-4">
        <Tabs.List aria-label={t('View file')}>
          {([['content', t('Content')], ['diff', t('Changes')]] as const).map(([key, label]) => <Tabs.Tab key={key} id={key}>{label}<Tabs.Indicator /></Tabs.Tab>)}
        </Tabs.List>
        {tab === 'content' ? <Tabs.Panel id="content" className="min-w-0"><Content file={file} /></Tabs.Panel> : <Tabs.Panel id="diff" className="min-w-0"><Diff file={file} /></Tabs.Panel>}
      </Tabs>
    </div>
    </Advanced>
  </li>;
}
