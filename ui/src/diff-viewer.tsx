import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Columns2, FileCode2, Folder, GitCommitHorizontal, Rows3, TriangleAlert } from 'lucide-react';
import type { DiffFile, DiffHunk, DiffLine, JobDiff } from './types';
import { highlightLine } from './highlight';

// A job's diff from /api/diff (the pre-structured <patch>.json of scripts/kernel/patch-json.mjs): a file tree, one
// file at a time in unified or split view with syntax highlighting, image before/after, and the landed/unlanded sha.

const en = () => document.documentElement.lang === 'en';
const t = (vi: string, english: string) => (en() ? english : vi);
const STATUS: Record<DiffFile['status'], { label: string; tone: string }> = {
  A: { label: 'A', tone: 'text-emerald-400' }, M: { label: 'M', tone: 'text-amber-400' }, D: { label: 'D', tone: 'text-red-400' }, R: { label: 'R', tone: 'text-sky-400' },
};
const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 10) : '—');

type Tree = { name: string; path: string; dirs: Map<string, Tree>; files: DiffFile[] };
function treeOf(files: DiffFile[]): Tree {
  const root: Tree = { name: '', path: '', dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path: node.path ? `${node.path}/${part}` : part, dirs: new Map(), files: [] });
      node = node.dirs.get(part)!;
    }
    node.files.push(file);
  }
  // A directory with one child directory and no files folds into it (a/b/c), as code review tools show it.
  const fold = (node: Tree): Tree => {
    for (const [key, child] of node.dirs) node.dirs.set(key, fold(child));
    if (node.path && node.files.length === 0 && node.dirs.size === 1) {
      const only = [...node.dirs.values()][0];
      return { ...only, name: `${node.name}/${only.name}` };
    }
    return node;
  };
  return fold(root);
}

function TreeView({ node, selected, onPick, depth = 0 }: { node: Tree; selected: string | null; onPick: (path: string) => void; depth?: number }) {
  return <ul className={depth ? 'pl-3' : ''}>
    {[...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)).map((dir) => <li key={dir.path}>
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-500/10"><ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" /><Folder className="size-3 shrink-0 text-zinc-500" /><span className="truncate">{dir.name}</span></summary>
        <TreeView node={dir} selected={selected} onPick={onPick} depth={depth + 1} />
      </details>
    </li>)}
    {node.files.sort((a, b) => a.path.localeCompare(b.path)).map((file) => <li key={file.path}>
      <button type="button" onClick={() => onPick(file.path)} title={file.path} data-testid="diff-tree-file"
        className={`flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] ${selected === file.path ? 'bg-sky-500/15 text-sky-300' : 'text-zinc-300 hover:bg-zinc-500/10'}`}>
        <span className={`w-3 shrink-0 font-mono text-[10px] font-bold ${STATUS[file.status].tone}`}>{STATUS[file.status].label}</span>
        <span className="min-w-0 flex-1 truncate">{file.path.split('/').pop()}</span>
        {!file.binary && <span className="shrink-0 font-mono text-[10px]"><span className="text-emerald-400">+{file.added}</span> <span className="text-red-400">−{file.removed}</span></span>}
      </button>
    </li>)}
  </ul>;
}

const gutter = 'select-none px-2 text-right font-mono text-[10.5px] tabular-nums text-zinc-600';
const rowTone = (t: DiffLine['t']) => (t === '+' ? 'diff-add' : t === '-' ? 'diff-del' : '');

function Unified({ hunk, language }: { hunk: DiffHunk; language: string }) {
  return <>{hunk.lines.map((line, i) => <tr key={i} className={rowTone(line.t)}>
    <td className={`${gutter} ${line.t === '-' ? 'diff-del-gutter' : line.t === '+' ? 'diff-add-gutter' : ''}`}>{line.o ?? ''}</td>
    <td className={`${gutter} ${line.t === '-' ? 'diff-del-gutter' : line.t === '+' ? 'diff-add-gutter' : ''}`}>{line.n ?? ''}</td>
    <td className={`w-4 select-none text-center font-mono text-[11px] ${line.t === '+' ? 'text-emerald-400' : line.t === '-' ? 'text-red-400' : 'text-zinc-700'}`}>{line.t === ' ' ? '' : line.t === '-' ? '−' : '+'}</td>
    <td className="whitespace-pre pr-4 font-mono text-[11px] leading-5 text-zinc-200">{highlightLine(line.s, language) || ' '}</td>
  </tr>)}</>;
}

/** Pairs a run of removed lines with the run of added lines after it, so split view lines them up side by side. */
export function splitRows(lines: DiffLine[]): [DiffLine | null, DiffLine | null][] {
  const out: [DiffLine | null, DiffLine | null][] = [];
  for (let i = 0; i < lines.length;) {
    if (lines[i].t === ' ') { out.push([lines[i], lines[i]]); i += 1; continue; }
    const del: DiffLine[] = [], add: DiffLine[] = [];
    while (i < lines.length && lines[i].t === '-') del.push(lines[i++]);
    while (i < lines.length && lines[i].t === '+') add.push(lines[i++]);
    for (let k = 0; k < Math.max(del.length, add.length); k++) out.push([del[k] ?? null, add[k] ?? null]);
  }
  return out;
}

