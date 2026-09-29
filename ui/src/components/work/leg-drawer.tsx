import { ArrowRight } from 'lucide-react';
import type { LegRow, PipelineView } from '../../contract';
import { statusLabels, statusFromUnit } from '../status';
import { unitStateLabels } from '../../i18n/vi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { DrawerSlide } from '../drawer';
import { Advanced } from '../motion';
import { StatusChip } from '../status-chip';
import type { Concept } from '../concept';
import { AttemptCard } from './leg/attempt-card';
import { LegAbout, LegStory } from './leg/story';
import { legName, legAgents } from './pipeline/node/op-identity';
import { AgentStack } from '../agent/agent-avatar';

export const concept: Concept = 'C4';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}
const none = <p className="text-xs text-muted-foreground">Không có.</p>;
const oneLine = (text: string, n = 220) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Side drawer for one leg. Essentials: what it does, why it is (not) moving, the one next step. Everything else sits under "Nâng cao". */
export function LegDrawer({ project, wf, leg, pipeline, onClose }: { project: string; wf: string; leg: LegRow | null; pipeline: PipelineView; onClose: () => void }) {
  if (!leg) return null;
  const byOp = new Map(pipeline.legs.map(l => [l.op, l]));
  const upstream = pipeline.edges.filter(e => e.to === leg.op).map(e => e.from);
  const attempts = [...leg.attempts].sort((a, b) => b.id - a.id);
  const latest = attempts[0] ?? null;
  const now = Date.now();
  const waiting = upstream.filter(op => byOp.get(op)?.status !== 'success');
  const legHref = (op: string) => `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}?leg=${encodeURIComponent(op)}`;
  // "Vì sao dừng" / status line: the reason the leg is not simply running, else where it stands.
  const why = leg.deferred ? `Hoãn: ${leg.deferred}`
    : leg.status === 'external' ? 'Do bên ngoài xử lý.'
    : waiting.length && !leg.attempts.length ? `Chờ ${waiting.join(', ')} xong trước.`
    : latest?.summary && leg.status !== 'success' ? oneLine(latest.summary)
    : leg.current ? `Đang chạy${latest ? ` lần thử #${latest.id}` : ''}.`
    : latest?.summary ? oneLine(latest.summary)
    : `${statusLabels[leg.status]}.`;
  const next = leg.status === 'success' ? (leg.units[0] ? { href: leg.units[0].href, label: 'Xem kết quả đơn vị' } : latest ? { href: latest.href, label: 'Mở lần thử mới nhất' } : null)
    : latest && (latest.open || leg.status === 'failed' || leg.status === 'blocked' || leg.status === 'retry') ? { href: latest.href, label: `Mở lần thử #${latest.id}` }
    : waiting[0] ? { href: legHref(waiting[0]), label: `Xem chặng chờ: ${legName(byOp.get(waiting[0])!)}` }
    : latest ? { href: latest.href, label: 'Mở lần thử mới nhất' } : null;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="drawer-panel">
      <DrawerSlide>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2"><span className="text-base">{legName(leg)}</span><StatusChip status={leg.status} /></DialogTitle>
          <DialogDescription><span className="break-all font-mono text-xs">{leg.op}</span> · Chặng {leg.seq} · cấp {leg.level}{leg.current ? ' · đang chạy' : ''}{legAgents(leg).length ? <span className="ml-2 inline-flex align-middle"><AgentStack agents={legAgents(leg)} size={18} /></span> : null}</DialogDescription>
        </DialogHeader>
        <div className="drawer-body flex flex-col gap-6">
          <Section title="Làm gì"><LegAbout leg={leg} /></Section>
          <Section title={leg.status === 'success' ? 'Trạng thái' : 'Vì sao dừng'}><p className="text-sm">{why}</p></Section>
          <Section title="Việc tiếp">{next ? <a href={next.href} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">{next.label} <ArrowRight className="size-3.5" aria-hidden="true" /></a> : <p className="text-sm text-muted-foreground">Chưa có việc nào để làm tiếp.</p>}</Section>
          <Advanced summary={`đầu vào · đầu ra · ${leg.units.length} đơn vị · ${attempts.length} lần thử · token`}>
            <div className="flex flex-col gap-6">
              {(leg.injected || leg.deferred) && <div className="flex flex-col gap-1 rounded-lg border border-dashed p-3 text-xs">
                {leg.injected && <p><strong>injected:</strong> {leg.injected}</p>}
                {leg.deferred && <p><strong>deferred:</strong> {leg.deferred}</p>}
              </div>}
              <LegStory project={project} leg={leg} pipeline={pipeline} />
              <Section title={`Đơn vị · ${leg.units.length}`}>{leg.units.length ? <ul className="divide-y rounded-lg border">{leg.units.map(u => <li key={u.unit} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-3">
                <span className="min-w-0 flex-1 break-words text-sm">{u.title}</span>
                <StatusChip status={statusFromUnit(u.state)} label={unitStateLabels[u.state] ?? u.state} />
                <span className="text-xs text-muted-foreground">lần {u.tries}/{u.tryBudget}</span>
                <a href={u.href} className="inline-flex items-center text-primary" aria-label={`Mở ${u.title}`}><ArrowRight className="size-3.5" /></a>
              </li>)}</ul> : none}</Section>
              <Section title={`Lần thử · ${attempts.length}`}>{attempts.length
                ? <ol className="flex flex-col gap-2">{attempts.map(a => <AttemptCard key={a.id} attempt={a} now={now} />)}</ol>
                : <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Chưa có lần thử — chặng này chờ {waiting.length ? waiting.join(', ') : leg.deferred ? 'điều kiện hoãn được gỡ' : 'tới lượt điều phối'}.</p>}</Section>
            </div>
          </Advanced>
        </div>
      </DrawerSlide>
    </DialogContent>
  </Dialog>;
}
