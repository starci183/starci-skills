import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApiQuery } from '../../../api/query';
import type { AttemptDetailV2, LegRow, PipelineView } from '../../../contract';
import { StatusChip } from '../../status-chip';
import { statusFromOutcome } from '../../status';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { legInfo } from '../pipeline/node/op-identity';

export const concept: Concept = 'C4';

const outcomeLabel: Record<string, string> = { done: 'Op báo xong', partial: 'Op báo một phần', failed: 'Op báo hỏng', ask: 'Op hỏi lại', blocked: 'Op báo bị chặn' };
const fmt = (n: number) => n.toLocaleString('vi-VN');

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-4 first:mt-0"><h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}
const muted = (text: string) => <p className="text-xs text-muted-foreground">{text}</p>;

/** Token total across the leg's attempts, or null when none recorded any. */
export function legTokens(leg: LegRow): { input: number; output: number } | null {
  let input = 0; let output = 0; let seen = false;
  for (const a of leg.attempts) {
    if (a.tokensIn != null) { input += a.tokensIn; seen = true; }
    if (a.tokensOut != null) { output += a.tokensOut; seen = true; }
  }
  return seen ? { input, output } : null;
}

/** Op story in owner order: what it does, input, output, tokens. Reads the latest attempt for the real hand-over. */
export function LegStory({ project, leg, pipeline }: { project: string; leg: LegRow; pipeline: PipelineView }) {
  const info = legInfo(leg);
  const [en, setEn] = useState(false);
  const latest = [...leg.attempts].sort((a, b) => b.id - a.id)[0] ?? null;
  const detail = useApiQuery<AttemptDetailV2>(latest ? `/api/attempts/${encodeURIComponent(project)}/${latest.id}` : '/api/attempts/none', { enabled: Boolean(latest), intervalMs: 60_000 });
  const attempt = latest ? detail.data : null;
  const files = attempt?.report?.json && typeof attempt.report.json === 'object' ? (attempt.report.json as { files?: unknown }).files : undefined;
  const fileCount = Array.isArray(files) ? files.length : null;
  const byOp = new Map(pipeline.legs.map(l => [l.op, l]));
  const upstream = pipeline.edges.filter(e => e.to === leg.op).map(e => e.from);
  const downstream = pipeline.edges.filter(e => e.from === leg.op).map(e => e.to);
  const chip = (op: string) => <li key={op} className="flex flex-wrap items-center gap-2 text-sm"><StatusChip status={byOp.get(op)?.status ?? 'unknown'} /><span className="min-w-0 break-all font-mono text-xs">{op}</span></li>;
  const goal = info?.goal.vi ?? info?.goal.en ?? null;
  const tokens = legTokens(leg);
  const input = attempt?.input ?? null;
  const reads = info?.reads ?? [];
  return <div>
    <Block title="Op này làm gì">
      <p className="text-sm">{goal ?? 'Chưa có mô tả cho op này.'}</p>
      {info?.goal.en && info.goal.vi ? <div className="mt-1">
        <button type="button" className="text-xs font-medium text-primary hover:underline" aria-expanded={en} onClick={() => setEn(v => !v)}>{en ? 'Ẩn bản gốc tiếng Anh' : 'Xem bản gốc tiếng Anh'}</button>
        {en ? <p className="mt-1 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">{info.goal.en}</p> : null}
      </div> : null}
      {info?.sideEffects.length ? <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{info.sideEffects.map(e => <li key={e}>{e}</li>)}</ul> : null}
    </Block>
    <Block title="Đầu vào">
      {reads.length ? <ul className="space-y-1.5">{reads.map(r => <li key={r.id} className="text-xs"><span className="font-mono font-semibold">{r.id}</span>{r.purpose ? <span className="block text-muted-foreground">{r.purpose}</span> : null}</li>)}</ul> : muted('Op không khai báo dữ liệu đọc.')}
      {upstream.length ? <div className="mt-2"><p className="mb-1 text-[11px] text-muted-foreground">Chờ các op</p><ul className="space-y-1">{upstream.map(chip)}</ul></div> : null}
      {leg.needs.length ? <ul className="mt-2 space-y-0.5">{leg.needs.map(n => <li key={n} className="break-all font-mono text-[11px] text-muted-foreground">{n}</li>)}</ul> : null}
      <div className="mt-2 rounded-md border bg-muted/20 p-2 text-xs">
        <p className="mb-1 font-medium">Kernel giao cho mỗi đơn vị{latest ? ` (lần thử #${latest.id})` : ''}</p>
        {input ? <ul className="space-y-1 text-muted-foreground">
          {input.what ? <li className="break-words">{input.what}</li> : null}
          {input.goal ? <li>Mục tiêu workflow, bản {input.goal.revision}</li> : null}
          <li>{input.ownedPaths.length} đường dẫn được sửa{input.ownedPaths.length ? ':' : ''}</li>
          {input.ownedPaths.length ? <li><ul className="ml-2 space-y-0.5">{input.ownedPaths.slice(0, 6).map(p => <li key={p} className="break-all font-mono text-[11px]">{p}</li>)}{input.ownedPaths.length > 6 ? <li>… và {input.ownedPaths.length - 6} đường dẫn nữa</li> : null}</ul></li> : null}
          {input.records.length ? <li>{input.records.length} bản ghi đính kèm</li> : null}
        </ul> : <p className="text-muted-foreground">{latest ? (detail.loading ? 'Đang đọc…' : 'Chưa đọc được dữ liệu giao.') : 'Chưa có lần thử nào, chưa giao gì.'}</p>}
      </div>
    </Block>
    <Block title="Đầu ra">
      {leg.produces.length ? <ul className="space-y-1">{leg.produces.map(n => <li key={n} className="break-all font-mono text-xs">{n}</li>)}</ul> : muted('Không khai báo.')}
      {info?.writes.length ? <ul className="mt-1 space-y-0.5">{info.writes.map(w => <li key={w} className="break-all font-mono text-[11px] text-muted-foreground">{w}</li>)}</ul> : null}
      {latest ? <div className="mt-2 rounded-md border bg-muted/20 p-2 text-xs">
        <p className="mb-1 flex flex-wrap items-center gap-2 font-medium">Lần thử mới nhất #{latest.id}
          <StatusChip status={statusFromOutcome(latest.reportOutcome)} label={latest.reportOutcome ? outcomeLabel[latest.reportOutcome] : 'Op chưa báo'} /></p>
        {latest.summary ? <p className="line-clamp-4 whitespace-pre-wrap break-words">{latest.summary}</p> : null}
        <p className="mt-1 text-muted-foreground">{fileCount == null ? (detail.loading ? 'Đang đếm tệp…' : 'Chưa có báo cáo tệp.') : `${fileCount} tệp trong repo đã được ghi`}</p>
        <a href={`${latest.href}?step=report`} className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline">Xem Sản phẩm <ArrowRight className="size-3" aria-hidden="true" /></a>
      </div> : null}
      {downstream.length ? <div className="mt-2"><p className="mb-1 text-[11px] text-muted-foreground">Mở khoá</p><ul className="space-y-1">{downstream.map(chip)}</ul></div> : null}
    </Block>
    <Block title="Token">
      {tokens ? <p className="font-mono text-sm">{fmt(tokens.input)} vào · {fmt(tokens.output)} ra <span className="font-sans text-xs text-muted-foreground">({leg.attempts.length} lần thử)</span></p> : muted('chưa ghi nhận')}
    </Block>
    {leg.conditions.length ? <details className="mt-4"><summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Điều kiện · {leg.conditions.length}</summary>
      <ul className="mt-1 space-y-1">{leg.conditions.map(n => <li key={n} className="break-words text-xs">{n}</li>)}</ul></details> : null}
    {info?.manifest ? <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">Khai báo op <PathLink path={info.manifest} kind="file" /></p> : null}
  </div>;
}