function Split({ hunk, language }: { hunk: DiffHunk; language: string }) {
  return <>{splitRows(hunk.lines).map(([left, right], i) => <tr key={i}>
    <td className={`${gutter} ${left?.t === '-' ? 'diff-del-gutter' : ''}`}>{left?.o ?? ''}</td>
    <td className={`whitespace-pre-wrap break-all border-r border-zinc-800 pr-3 font-mono text-[11px] leading-5 text-zinc-200 ${left?.t === '-' ? 'diff-del' : ''}`}>{left ? highlightLine(left.s, language) || ' ' : ''}</td>
    <td className={`${gutter} ${right?.t === '+' ? 'diff-add-gutter' : ''}`}>{right?.n ?? ''}</td>
    <td className={`whitespace-pre-wrap break-all pr-3 font-mono text-[11px] leading-5 text-zinc-200 ${right?.t === '+' ? 'diff-add' : ''}`}>{right ? highlightLine(right.s, language) || ' ' : ''}</td>
  </tr>)}</>;
}

function ImageSides({ file, assetUrl }: { file: DiffFile; assetUrl: (blob: string) => string }) {
  const sides = [['before', t('Trước', 'Before'), file.before], ['after', t('Sau', 'After'), file.after]] as const;
  return <div className="grid gap-3 p-3 sm:grid-cols-2" data-testid="diff-image">
    {sides.map(([key, label, side]) => <figure key={key} className="flex flex-col overflow-hidden rounded-md border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px]">
      <figcaption className="border-b border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-500">{label}{side ? ` · ${side.blob.slice(0, 8)}` : ''}</figcaption>
      {side ? <a href={assetUrl(side.blob)} target="_blank" rel="noreferrer"><img src={assetUrl(side.blob)} alt={`${label} ${file.path}`} loading="lazy" className="max-h-80 w-full object-contain" /></a>
        : <div className="flex min-h-28 flex-1 items-center justify-center bg-zinc-950 text-[11px] text-zinc-600">{key === 'before' ? t('Tệp mới', 'New file') : t('Đã xoá', 'Deleted')}</div>}
    </figure>)}
  </div>;
}

function FileDiff({ file, split, assetUrl }: { file: DiffFile; split: boolean; assetUrl: (blob: string) => string }) {
  return <div className="min-w-0 rounded-md border border-zinc-800" data-testid="diff-file">
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-[11px]">
      <span className={`font-mono font-bold ${STATUS[file.status].tone}`}>{STATUS[file.status].label}</span>
      <span className="min-w-0 flex-1 break-all font-mono text-zinc-200">{file.oldPath ? <><span className="text-zinc-500">{file.oldPath} → </span>{file.path}</> : file.path}</span>
      {!file.binary && <span className="font-mono"><span className="text-emerald-400">+{file.added}</span> <span className="text-red-400">−{file.removed}</span></span>}
      {!file.binary && <span className="text-zinc-500">{file.language}</span>}
      {file.touches > 1 && <span className="text-zinc-500">{file.touches} commit</span>}
    </div>
    {file.image ? <ImageSides file={file} assetUrl={assetUrl} />
      : file.binary ? <p className="p-3 text-xs text-zinc-500">{t('Tệp nhị phân — không hiển thị nội dung.', 'Binary file — content not shown.')}</p>
        : !file.hunks.length ? <p className="p-3 text-xs text-zinc-500">{file.status === 'R' ? t('Chỉ đổi tên, nội dung giữ nguyên.', 'Renamed only; content unchanged.') : t('Không có dòng thay đổi.', 'No changed lines.')}</p>
          : <div className="overflow-x-auto"><table className={`w-full border-collapse ${split ? 'table-fixed' : ''}`}>
            {split ? <colgroup><col className="w-12" /><col /><col className="w-12" /><col /></colgroup> : null}
            <tbody>{file.hunks.map((hunk, i) => <Fragment key={i}>
              <tr className="bg-sky-500/5"><td colSpan={split ? 4 : 4} className="px-3 py-1 font-mono text-[10.5px] text-sky-400">{hunk.header}</td></tr>
              {split ? <Split hunk={hunk} language={file.language} /> : <Unified hunk={hunk} language={file.language} />}
            </Fragment>)}</tbody>
          </table></div>}
    {file.truncated && <p className="flex items-center gap-1.5 border-t border-zinc-800 px-3 py-1.5 text-[11px] text-amber-400"><TriangleAlert className="size-3" />{t('Tệp quá dài — phần sau đã được cắt; mở tệp .patch để xem đủ.', 'File too long — the rest was cut; open the .patch for all of it.')}</p>}
  </div>;
}

