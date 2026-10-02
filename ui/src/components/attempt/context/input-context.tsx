import { useState } from 'react';
import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { KeyVal } from '../../key-val';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import { StatusChip } from '../../status-chip';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { jsonText } from '../frame/util';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C8';

const none = <span className="text-muted-foreground">{t('none')}</span>;
const jsonBox = 'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-xs';
const verdictWords: Record<string, string> = { pass: t('passed'), fail: t('failed'), partial: t('partial'), blocked: t('blocked'), dropped: t('dropped'), cancelled: t('cancelled') };
const empty = (value: unknown) => value == null || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value as object).length);
const h3 = 'm-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

function GoalExcerpt({ text, revision }: { text: string | null; revision: number | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return <p className="m-0 text-sm text-muted-foreground">{t('Could not read the workflow goal yet.')}</p>;
  const long = text.length > 280 || text.split('\n').length > 3;
  return <div>
    <p className={`m-0 whitespace-pre-wrap break-words text-sm ${open ? '' : 'line-clamp-3'}`}>{text}</p>
    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
      {revision != null ? <span>{t('goal revision {n}', { n: revision })}</span> : null}
      {long ? <button type="button" className="text-primary hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('Collapse') : t('View full')}</button> : null}
    </div>
  </div>;
}

/** Block 3 "Inputs & context": workflow goal, what the kernel handed over, what the op must read, and the previous attempt. */
export function InputContextCard({ attempt, info, goal }: { attempt: AttemptDetailV3; info: OpInfo | null; goal: { text: string; revision: number } | null }) {
  const input = attempt.input;
  const route = input?.route;
  const chosen = attempt.pool ?? input?.profile ?? null;
  const reads = info?.reads ?? [];
  const prior = attempt.prior ?? null;
  const reason = prior && prior.settleReason != null ? (typeof prior.settleReason === 'string' ? prior.settleReason : jsonText(prior.settleReason)) : null;
  return <Card id="attempt-input" concept="C8" title={t('Inputs & context')} hint={t('what the kernel hands over, what the op must read')}>
    <div className="grid gap-6">
      <section><h3 className={h3}>{t('Workflow goal')}</h3><GoalExcerpt text={goal?.text ?? null} revision={goal?.revision ?? null} /></section>
      <section><h3 className={h3}>{t('Kernel hands to the op')}</h3>
        {!input ? <p className="m-0 text-sm text-muted-foreground">{t('This job stores no input payload.')}</p> : <dl className="grid gap-3 text-sm md:grid-cols-2">
          <KeyVal label={t('Assignment')} value={input.what ?? none} />
          <KeyVal label={t('Write scope')} value={input.ownedPaths?.length ? <span className="flex flex-col gap-1">{input.ownedPaths.map(rel => <code key={rel} className="break-all text-xs">{rel}</code>)}</span> : none} />
          <KeyVal label={t('Input records')} value={input.records?.length ? <pre className={jsonBox}>{jsonText(input.records)}</pre> : <span className="text-muted-foreground">{t('none (the op reads the existing Work itself)')}</span>} />
          <KeyVal label={t('Params')} value={empty(input.params) ? none : <pre className={jsonBox}>{jsonText(input.params)}</pre>} />
          {!empty(input.cut) || !empty(input.after) ? <KeyVal label={t('Cut · after')} value={<pre className={jsonBox}>{jsonText({ cut: input.cut ?? null, after: input.after ?? null })}</pre>} /> : null}
          <KeyVal label="Goal" value={input.goal ? <>{t('revision {n}', { n: input.goal.revision })} · <span className="break-all font-mono text-xs">{input.goal.identity}</span></> : none} />
          <KeyVal label={t('Model · effort · difficulty')} value={[input.model ?? attempt.model, input.effort && `effort ${input.effort}`, input.difficulty && t('difficulty {level}', { level: input.difficulty })].filter(Boolean).join(' · ') || none} />
          <KeyVal label={t('Routing')} value={route?.chain?.length ? <span>{route.chain.join(' → ')}{chosen ? <> · {t('picked')} <b>{chosen}</b></> : null}{route.rejected?.length ? t(' · rejected {n}', { n: route.rejected.length }) : ''}{route.policy ? t(' · policy {policy}', { policy: route.policy }) : ''}{route.order ? t(' · order {order}', { order: route.order }) : ''}</span> : none} />
        </dl>}
      </section>
      <section><h3 className={h3}>{t('Op must read')}</h3>
        {reads.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">{reads.map(item => <li key={item.id}><code className="break-all text-xs">{item.id}</code>{item.purpose ? <span className="text-muted-foreground"> — {item.purpose}</span> : null}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">{t('The op contract declares no required reads.')}</p>}
      </section>
      {prior ? <section className="rounded-lg border p-4"><h3 className={h3}>{t('Previous attempt')}</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a className="font-medium text-primary hover:underline" href={prior.href}>{t('attempt {n}', { n: prior.try })} · #{prior.id}</a>
          <StatusChip status={statusFromVerdict(prior.verdict, false, prior.ui)} label={prior.verdict ? t('Kernel verdict: {verdict}', { verdict: verdictWords[prior.verdict] ?? prior.verdict }) : t('Kernel has not settled')} />
          {prior.reportOutcome ? <StatusChip status={statusFromOutcome(prior.reportOutcome)} label={t('Op reported: {outcome}', { outcome: prior.reportOutcome })} /> : null}
        </div>
        {prior.summary ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm">{prior.summary}</p> : null}
        {reason ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{t('Settle reason: {reason}', { reason })}</p> : null}
        {prior.nextStep ? <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('Next step: {step}', { step: prior.nextStep })}</p> : null}
      </section> : null}
    </div>
  </Card>;
}
