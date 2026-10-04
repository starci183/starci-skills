import { useState } from 'react';
import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { KeyVal } from '../../key-val';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import { StatusChip } from '../../status-chip';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { jsonText } from '../frame/util';
import { t } from '../../../i18n/t';
import { formatAbsolute } from '../../../i18n/vi';

export const concept: Concept = 'C8';

const none = <span className="text-muted-foreground">{t('Not recorded')}</span>;
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
  const reads = info?.reads ?? [];
  const captured = attempt.dispatchContext;
  const capturedGoal = attempt.capturedGoal;
  const prior = attempt.prior ?? null;
  const reason = prior && prior.settleReason != null ? (typeof prior.settleReason === 'string' ? prior.settleReason : jsonText(prior.settleReason)) : null;
  return <Card id="attempt-input" concept="C8" title={t('Inputs & context')} hint={t('what the kernel hands over, what the op must read')}>
    <div className="grid gap-6">
      <section><h3 className={h3}>{t('Captured workflow goal')}</h3><GoalExcerpt text={capturedGoal?.text ?? null} revision={capturedGoal?.revision ?? null} />
        {capturedGoal?.identity ? <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{capturedGoal.identity}</p> : null}
        {goal ? <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">{t('Current workflow goal reference')}</summary><div className="mt-2"><GoalExcerpt text={goal.text} revision={goal.revision} /></div></details> : null}
      </section>
      <section><h3 className={h3}>{t('Kernel hands to the op')}</h3>
        <p className="mb-3 mt-0 text-xs text-muted-foreground">{captured ? t('Dispatch contract captured at {at}', { at: formatAbsolute(captured.createdAt) }) : t('Dispatch contract capture unavailable')}</p>
        {!input ? <p className="m-0 text-sm text-muted-foreground">{t('Historical dispatch input was not recorded.')}</p> : <dl className="grid gap-3 text-sm md:grid-cols-2">
          <KeyVal label={t('Assignment')} value={input.what ?? none} />
          <KeyVal label={t('Write scope')} value={!input.writeScopeKnown ? none : input.ownedPaths.length ? <span className="flex flex-col gap-1">{input.ownedPaths.map(rel => <code key={rel} className="break-all text-xs">{rel}</code>)}</span> : t('Captured write scope is empty')} />
          <KeyVal label={t('Input records')} value={!input.recordsKnown ? none : input.records.length ? <pre className={jsonBox}>{jsonText(input.records)}</pre> : t('Captured record list is empty')} />
          <KeyVal label={t('Params')} value={empty(input.params) ? none : <pre className={jsonBox}>{jsonText(input.params)}</pre>} />
          {!empty(input.cut) || !empty(input.after) ? <KeyVal label={t('Cut · after')} value={<pre className={jsonBox}>{jsonText({ cut: input.cut ?? null, after: input.after ?? null })}</pre>} /> : null}
          <KeyVal label="Goal" value={input.goal ? <>{input.goal.revision != null ? t('revision {n}', { n: input.goal.revision }) : t('Not recorded')} · <span className="break-all font-mono text-xs">{input.goal.identity ?? t('Not recorded')}</span></> : none} />
          <KeyVal label={t('Recorded dispatch routing')} value={attempt.route.by || attempt.route.chain || attempt.route.rejected ? <pre className={jsonBox}>{jsonText(attempt.route)}</pre> : none} />
        </dl>}
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <KeyVal label={t('Requested model · effort · difficulty')} value={[attempt.requestedModel ?? t('Not recorded'), attempt.effort && `effort ${attempt.effort}`, input?.difficulty && t('difficulty {level}', { level: input.difficulty })].filter(Boolean).join(' · ')} />
          <KeyVal label={t('Observed model')} value={attempt.modelAuthority === 'attested' && attempt.model ? <span>{attempt.model}<span className="block text-xs text-muted-foreground">{t('Agent attested')} · {formatAbsolute(attempt.attestedAt)}</span></span> : <span className="text-muted-foreground">{t('Not observed')}</span>} />
        </dl>
        {captured ? <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">{t('Captured contract provenance')}</summary><dl className="mt-2 grid gap-3 text-sm md:grid-cols-2"><KeyVal label={t('Contract revision')} value={captured.contractRev ?? none} /><KeyVal label={t('Runtime revision')} value={captured.runtimeSha ?? none} /></dl><p className="text-xs text-muted-foreground">{t('The dispatch packet and managed identity are captured records; contract input digests may be rebaselined by the runtime.')}</p><pre className={jsonBox}>{jsonText(captured)}</pre></details> : null}
        {attempt.currentInput ? <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">{t('Current job context reference')}</summary><p className="text-xs text-muted-foreground">{t('This mutable job context is not the historical dispatch input.')} · {formatAbsolute(attempt.currentInput.sourceAt)}</p><pre className={jsonBox}>{jsonText(attempt.currentInput)}</pre></details> : null}
      </section>
      <section><h3 className={h3}>{t('Op must read')}</h3>
        <p className="mb-2 mt-0 text-xs text-muted-foreground">{t('Current operation YAML reference')}</p>
        {reads.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">{reads.map(item => <li key={item.id}><code className="break-all text-xs">{item.id}</code>{item.purpose ? <span className="text-muted-foreground"> — {item.purpose}</span> : null}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">{info?.declarations?.reads ? t('The op contract declares no required reads.') : t('Required reads were not recorded.')}</p>}
      </section>
      {prior ? <section className="rounded-lg border p-4"><h3 className={h3}>{t('Previous attempt for this unit')}</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a className="font-medium text-primary hover:underline" href={prior.href}>{t('attempt {n}', { n: prior.try })} · #{prior.id}</a>
          <StatusChip status={statusFromVerdict(prior.verdict, false, prior.ui)} label={prior.verdict ? t('Recorded verdict: {verdict}', { verdict: verdictWords[prior.verdict] ?? prior.verdict }) : t('No recorded verdict')} />
          {prior.reportOutcome ? <StatusChip status={statusFromOutcome(prior.reportOutcome)} label={t('Op reported: {outcome}', { outcome: prior.reportOutcome })} /> : null}
        </div>
        {prior.summary ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm">{prior.summary}</p> : null}
        {reason ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{t('Settle reason: {reason}', { reason })}</p> : null}
        {prior.nextStep ? <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('Next step: {step}', { step: prior.nextStep })}</p> : null}
      </section> : null}
    </div>
  </Card>;
}
