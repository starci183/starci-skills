// decisions.tsx — Decision Items (DESIGN §10.3, scripts/reconciler/decisions.mjs) as the owner reads them: what is
// asked, of whom, since when, who claimed it and how it ended. Read-only; the deciders act through `api decisions`.
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

export interface DecisionView {
  id: string; kind: string; decider: 'kernel' | 'supervisor' | 'owner' | string; status: string; ledger: string; workflowId: string | null; projectId?: string;
  summary: string; entity: { type: string; id: string } | null; openedBy: string | null; openedAt: number | null; dueAt: number | null; escalations: number; severity: string | null;
  claim: { by: string; at: number } | null; resolution: { by: string; verb: string; at: number } | null; options: { key: string; recommended: boolean }[];
}

/** Notices a decider only acknowledges (a Supervisor ruling, a runtime rev): hidden from the lists by default. */
export const NOTICE_KINDS: string[] = ['supervisor-ruling', 'rev-ack'];

export const deciderName: Record<string, string> = { kernel: 'Kernel', supervisor: 'Supervisor', owner: 'Thầy' };
const statusView: Record<string, { name: string; tone: string }> = {
  open: { name: 'Đang mở', tone: 'border-amber-500/30 text-amber-400' },
  claimed: { name: 'Đã nhận xử lý', tone: 'border-sky-500/30 text-sky-400' },
  escalated: { name: 'Đã leo thang', tone: 'border-red-500/30 text-red-400' },
  resolved: { name: 'Đã quyết', tone: 'border-emerald-500/30 text-emerald-400' },
  superseded: { name: 'Bị thay thế', tone: 'border-zinc-700 text-zinc-500' },
  expired: { name: 'Hết hạn', tone: 'border-zinc-700 text-zinc-500' },
};

/** "5 phút trước" / "còn 12 phút": a relative time from `now`. */
export function ago(at: number | string | null | undefined, now = Date.now()): string {
  if (at == null || at === '') return '—';
  const t = typeof at === 'string' ? Date.parse(at) : at;
  if (!Number.isFinite(t)) return '—';
  const diff = now - t;
  const abs = Math.abs(diff);
  const text = abs < 45_000 ? 'vài giây' : abs < 3_600_000 ? `${Math.round(abs / 60_000)} phút` : abs < 86_400_000 ? `${Math.round(abs / 3_600_000 * 10) / 10} giờ` : `${Math.round(abs / 86_400_000)} ngày`;
  return diff >= 0 ? `${text} trước` : `còn ${text}`;
}
export const clock = (at: number | string | null | undefined) => {
  if (at == null) return '—';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(d);
};

export function DecisionList({ items, empty, showWorkflow = true }: { items: DecisionView[]; empty: string; showWorkflow?: boolean }) {
  const [notices, setNotices] = useState(false);
  const hidden = items.filter((d) => NOTICE_KINDS.includes(d.kind)).length;
  const shown = notices ? items : items.filter((d) => !NOTICE_KINDS.includes(d.kind));
  const toggle = hidden > 0 && <button type="button" onClick={() => setNotices((v) => !v)} className="mt-2 text-xs text-sky-400 hover:underline" aria-pressed={notices}>{notices ? 'Ẩn thông báo (supervisor-ruling)' : `Hiện ${hidden} thông báo (supervisor-ruling)`}</button>;
  if (!shown.length) return <div><p className="rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">{empty}</p>{toggle}</div>;
  const now = Date.now();
  return <div><ul className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">{shown.map((d) => {
    const st = statusView[d.status] ?? { name: d.status, tone: 'border-zinc-700 text-zinc-400' };
    const overdue = d.dueAt != null && d.dueAt < now && ['open', 'claimed', 'escalated'].includes(d.status);
    return <li key={`${d.ledger}:${d.id}`} className="space-y-1 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={st.tone}>{st.name}</Badge>
        <Badge variant="secondary">{deciderName[d.decider] ?? d.decider}</Badge>
        <span className="font-mono text-[11px] text-zinc-500">{d.kind}</span>
        {overdue && <Badge variant="outline" className="border-red-500/30 text-red-400">Quá hạn</Badge>}
        <span className="ml-auto text-[11px] text-zinc-500" title={clock(d.openedAt)}>mở {ago(d.openedAt, now)}</span>
      </div>
      <p className="break-words leading-6 text-zinc-200">{d.summary || '—'}</p>
      <p className="flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
        {showWorkflow && d.workflowId && <a className="hover:underline" href={`#/workflows/${encodeURIComponent(d.workflowId)}`}>{d.workflowId}</a>}
        {d.claim && <span>nhận bởi {d.claim.by} {ago(d.claim.at, now)}</span>}
        {d.resolution && <span>quyết: {d.resolution.verb} · {d.resolution.by} · {ago(d.resolution.at, now)}</span>}
        {d.dueAt && !d.resolution && <span>hạn {ago(d.dueAt, now)}</span>}
        {d.escalations > 0 && <span>leo thang ×{d.escalations}</span>}
        <span className="font-mono">{d.ledger} · {d.id}</span>
      </p>
    </li>;
  })}</ul>{toggle}</div>;
}
