import { ArrowRight } from 'lucide-react';
import { Link } from '@heroui/react';
import type { LegRow, PipelineView } from '../../contract';
import { statusLabels, statusFromUnit } from '../status';
import { unitStateLabels } from '../../i18n/vi';
import { Drawer } from '../drawer';
import { Advanced } from '../motion';
import { StatusChip } from '../status-chip';
import type { Concept } from '../concept';
import { AttemptCard } from './leg/attempt-card';
import { LegAbout, LegStory } from './leg/story';
import { legName, legAgents } from './pipeline/node/op-identity';
import { AgentStack } from '../agent/agent-avatar';
import { WhyBlock } from '../why/why-block';
import { t } from '../../i18n/t';

export const concept: Concept = 'C4';

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}
const none = <p className="text-xs text-muted-foreground">{t('None')}</p>;

/** Side drawer for one leg. Essentials: what it does, why it is (not) moving, the one next step. Everything else sits under "Advanced". */
export function LegDrawer({ project, wf, leg, pipeline, onClose }: Readonly<{ project: string; wf: string; leg: LegRow | null; pipeline: PipelineView; onClose: () => void }>) {
  if (!leg) return null;
  const byOp = new Map(pipeline.legs.map(l => [l.op, l]));
  const upstream = pipeline.edges.filter(e => e.to === leg.op).map(e => e.from);
  const attempts = [...leg.attempts].sort((a, b) => b.id - a.id);
  const latest = attempts[0] ?? null;
  const now = Date.now();
  const waiting = upstream.filter(op => byOp.get(op)?.status !== 'success');
  const legHref = (op: string) => `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}?leg=${encodeURIComponent(op)}`;
  // Recorded lifecycle and disposition remain separate from an Op's latest report summary.
  const why = leg.binding === 'unbound' ? t('No runtime unit is bound to this exact leg and goal revision.') : leg.deferred ? t('Deferred: {reason}', { reason: leg.deferred })
    : leg.status === 'external' ? t('Handled externally')
    : waiting.length && !leg.attempts.length ? t('Waiting for {list} to finish first.', { list: waiting.join(', ') })
    : leg.current ? (latest?.status === 'settling' ? t('Awaiting settlement') : latest?.open ? t('Running attempt #{id}.', { id: latest.id }) : statusLabels[leg.status])
    : `${statusLabels[leg.status]}.`;
  const next = leg.status === 'success' ? (leg.units[0] ? { href: leg.units[0].href, label: t('View the unit result') } : latest ? { href: latest.href, label: t('Open the latest attempt') } : null)
    : latest && (latest.open || leg.status === 'failed' || leg.status === 'blocked' || leg.status === 'retry') ? { href: latest.href, label: t('Open attempt #{id}', { id: latest.id }) }
    : waiting[0] ? { href: legHref(waiting[0]), label: t('View the waiting leg: {name}', { name: legName(byOp.get(waiting[0])!) }) }
    : latest ? { href: latest.href, label: t('Open the latest attempt') } : null;
  return <Drawer open onOpenChange={open => { if (!open) onClose(); }}
    title={<span className="flex flex-wrap items-center gap-2"><span className="text-base">{legName(leg)}</span><StatusChip status={leg.status} /></span>}
    description={<><span className="break-all font-mono text-xs">{leg.op}</span> · {t('Leg {seq} · level {level}', { seq: leg.seq, level: leg.level })}{legAgents(leg).length ? <span className="ml-2 inline-flex align-middle"><AgentStack agents={legAgents(leg)} size={18} /></span> : null}</>}>
        <div className="flex flex-col gap-5">
          <p className="text-xs text-muted-foreground">{leg.inPlan ? t('Goal revision {n}', { n: leg.goalRevision ?? '—' }) : t('Recorded operation history')} · {leg.binding === 'recorded-unit' ? t('Bound by recorded unit and revision') : leg.binding === 'unbound' ? t('Runtime association unproven') : t('Operation scope; excluded from plan progress')}</p>
          <Section title={t('What it does')}><LegAbout leg={leg} /></Section>
          <Section title={leg.why ? t('Why') : t('State')}>{leg.why ? <WhyBlock why={leg.why} /> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{why}</p>}</Section>
          {latest?.summary && <Section title={t('Recorded summary')}><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{latest.summary}</p></Section>}
          <Section title={t('Next work')}>{next ? <Link href={next.href} className="gap-2 text-sm font-medium">{next.label} <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" /></Link> : <p className="text-sm text-muted-foreground">{t('Nothing to do next yet.')}</p>}</Section>
          <Advanced summary={t('inputs · outputs · {units} units · {attempts} attempts · tokens', { units: leg.units.length, attempts: attempts.length })}>
            <div className="flex flex-col gap-6">
              {(leg.injected || leg.deferred) && <div className="flex flex-col gap-1 border-l-2 pl-3 text-xs">
                {leg.injected && <p><strong>injected:</strong> {leg.injected}</p>}
                {leg.deferred && <p><strong>deferred:</strong> {leg.deferred}</p>}
              </div>}
              <LegStory project={project} wf={wf} leg={leg} pipeline={pipeline} />
              <Section title={t('Units · {n}', { n: leg.units.length })}>{leg.units.length ? <ul className="divide-y">{leg.units.map(u => <li key={u.unit} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-3">
                <span className="min-w-0 flex-1 break-words text-sm">{u.title}</span>
                <StatusChip status={statusFromUnit(u.state)} label={unitStateLabels[u.state] ?? u.state} />
                <span className="text-xs text-muted-foreground">{t('try {tries}/{budget}', { tries: u.tries, budget: u.tryBudget })}</span>
                <Link href={u.href} aria-label={t('Open {title}', { title: u.title })}><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
                <span className="w-full break-all font-mono text-xs text-muted-foreground">{u.unit} · {t('Goal revision {n}', { n: u.goalRevision })} · {u.subjectKey} · {t('{n} dispatches', { n: u.dispatches })}</span>
              </li>)}</ul> : none}</Section>
              <Section title={t('Attempts · {n}', { n: attempts.length })}>{attempts.length
                ? <ol className="flex flex-col">{attempts.map(a => <AttemptCard key={a.id} attempt={a} now={now} />)}</ol>
                : <p className="border-t py-3 text-xs text-muted-foreground">{t('No attempts yet — this leg is waiting for {what}.', { what: waiting.length ? waiting.join(', ') : leg.deferred ? t('the deferred condition to lift') : t('its turn to be dispatched') })}</p>}</Section>
            </div>
          </Advanced>
        </div>
  </Drawer>;
}
