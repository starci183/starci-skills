import { ArrowRight } from 'lucide-react';
import type { LegRow, PipelineView } from '../../contract';
import { unitStateLabels } from '../../i18n/vi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { StatusChip } from '../status-chip';
import { statusFromUnit } from '../status';
import type { Concept } from '../concept';
import { AttemptCard } from './leg/attempt-card';
import { OpAbout } from './leg/op-about';
import { legName } from './pipeline/node/op-identity';
import { AgentStack } from '../agent/agent-avatar';
import { legAgents } from './pipeline/node/op-identity';

export const concept: Concept = 'C4';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5 first:mt-0"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}
const none = <p className="text-xs text-muted-foreground">Không có.</p>;

/** Side drawer for one leg: needs/produces/edges, units, every attempt with outcome + verdict. */
export function LegDrawer({ project, wf, leg, pipeline, onClose }: { project: string; wf: string; leg: LegRow | null; pipeline: PipelineView; onClose: () => void }) {
  void project; void wf;
  if (!leg) return null;
  const byOp = new Map(pipeline.legs.map(l => [l.op, l]));
  const upstream = pipeline.edges.filter(e => e.to === leg.op).map(e => e.from);
  const downstream = pipeline.edges.filter(e => e.from === leg.op).map(e => e.to);
  const chip = (op: string) => <li key={op} className="flex flex-wrap items-center gap-2 text-sm"><StatusChip status={byOp.get(op)?.status ?? 'unknown'} /><span className="min-w-0 break-all font-mono text-xs">{op}</span></li>;
  const attempts = [...leg.attempts].sort((a, b) => b.id - a.id);
  const now = Date.now();
  const waiting = upstream.filter(op => byOp.get(op)?.status !== 'success');
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="drawer-panel">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2"><span className="text-base">{legName(leg)}</span><StatusChip status={leg.status} /></DialogTitle>
        <DialogDescription><span className="break-all font-mono text-xs">{leg.op}</span> · Chặng {leg.seq} · cấp {leg.level}{leg.current ? ' · đang chạy' : ''}{legAgents(leg).length ? <span className="ml-2 inline-flex align-middle"><AgentStack agents={legAgents(leg)} size={18} /></span> : null}</DialogDescription>
      </DialogHeader>
      <div className="drawer-body">
        {(leg.injected || leg.deferred) && <div className="mb-4 space-y-1.5 rounded-lg border border-dashed p-3 text-xs">
          {leg.injected && <p><strong>injected:</strong> {leg.injected}</p>}
          {leg.deferred && <p><strong>deferred:</strong> {leg.deferred}</p>}
        </div>}
        <OpAbout leg={leg} />
        <Section title="Cần trước">{upstream.length ? <ul className="space-y-1.5">{upstream.map(chip)}</ul> : none}
          {leg.needs.length > 0 && <ul className="mt-2 space-y-1">{leg.needs.map(n => <li key={n} className="break-all font-mono text-xs text-muted-foreground">{n}</li>)}</ul>}</Section>
        <Section title="Chặng này đáp ứng">{leg.produces.length ? <ul className="space-y-1">{leg.produces.map(n => <li key={n} className="break-all font-mono text-xs">{n}</li>)}</ul> : none}</Section>
        <Section title="Điều kiện">{leg.conditions.length ? <ul className="space-y-1">{leg.conditions.map(n => <li key={n} className="break-words text-xs">{n}</li>)}</ul> : none}</Section>
        <Section title="Mở khoá">{downstream.length ? <ul className="space-y-1.5">{downstream.map(chip)}</ul> : none}</Section>
        <Section title={`Đơn vị · ${leg.units.length}`}>{leg.units.length ? <ul className="divide-y rounded-lg border">{leg.units.map(u => <li key={u.unit} className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2.5">
          <span className="min-w-0 flex-1 break-words text-sm">{u.title}</span>
          <StatusChip status={statusFromUnit(u.state)} label={unitStateLabels[u.state] ?? u.state} />
          <span className="text-xs text-muted-foreground">lần {u.tries}/{u.tryBudget}</span>
          <a href={u.href} className="inline-flex items-center text-primary" aria-label={`Mở ${u.title}`}><ArrowRight className="size-3.5" /></a>
        </li>)}</ul> : none}</Section>
        <Section title={`Lần thử · ${attempts.length}`}>{attempts.length
          ? <ol className="space-y-2">{attempts.map(a => <AttemptCard key={a.id} attempt={a} now={now} />)}</ol>
          : <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Chưa có lần thử — chặng này chờ {waiting.length ? waiting.join(', ') : leg.deferred ? 'điều kiện hoãn được gỡ' : 'tới lượt điều phối'}.</p>}</Section>
      </div>
    </DialogContent>
  </Dialog>;
}
