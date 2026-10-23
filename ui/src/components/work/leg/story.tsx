import { type ReactNode } from 'react';
import { Link } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { refreshQuery, useApiQuery } from '../../../api/query';
import type { AttemptDetailV2, LegRow, PipelineView } from '../../../contract';
import { StatusChip } from '../../status-chip';
import { statusFromOutcome } from '../../status';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { legInfo } from '../pipeline/node/op-identity';
import { t } from '../../../i18n/t';
import { FeedbackState, SourceWarning } from '../../feedback-state';
import { formatAbsolute } from '../../../i18n/vi';
import { Advanced } from '../../motion';

/** The business concept id (C4) under which the leg story timeline is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C4';

const outcomeLabel: Record<string, string> = { done: t('Op reported done'), partial: t('Op reported partial'), failed: t('Op reported failed'), ask: t('Op asked back'), blocked: t('Op reported blocked') };
const fmt = (n: number) => n.toLocaleString('vi-VN');

type BlockProps = { readonly title: string; readonly children: ReactNode };

const Block = ({ title, children }: BlockProps) => {
  return <section className="mt-6 first:mt-0"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
};
const muted = (text: string) => <p className="text-xs text-muted-foreground">{text}</p>;

/** Token total across the leg's attempts, or null when none recorded any. */
export const legTokens = (leg: LegRow): { input: number | null; output: number | null; inputKnown: number; outputKnown: number } | null => {
  let input: number | null = null; let output: number | null = null; let inputKnown = 0; let outputKnown = 0;
  for (const a of leg.attempts) {
    if (a.tokensIn != null) { input = (input ?? 0) + a.tokensIn; inputKnown++; }
    if (a.tokensOut != null) { output = (output ?? 0) + a.tokensOut; outputKnown++; }
  }
  return inputKnown || outputKnown ? { input, output, inputKnown, outputKnown } : null;
};

type LegAboutProps = { readonly leg: LegRow };

/** Essentials: "What it does" — what the op does (Vietnamese first, English original on demand) and its side effects. */
export const LegAbout = ({ leg }: LegAboutProps) => {
  const info = legInfo(leg);
  const goal = info?.goal.vi ?? info?.goal.en ?? null;
  return <div>
    <p className="mb-2 text-xs text-muted-foreground">{t('Current runtime YAML reference; historical dispatch metadata is separate.')}</p>
    {info?.readError && <SourceWarning className="mb-2 text-xs">{t('Operation reference unavailable: {error}', { error: info.readError })}</SourceWarning>}
    <p className="text-sm">{goal ?? t('No description for this op yet.')}</p>
    {info?.goal.en && info.goal.vi ? <Advanced keepMounted className="mt-2" title={t('View the English original')}><p className="text-sm text-muted-foreground">{info.goal.en}</p></Advanced> : null}
    {info?.sideEffects.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{info.sideEffects.map(e => <li key={e}>{e}</li>)}</ul> : null}
  </div>;
};

type Attempt = LegRow['attempts'][number];
type Leg = LegRow;
type Tokens = NonNullable<ReturnType<typeof legTokens>>;
/** The three facts about the attempt-detail read that decide which placeholder text applies. */
type ReadState = { readonly loading: boolean; readonly hasData: boolean };

const reportFileCount = (attempt: AttemptDetailV2 | null | undefined): number | null => {
  const json = attempt?.report?.json;
  const files = json && typeof json === 'object' ? (json as { files?: unknown }).files : undefined;
  return Array.isArray(files) ? files.length : null;
};

const OpChips = ({ ops, byOp }: Readonly<{ ops: readonly string[]; byOp: ReadonlyMap<string, Leg> }>) => {
  return <ul className="space-y-1">{ops.map(op => <li key={op} className="flex flex-wrap items-center gap-2 text-sm"><StatusChip status={byOp.get(op)?.status ?? 'unknown'} /><span className="min-w-0 break-all font-mono text-xs">{op}</span></li>)}</ul>;
};

const dispatchedTitle = (latest: Attempt | null, input: AttemptDetailV2['input']): string => {
  if (!latest) return t('No dispatched input yet');
  return input?.source === 'contract' ? t('Contract context · attempt #{id}', { id: latest.id }) : t('Current job reference · attempt #{id}', { id: latest.id });
};

