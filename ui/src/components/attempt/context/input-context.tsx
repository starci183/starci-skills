import { useState } from 'react';
import { Link } from '@heroui/react';
import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { KeyVal } from '../../key-val';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import { StatusChip } from '../../status-chip';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { jsonText } from '../frame/util';
import { t } from '../../../i18n/t';
import { formatAbsolute } from '../../../i18n/vi';
import { Advanced } from '../../motion';
import { Button } from '../../ui/button';

/** The business concept id (C8) under which the Op input context panel is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C8';

const none = <span className="text-muted-foreground">{t('Not recorded')}</span>;
const jsonBox = 'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-default p-2 font-mono text-xs';
const verdictWords: Record<string, string> = { pass: t('passed'), fail: t('failed'), partial: t('partial'), blocked: t('blocked'), dropped: t('dropped'), cancelled: t('cancelled') };
const empty = (value: unknown) => value == null || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value as object).length);
const h3 = 'm-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

const GoalExcerpt = ({ text, revision }: Readonly<{ text: string | null; revision: number | null }>) => {
  const [open, setOpen] = useState(false);
  if (!text) return <p className="m-0 text-sm text-muted-foreground">{t('Could not read the workflow goal yet.')}</p>;
  const long = text.length > 280 || text.split('\n').length > 3;
  return <div>
    <p className={`m-0 whitespace-pre-wrap break-words text-sm ${open ? '' : 'line-clamp-3'}`}>{text}</p>
    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
      {revision != null ? <span>{t('goal revision {n}', { n: revision })}</span> : null}
      {long ? <Button type="button" variant="link" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('Collapse') : t('View full')}</Button> : null}
    </div>
  </div>;
};

type Input = NonNullable<AttemptDetailV3['input']>;
type Prior = NonNullable<AttemptDetailV3['prior']>;

const settleReasonText = (prior: Prior | null): string | null => {
  if (prior?.settleReason == null) return null;
  return typeof prior.settleReason === 'string' ? prior.settleReason : jsonText(prior.settleReason);
};

const WriteScopeValue = ({ input }: Readonly<{ input: Input }>) => {
  if (!input.writeScopeKnown) return none;
  if (!input.ownedPaths.length) return <>{t('Captured write scope is empty')}</>;
  return <span className="flex flex-col gap-1">{input.ownedPaths.map(rel => <code key={rel} className="break-all text-xs">{rel}</code>)}</span>;
};

const RecordsValue = ({ input }: Readonly<{ input: Input }>) => {
  if (!input.recordsKnown) return none;
  if (!input.records.length) return <>{t('Captured record list is empty')}</>;
  return <pre className={jsonBox}>{jsonText(input.records)}</pre>;
};

const GoalValue = ({ goal }: Readonly<{ goal: Input['goal'] }>) => {
  if (!goal) return none;
  return <>{goal.revision != null ? t('revision {n}', { n: goal.revision }) : t('Not recorded')} · <span className="break-all font-mono text-xs">{goal.identity ?? t('Not recorded')}</span></>;
};

const InputGrid = ({ attempt, input }: Readonly<{ attempt: AttemptDetailV3; input: Input }>) => {
  const route = attempt.route;
  return <dl className="grid gap-3 text-sm md:grid-cols-2">
    <KeyVal label={t('Assignment')} value={input.what ?? none} />
    <KeyVal label={t('Write scope')} value={<WriteScopeValue input={input} />} />
    <KeyVal label={t('Input records')} value={<RecordsValue input={input} />} />
    <KeyVal label={t('Params')} value={empty(input.params) ? none : <pre className={jsonBox}>{jsonText(input.params)}</pre>} />
    {!empty(input.cut) || !empty(input.after) ? <KeyVal label={t('Cut · after')} value={<pre className={jsonBox}>{jsonText({ cut: input.cut ?? null, after: input.after ?? null })}</pre>} /> : null}
    <KeyVal label="Goal" value={<GoalValue goal={input.goal} />} />
    <KeyVal label={t('Recorded dispatch routing')} value={route.by || route.chain || route.rejected ? <pre className={jsonBox}>{jsonText(route)}</pre> : none} />
  </dl>;
};

const ObservedModel = ({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) => {
  if (attempt.modelAuthority !== 'attested' || !attempt.model) return <span className="text-muted-foreground">{t('Not observed')}</span>;
  return <span>{attempt.model}<span className="block text-xs text-muted-foreground">{t('Agent attested')} · {formatAbsolute(attempt.attestedAt)}</span></span>;
};

const ModelRows = ({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) => {
  const requested = [attempt.requestedModel ?? t('Not recorded'), attempt.effort && `effort ${attempt.effort}`, attempt.input?.difficulty && t('difficulty {level}', { level: attempt.input.difficulty })].filter(Boolean).join(' · ');
  return <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
    <KeyVal label={t('Requested model · effort · difficulty')} value={requested} />
    <KeyVal label={t('Observed model')} value={<ObservedModel attempt={attempt} />} />
  </dl>;
};

const GoalSection = ({ attempt, goal }: Readonly<{ attempt: AttemptDetailV3; goal: { text: string; revision: number } | null }>) => {
  const capturedGoal = attempt.capturedGoal;
  return <section><h3 className={h3}>{t('Captured workflow goal')}</h3><GoalExcerpt text={capturedGoal?.text ?? null} revision={capturedGoal?.revision ?? null} />
    {capturedGoal?.identity ? <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{capturedGoal.identity}</p> : null}
    {goal ? <Advanced className="mt-4" title={t('Current workflow goal reference')} keepMounted><GoalExcerpt text={goal.text} revision={goal.revision} /></Advanced> : null}
  </section>;
};

const KernelSection = ({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) => {
  const input = attempt.input;
  const captured = attempt.dispatchContext;
  return <section><h3 className={h3}>{t('Kernel hands to the op')}</h3>
    <p className="mb-3 mt-0 text-xs text-muted-foreground">{captured ? t('Dispatch contract captured at {at}', { at: formatAbsolute(captured.createdAt) }) : t('Dispatch contract capture unavailable')}</p>
    {input ? <InputGrid attempt={attempt} input={input} /> : <p className="m-0 text-sm text-muted-foreground">{t('Historical dispatch input was not recorded.')}</p>}
    <ModelRows attempt={attempt} />
    {captured ? <Advanced className="mt-4" title={t('Captured contract provenance')} keepMounted><div className="grid gap-4"><dl className="grid gap-3 text-sm md:grid-cols-2"><KeyVal label={t('Contract revision')} value={captured.contractRev ?? none} /><KeyVal label={t('Runtime revision')} value={captured.runtimeSha ?? none} /></dl><p className="m-0 text-xs text-muted-foreground">{t('The dispatch packet and managed identity are captured records; contract input digests may be rebaselined by the runtime.')}</p><pre className={jsonBox}>{jsonText(captured)}</pre></div></Advanced> : null}
    {attempt.currentInput ? <Advanced className="mt-4" title={t('Current job context reference')} keepMounted><div className="grid gap-4"><p className="m-0 text-xs text-muted-foreground">{t('This mutable job context is not the historical dispatch input.')} · {formatAbsolute(attempt.currentInput.sourceAt)}</p><pre className={jsonBox}>{jsonText(attempt.currentInput)}</pre></div></Advanced> : null}
  </section>;
};

const ReadsSection = ({ info }: Readonly<{ info: OpInfo | null }>) => {
  const reads = info?.reads ?? [];
  return <section><h3 className={h3}>{t('Op must read')}</h3>
    <p className="mb-2 mt-0 text-xs text-muted-foreground">{t('Current operation YAML reference')}</p>
    {reads.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">{reads.map(item => <li key={item.id}><code className="break-all text-xs">{item.id}</code>{item.purpose ? <span className="text-muted-foreground"> — {item.purpose}</span> : null}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">{info?.declarations?.reads ? t('The op contract declares no required reads.') : t('Required reads were not recorded.')}</p>}
  </section>;
};

const PriorSection = ({ prior }: Readonly<{ prior: Prior }>) => {
  const reason = settleReasonText(prior);
  return <section className="border-t pt-6"><h3 className={h3}>{t('Previous attempt for this unit')}</h3>
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Link className="font-medium" href={prior.href}>{t('attempt {n}', { n: prior.try })} · #{prior.id}</Link>
      <StatusChip status={statusFromVerdict(prior.verdict, false, prior.ui)} label={prior.verdict ? t('Recorded verdict: {verdict}', { verdict: verdictWords[prior.verdict] ?? prior.verdict }) : t('No recorded verdict')} />
      {prior.reportOutcome ? <StatusChip status={statusFromOutcome(prior.reportOutcome)} label={t('Op reported: {outcome}', { outcome: prior.reportOutcome })} /> : null}
    </div>
    {prior.summary ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm">{prior.summary}</p> : null}
    {reason ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{t('Settle reason: {reason}', { reason })}</p> : null}
    {prior.nextStep ? <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('Next step: {step}', { step: prior.nextStep })}</p> : null}
  </section>;
};

/** Block 3 "Inputs & context": workflow goal, what the kernel handed over, what the op must read, and the previous attempt. */
export const InputContextCard = ({ attempt, info, goal }: Readonly<{ attempt: AttemptDetailV3; info: OpInfo | null; goal: { text: string; revision: number } | null }>) => {
  const prior = attempt.prior ?? null;
  return <Card id="attempt-input" concept="C8" title={t('Inputs & context')} hint={t('what the kernel hands over, what the op must read')}>
    <div className="grid gap-6">
      <GoalSection attempt={attempt} goal={goal} />
      <KernelSection attempt={attempt} />
      <ReadsSection info={info} />
      {prior ? <PriorSection prior={prior} /> : null}
    </div>
  </Card>;
};