/**
 * The diff of one job. `focus` selects a file (a file.edit row opened it); `onMissing` fires when the job has no
 * indexed patch, so the caller can fall back to its older commit view.
 */
export function DiffViewer({ projectId, jobId, focus = null, onMissing }: { projectId: string; jobId: string; focus?: string | null; onMissing?: () => void }) {
  const [diff, setDiff] = useState<JobDiff | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [split, setSplit] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setDiff(null); setError('');
    fetch(`/api/diff?${new URLSearchParams({ project: projectId, job: jobId })}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => { if (response.status === 404) { onMissing?.(); return null; } if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<JobDiff>; })
      .then((body) => { if (body) { setDiff(body); setSelected((current) => current ?? body.files.find((f) => !f.binary)?.path ?? body.files[0]?.path ?? null); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, jobId]);
  useEffect(() => {
    if (!focus || !diff) return;
    const match = diff.files.find((f) => f.path === focus) ?? diff.files.find((f) => f.path.endsWith(focus.replace(/\\/g, '/')) || focus.replace(/\\/g, '/').endsWith(f.path));
    if (match) setSelected(match.path);
  }, [focus, diff]);
  const tree = useMemo(() => (diff ? treeOf(diff.files) : null), [diff]);
  const assetUrl = (blob: string) => `/api/diff/asset?${new URLSearchParams({ project: projectId, job: jobId, blob })}`;
  if (error) return <p className="text-xs text-red-400">{t('Không đọc được diff', 'Could not read the diff')}: {error}</p>;
  if (!diff) return <p className="text-xs text-zinc-500">{t('Đang đọc diff...', 'Reading the diff...')}</p>;
  if (diff.tooLarge) return <p className="text-xs text-amber-400">{t('Patch quá lớn để đọc trực tiếp; chờ backfill ghi bản .json.', 'The patch is too large to parse live; the backfill writes its .json.')}</p>;
  const file = diff.files.find((f) => f.path === selected) ?? null;
  return <section className="rounded-lg border border-zinc-800 bg-zinc-950/70" data-testid="diff-viewer">
    <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2 text-[11px]">
      <FileCode2 className="size-3.5 text-sky-400" />
      <strong className="text-xs text-zinc-200">Diff</strong>
      {diff.landed || diff.landedLater ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 font-mono text-emerald-400" title={diff.landed ?? `${diff.landedLater} (patch: head ${diff.head ?? '?'})`}><GitCommitHorizontal className="size-3" />{t('đã land', 'landed')} {short(diff.landed ?? diff.landedLater)}</span>
        : <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 font-mono text-amber-400" title={diff.head ?? ''}><GitCommitHorizontal className="size-3" />{t('chưa land', 'unlanded')} · head {short(diff.head)}</span>}
      <span className="font-mono text-zinc-500" title={diff.base ?? ''}>base {short(diff.base)}</span>
      <span className="text-zinc-500">{diff.totals.files} {t('tệp', 'files')} · <span className="text-emerald-400">+{diff.totals.added}</span> <span className="text-red-400">−{diff.totals.removed}</span></span>
      {diff.truncated && <span className="text-amber-400">{t('đã cắt bớt', 'truncated')}{diff.omittedFiles ? ` · ${diff.omittedFiles} ${t('tệp ẩn', 'files hidden')}` : ''}</span>}
      <div className="ml-auto inline-flex overflow-hidden rounded-md border border-zinc-800" role="group" aria-label={t('Kiểu hiển thị', 'View')}>
        <button type="button" onClick={() => setSplit(false)} aria-pressed={!split} className={`inline-flex items-center gap-1 px-2 py-1 ${!split ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`} data-testid="diff-unified"><Rows3 className="size-3" />Unified</button>
        <button type="button" onClick={() => setSplit(true)} aria-pressed={split} className={`inline-flex items-center gap-1 px-2 py-1 ${split ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`} data-testid="diff-split"><Columns2 className="size-3" />Split</button>
      </div>
    </header>
    {diff.commits.length > 0 && <div className="border-b border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-500">{diff.commits.slice(0, 5).map((c) => <div key={c.sha} className="truncate"><span className="font-mono text-zinc-600">{c.sha.slice(0, 8)}</span> {c.subject}</div>)}{diff.commits.length > 5 && <div>+{diff.commits.length - 5} commit</div>}</div>}
    <div className="grid min-w-0 gap-3 p-3 md:grid-cols-[minmax(190px,290px)_minmax(0,1fr)]">
      <nav className="max-h-[30vh] overflow-auto rounded-md border border-zinc-800 p-1 md:max-h-[65vh]" aria-label={t('Cây tệp', 'File tree')}>{tree && <TreeView node={tree} selected={selected} onPick={setSelected} />}</nav>
      <div className="min-w-0">{file ? <FileDiff file={file} split={split} assetUrl={assetUrl} /> : <p className="text-xs text-zinc-500">{t('Chọn một tệp.', 'Pick a file.')}</p>}</div>
    </div>
  </section>;
}