const noInputMessage = (latest: Attempt | null, read: ReadState): string => {
  if (!latest) return t('No attempts yet, nothing dispatched.');
  return read.loading ? t('Loading…') : t('Could not read the dispatched data yet.');
};

const DispatchedInput = ({ latest, input, read }: Readonly<{ latest: Attempt | null; input: AttemptDetailV2['input']; read: ReadState }>) => {
  return <div className="mt-2 bg-default p-3 text-xs">
    <p className="mb-1 font-medium">{dispatchedTitle(latest, input)}</p>
    {input ? <ul className="space-y-1 text-muted-foreground">
      {input.what ? <li className="break-words">{input.what}</li> : null}
      {input.goal ? <li>{t('Workflow goal, revision {n}', { n: input.goal.revision ?? '—' })}</li> : null}
      <li>{input.ownedPaths.length ? t('{n} paths may be written:', { n: input.ownedPaths.length }) : t('{n} paths may be written', { n: input.ownedPaths.length })}</li>
      {input.ownedPaths.length ? <li><ul className="ml-2 space-y-1">{input.ownedPaths.slice(0, 6).map(p => <li key={p} className="break-all font-mono text-[13px]">{p}</li>)}{input.ownedPaths.length > 6 ? <li>{t('… and {n} more paths', { n: input.ownedPaths.length - 6 })}</li> : null}</ul></li> : null}
      {input.records.length ? <li>{t('{n} attached records', { n: input.records.length })}</li> : null}
    </ul> : <p className="text-muted-foreground">{noInputMessage(latest, read)}</p>}
  </div>;
};

const InputsBlock = ({ leg, info, latest, input, upstream, byOp, read }: Readonly<{
  leg: Leg; info: ReturnType<typeof legInfo>; latest: Attempt | null; input: AttemptDetailV2['input']; upstream: readonly string[]; byOp: ReadonlyMap<string, Leg>; read: ReadState;
}>) => {
  const reads = info?.reads ?? [];
  return <Block title={t('Inputs')}>
    {reads.length ? <ul className="space-y-2">{reads.map(r => <li key={r.id} className="text-xs"><span className="font-mono font-semibold">{r.id}</span>{r.purpose ? <span className="block text-muted-foreground">{r.purpose}</span> : null}</li>)}</ul> : muted(info?.declarations?.reads ? t('The op declares no read data.') : t('Input declaration unknown.'))}
    {upstream.length ? <div className="mt-2"><p className="mb-1 text-[13px] text-muted-foreground">{t('Waiting on ops')}</p><OpChips ops={upstream} byOp={byOp} /></div> : null}
    {leg.needs.length ? <ul className="mt-2 space-y-1">{leg.needs.map(n => <li key={n} className="break-all font-mono text-[13px] text-muted-foreground">{n}</li>)}</ul> : null}
    <DispatchedInput latest={latest} input={input} read={read} />
  </Block>;
};

const fileCountMessage = (fileCount: number | null, read: ReadState): string => {
  if (fileCount != null) return t('{n} files declared in the Op report', { n: fileCount });
  if (read.loading) return t('Counting files…');
  return read.hasData ? t('No file report yet.') : t('Could not read the dispatched data yet.');
};

const LatestAttempt = ({ latest, fileCount, read }: Readonly<{ latest: Attempt; fileCount: number | null; read: ReadState }>) => {
  return <div className="mt-2 bg-default p-3 text-xs">
    <p className="mb-1 flex flex-wrap items-center gap-2 font-medium">{t('Latest attempt #{id}', { id: latest.id })}
      <StatusChip status={statusFromOutcome(latest.reportOutcome)} label={latest.reportOutcome ? outcomeLabel[latest.reportOutcome] : t('Op has not reported')} /></p>
    {latest.summary ? <p className="line-clamp-4 whitespace-pre-wrap break-words">{latest.summary}</p> : null}
    <p className="mt-1 text-muted-foreground">{fileCountMessage(fileCount, read)}</p>
    <Link href={`${latest.href}?step=report`} className="mt-2 inline-flex items-center gap-1 font-medium">{t('View Products')} <ArrowRight className="size-3" aria-hidden="true" /></Link>
  </div>;
};

