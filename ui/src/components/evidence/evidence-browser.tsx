import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Info, Star } from 'lucide-react';
import type { EvidenceFile, EvidenceFileV3, EvidenceGroup } from '../../contract';
import type { Concept } from '../concept';
import { FileTypeBadge, StatusChip } from '../status-chip';
import { statusFromCheck, statusFromUi } from '../status';
import { EvidenceViewer } from './evidence-viewer';
import { encodingLabels, formatBytes, isPlainEncoding } from './format';

export { useBlobText } from './use-blob-text';
export const concept: Concept = 'C8';

const GROUPS: { id: EvidenceGroup; title: string; hint: string; tip?: string }[] = [
  { id: 'evidence', title: 'Bằng chứng op nộp (`evidence/`)', hint: 'Tệp op tự viết ra để chứng minh kết quả.', tip: 'evidence/ là thư mục bằng chứng của op; lần thử cũ ghi là E/' },
  { id: 'op-run', title: 'Kết quả lệnh op tự chạy', hint: 'Output của các lệnh op chạy trong lúc làm việc.' },
  { id: 'check', title: 'Output của check', hint: 'Stdout/stderr của từng check, nhóm theo tên check.' },
  { id: 'media', title: 'Ảnh & video', hint: 'Ảnh chụp màn hình và video ghi lại.' },
  { id: 'diff', title: 'Diff', hint: 'Thay đổi mã nguồn của lần thử.' },
  { id: 'log', title: 'Nhật ký', hint: 'Log của terminal và tiến trình.' },
  { id: 'other', title: 'Khác', hint: 'Tệp không thuộc nhóm nào ở trên.' },
];

const UNKNOWN_CHECK = '(không rõ check)';
const checkFailed = (file: EvidenceFile) => file.check?.ui === 'bad' || file.check?.status === 'fail' || file.check?.status === 'error';

/** Default = first failing check output, else first evidence file, else the first file. */
export function defaultEvidence(files: EvidenceFile[]): EvidenceFile | null {
  return files.find(f => f.group === 'check' && checkFailed(f)) ?? files.find(f => f.group === 'evidence') ?? files[0] ?? null;
}

const KEY_BASES = new Set(['manifest.yaml', 'result.md', 'scope-evidence.json', 'work-graph.json', 'report.json']);
const v3 = (file: EvidenceFile) => file as Partial<EvidenceFileV3>;
const isEmpty = (file: EvidenceFile) => v3(file).empty ?? file.bytes === 0;
const isKey = (file: EvidenceFile) => v3(file).key ?? KEY_BASES.has(file.base);
const fileName = (file: EvidenceFile) => file.label ?? file.base;

/** Prefer server dupOf/empty/key; otherwise dedupe by sha and treat 0 bytes as empty. */
export function organise(files: EvidenceFile[]) {
  const byId = new Map(files.map(f => [f.artifactId, f]));
  const firstBySha = new Map<string, EvidenceFile>();
  const dupOf = new Map<number, number>();
  const empty: EvidenceFile[] = [];
  for (const f of files) {
    if (isEmpty(f)) { empty.push(f); continue; }
    const served = v3(f).dupOf;
    if (served != null && byId.has(served)) { dupOf.set(f.artifactId, served); continue; }
    const first = firstBySha.get(f.sha);
    if (first && v3(f).dupOf === undefined) dupOf.set(f.artifactId, first.artifactId);
    else if (!first) firstBySha.set(f.sha, f);
  }
  const also = new Map<number, EvidenceFile[]>();
  for (const [dup, orig] of dupOf) { const list = also.get(orig) ?? []; list.push(byId.get(dup) as EvidenceFile); also.set(orig, list); }
  const visible = files.filter(f => !dupOf.has(f.artifactId) && !isEmpty(f));
  return { visible, empty, also, hidden: dupOf.size };
}
const keyFirst = (list: EvidenceFile[]) => [...list.filter(isKey), ...list.filter(f => !isKey(f))];

