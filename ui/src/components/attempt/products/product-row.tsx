import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ProductFile } from '../../../contract';
import type { Concept } from '../../concept';
import { DiffTextView, JsonView, MarkdownView, TextView, YamlView } from '../../evidence/renderers';
import { PathLink } from '../../path-link';
import type { Status } from '../../status';
import { FileTypeBadge, StatusChip } from '../../status-chip';
import { formatBytes } from '../frame/util';

export const concept: Concept = 'C8';

const statusView: Record<ProductFile['status'], { status: Status; label: string }> = {
  added: { status: 'success', label: 'thêm' }, modified: { status: 'running', label: 'sửa' }, deleted: { status: 'failed', label: 'xoá' },
  unchanged: { status: 'queued', label: 'không đổi' }, missing: { status: 'retry', label: 'không đọc được' },
};

function Content({ file }: { file: ProductFile }) {
  if (file.content == null) {
    return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{file.error ?? (file.status === 'deleted' ? 'Tệp đã bị xoá ở commit này nên không còn nội dung.' : 'Máy chủ chưa gửi nội dung tệp này. Xem tab "Thay đổi" để biết op đã sửa gì.')}</p>;
  }
  return <div className="min-w-0">
    {file.truncated ? <p className="mb-2 text-xs text-muted-foreground">Tệp lớn: chỉ hiện phần đầu.</p> : null}
    {file.kind === 'yaml' ? <YamlView text={file.content} /> : file.kind === 'json' ? <JsonView text={file.content} /> : file.kind === 'markdown' ? <MarkdownView text={file.content} /> : <TextView text={file.content} query="" />}
  </div>;
}

function Diff({ file }: { file: ProductFile }) {
  if (!file.diff) return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{file.status === 'unchanged' ? 'Tệp này không đổi so với commit cha.' : 'Không có bản so sánh cho tệp này.'}</p>;
  return <div className="min-w-0">{file.diffTruncated ? <p className="mb-2 text-xs text-muted-foreground">Diff dài: chỉ hiện phần đầu.</p> : null}<DiffTextView text={file.diff} /></div>;
}

/** One file the op wrote to the repo: status, path, size; opens into content and diff tabs. */
export function ProductRow({ file, defaultOpen = false, extra }: { file: ProductFile; defaultOpen?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<'content' | 'diff'>(file.content == null && file.diff ? 'diff' : 'content');
  const view = statusView[file.status];
  const id = `product-${file.path.replace(/[^\w-]/g, '_')}`;
  return <li className="min-w-0 py-2 first:pt-0 last:pb-0">
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" title={open ? 'Thu gọn' : 'Mở nội dung'}>
        <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>
      <StatusChip status={view.status} label={view.label} />
      <span className="min-w-0 max-w-full flex-1 break-all text-sm">{file.hostPath ? <PathLink path={file.hostPath} kind="file" label={file.path} /> : <code className="font-mono text-xs">{file.path}</code>}</span>
      <FileTypeBadge kind={file.kind} />
      <span className="text-xs tabular-nums text-muted-foreground">{file.bytes == null ? '—' : formatBytes(file.bytes)}</span>
      {extra}
    </div>
    {open ? <div id={id} className="mt-2 min-w-0 sm:pl-8">
      <div role="tablist" aria-label="Xem tệp" className="mb-2 flex gap-1 text-sm">
        {([['content', 'Nội dung'], ['diff', 'Thay đổi']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${tab === key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}>{label}</button>)}
      </div>
      {tab === 'content' ? <Content file={file} /> : <Diff file={file} />}
    </div> : null}
  </li>;
}