const OutputsBlock = ({ leg, info, latest, fileCount, downstream, byOp, read }: Readonly<{
  leg: Leg; info: ReturnType<typeof legInfo>; latest: Attempt | null; fileCount: number | null; downstream: readonly string[]; byOp: ReadonlyMap<string, Leg>; read: ReadState;
}>) => {
  return <Block title={t('Outputs')}>
    {leg.produces.length ? <ul className="space-y-1">{leg.produces.map(n => <li key={n} className="break-all font-mono text-xs">{n}</li>)}</ul> : muted(t('Not declared.'))}
    {info?.writes.length ? <ul className="mt-1 space-y-1">{info.writes.map(w => <li key={w} className="break-all font-mono text-[13px] text-muted-foreground">{w}</li>)}</ul> : null}
    {latest ? <LatestAttempt latest={latest} fileCount={fileCount} read={read} /> : null}
    {downstream.length ? <div className="mt-2"><p className="mb-1 text-[13px] text-muted-foreground">{t('Unblocks')}</p><OpChips ops={downstream} byOp={byOp} /></div> : null}
  </Block>;
};

const TokensBlock = ({ tokens, attempts }: Readonly<{ tokens: Tokens | null; attempts: number }>) => {
  return <Block title="Token">
    {tokens ? <p className="font-mono text-sm">{t('{input} in · {output} out', { input: tokens.input == null ? '—' : fmt(tokens.input), output: tokens.output == null ? '—' : fmt(tokens.output) })} <span className="font-sans text-xs text-muted-foreground">{t('Recorded part · input {input}/{total}, output {output}/{total}', { input: tokens.inputKnown, output: tokens.outputKnown, total: attempts })}</span></p> : muted(t('not recorded'))}
  </Block>;
};

type LegStoryProps = { readonly project: string; readonly wf: string; readonly leg: LegRow; readonly pipeline: PipelineView };

/** Advanced part of the op story: input, output, tokens. Reads the latest attempt for the real hand-over. */
export const LegStory = ({ project, wf, leg, pipeline }: LegStoryProps) => {
  const info = legInfo(leg);
  const latest = [...leg.attempts].sort((a, b) => b.id - a.id)[0] ?? null;
  const url = latest ? `/api/attempts/${encodeURIComponent(project)}/${latest.id}` : '';
  const detail = useApiQuery<AttemptDetailV2>(url, { enabled: Boolean(latest), topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const attempt = latest ? detail.data : null;
  const fileCount = reportFileCount(attempt);
  const byOp = new Map(pipeline.legs.map(l => [l.op, l]));
  const upstream = pipeline.edges.filter(e => e.to === leg.op).map(e => e.from);
  const downstream = pipeline.edges.filter(e => e.from === leg.op).map(e => e.to);
  const read: ReadState = { loading: !detail.meta && !detail.error, hasData: Boolean(detail.data) };
  return <div>
    {latest && detail.error && <FeedbackState error onRetry={() => refreshQuery(url)}>{detail.meta ? t('The source is failing; showing the last read. {error}', { error: detail.error }) : detail.error}</FeedbackState>}
    {latest && detail.meta?.stale?.length ? <SourceWarning className="text-xs">{t('Source out of sync: {list}', { list: detail.meta.stale.join(', ') })}</SourceWarning> : null}
    {latest && detail.meta && <p className="mb-3 text-xs text-muted-foreground">{t('Read observed {at}', { at: formatAbsolute(detail.observedAt) })}</p>}
    <InputsBlock leg={leg} info={info} latest={latest} input={attempt?.input ?? null} upstream={upstream} byOp={byOp} read={read} />
    <OutputsBlock leg={leg} info={info} latest={latest} fileCount={fileCount} downstream={downstream} byOp={byOp} read={read} />
    <TokensBlock tokens={legTokens(leg)} attempts={leg.attempts.length} />
    {leg.conditions.length ? <Advanced keepMounted className="mt-6" title={t('Conditions · {n}', { n: leg.conditions.length })}>
      <ul className="space-y-1">{leg.conditions.map(n => <li key={n} className="break-words text-sm">{n}</li>)}</ul></Advanced> : null}
    {info?.manifest ? <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{t('Op manifest')} <PathLink path={info.manifest} kind="file" /></p> : null}
  </div>;
};