function Row({ file, active, onPick, also }: { file: EvidenceFile; active: boolean; onPick: () => void; also?: EvidenceFile[] }) {
  return <button type="button" role="option" aria-selected={active} onClick={onPick}
    className={`flex w-full min-w-0 flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left text-sm ${active ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}>
    <span className="flex min-w-0 items-center gap-2">
      <FileTypeBadge kind={file.kind} />
      {isKey(file) ? <Star className="size-3 shrink-0 fill-current text-[var(--status-retry,currentColor)]" aria-label="Tệp chính" /> : null}
      <span className="min-w-0 flex-1 truncate font-medium" title={file.label ?? file.base}>{file.label ?? file.base}</span>
    </span>
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.bytes)}</span>
      {!isPlainEncoding(file.encoding) ? <span className="shrink-0 rounded border border-border bg-muted px-1 text-[10.5px]">{encodingLabels[file.encoding as string] ?? file.encoding}</span> : null}
    </span>
    <span className="truncate font-mono text-[11px] text-muted-foreground" title={file.name}>{file.name}</span>
    {also?.length ? <span className="truncate text-[11px] text-muted-foreground" title={also.map(fileName).join(', ')}>cũng là: {also.map(fileName).join(', ')}</span> : null}
  </button>;
}

function Thumb({ file, active, onPick }: { file: EvidenceFile; active: boolean; onPick: () => void }) {
  return <button type="button" role="option" aria-selected={active} onClick={onPick} title={file.name}
    className={`flex min-w-0 flex-col gap-1 rounded-md border p-1 text-left ${active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
    <span className="flex aspect-video items-center justify-center overflow-hidden rounded bg-muted">
      {file.kind === 'image' ? <img src={file.href} alt={file.name} loading="lazy" className="size-full object-cover" />
        : file.kind === 'video' ? <video src={`${file.href}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
        : <FileTypeBadge kind={file.kind} />}
    </span>
    <span className="flex items-center gap-1"><FileTypeBadge kind={file.kind} /><span className="truncate text-[11px]">{file.label ?? file.base}</span></span>
  </button>;
}

/** Grouped file tree (left) + type-aware viewer frame (right); stacked on mobile. */
export function EvidenceBrowser({ files, selected, onSelect }: { files: EvidenceFile[]; selected: number | null; onSelect: (artifactId: number) => void }) {
  const current = useMemo(() => files.find(f => f.artifactId === selected) ?? defaultEvidence(files), [files, selected]);
  const listRef = useRef<HTMLDivElement>(null);
  const org = useMemo(() => organise(files), [files]);
  const [showEmpty, setShowEmpty] = useState(false);
  const order = useMemo(() => [...GROUPS.flatMap(g => keyFirst(org.visible.filter(f => f.group === g.id))), ...(showEmpty ? org.empty : [])], [org, showEmpty]);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if ((event.target as HTMLElement).closest('input,textarea')) return;
    event.preventDefault();
    const index = order.findIndex(f => f.artifactId === current?.artifactId);
    const next = order[Math.max(0, Math.min(order.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
    if (next) onSelect(next.artifactId);
  }, [order, current, onSelect]);
  useEffect(() => {
    const box = listRef.current;
    const row = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !row) return;
    // Scroll only inside the tree container, never the window.
    const b = box.getBoundingClientRect(); const r = row.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [current?.artifactId]);

  if (files.length === 0) return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Lần thử này chưa có tệp bằng chứng nào.</div>;

  return <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]" onKeyDown={onKeyDown}>
    <div ref={listRef} role="listbox" aria-label="Tệp bằng chứng" tabIndex={0} className="max-h-[70vh] min-w-0 space-y-4 overflow-auto rounded-lg border bg-card p-2">
      {GROUPS.map(group => {
        const inGroup = keyFirst(org.visible.filter(f => f.group === group.id));
        if (inGroup.length === 0) return null;
        const pick = (f: EvidenceFile) => () => onSelect(f.artifactId);
        const active = (f: EvidenceFile) => f.artifactId === current?.artifactId;
        return <section key={group.id} aria-label={group.title}>
          <h3 className="flex items-center gap-1.5 px-1 text-sm font-semibold">
            {group.title}
            {group.tip ? <span title={group.tip} aria-label={group.tip} className="inline-flex text-muted-foreground"><Info className="size-3.5" aria-hidden="true" /></span> : null}
            <span className="ml-auto text-xs font-normal text-muted-foreground">{inGroup.length}</span>
          </h3>
          <p className="px-1 pb-1 text-xs text-muted-foreground">{group.hint}</p>
          {group.id === 'media' ? <div className="grid grid-cols-2 gap-2">{inGroup.map(f => <Thumb key={f.artifactId} file={f} active={active(f)} onPick={pick(f)} />)}</div>
            : group.id === 'check' ? [...new Set(inGroup.map(f => f.check?.name ?? UNKNOWN_CHECK))].map(name => {
              const rows = inGroup.filter(f => (f.check?.name ?? UNKNOWN_CHECK) === name);
              const meta = rows[0]?.check;
              return <div key={name} className="mt-1">
                <div className="flex items-center gap-2 px-1 py-0.5"><code className="min-w-0 flex-1 truncate text-xs font-semibold" title={name}>{name}</code>
                  {meta ? <StatusChip status={meta.status ? statusFromCheck(meta.status) : statusFromUi(meta.ui)} /> : null}</div>
                <div className="space-y-0.5 pl-2">{rows.map(f => <Row key={f.artifactId} file={f} active={active(f)} onPick={pick(f)} also={org.also.get(f.artifactId)} />)}</div>
              </div>;
            })
            : <div className="space-y-0.5">{inGroup.map(f => <Row key={f.artifactId} file={f} active={active(f)} onPick={pick(f)} also={org.also.get(f.artifactId)} />)}</div>}
        </section>;
      })}
      {org.empty.length ? <section aria-label="Tệp rỗng">
        <button type="button" aria-expanded={showEmpty} onClick={() => setShowEmpty(v => !v)} className="w-full rounded-md border border-dashed px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted">{org.empty.length} tệp rỗng {showEmpty ? '· ẩn' : '· xem'}</button>
        {showEmpty ? <div className="mt-1 space-y-0.5">{org.empty.map(f => <Row key={f.artifactId} file={f} active={f.artifactId === current?.artifactId} onPick={() => onSelect(f.artifactId)} />)}</div> : null}
      </section> : null}
    </div>
    {current ? <EvidenceViewer key={current.artifactId} file={current} /> : null}
  </div>;
}
