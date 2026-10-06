import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { refreshQuery, useApiQuery } from '../../../api/query';
import type { AttemptDetailV2, LegRow, PipelineView } from '../../../contract';
import { StatusChip } from '../../status-chip';
import { statusFromOutcome } from '../../status';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { legInfo } from '../pipeline/node/op-identity';
import { t } from '../../../i18n/t';
import { FeedbackState } from '../../feedback-state';
import { formatAbsolute } from '../../../i18n/vi';

export const concept: Concept = 'C4';

const outcomeLabel: Record<string, string> = { done: t('Op reported done'), partial: t('Op reported partial'), failed: t('Op reported failed'), ask: t('Op asked back'), blocked: t('Op reported blocked') };
const fmt = (n: number) => n.toLocaleString('vi-VN');

function Block({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <section className="mt-6 first:mt-0"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}
const muted = (text: string) => <p className="text-xs text-muted-foreground">{text}</p>;

/** Token total across the leg's attempts, or null when none recorded any. */
export function legTokens(leg: LegRow): { input: number | null; output: number | null; inputKnown: number; outputKnown: number } | null {
  let input: number | null = null; let output: number | null = null; let inputKnown = 0; let outputKnown = 0;
  for (const a of leg.attempts) {
    if (a.tokensIn != null) { input = (input ?? 0) + a.tokensIn; inputKnown++; }
    if (a.tokensOut != null) { output = (output ?? 0) + a.tokensOut; outputKnown++; }
  }
  return inputKnown || outputKnown ? { input, output, inputKnown, outputKnown } : null;
}

/** Essentials: "What it does" — what the op does (Vietnamese first, English original on demand) and its side effects. */
export function LegAbout({ leg }: { readonly leg: LegRow }) {
  const info = legInfo(leg);
  const [en, setEn] = useState(false);
  const goal = info?.goal.vi ?? info?.goal.en ?? null;
  return <div>
    <p className="mb-2 text-xs text-muted-foreground">{t('Current runtime YAML reference; historical dispatch metadata is separate.')}</p>
    {info?.readError && <p className="shell-error mb-2 break-words text-xs">{t('Operation reference unavailable: {error}', { error: info.readError })}</p>}
    <p className="text-sm">{goal ?? t('No description for this op yet.')}</p>
    {info?.goal.en && info.goal.vi ? <div className="mt-2">
      <button type="button" className="text-xs font-medium text-primary hover:underline" aria-expanded={en} onClick={() => setEn(v => !v)}>{en ? t('Hide the English original') : t('View the English original')}</button>
      {en ? <p className="mt-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">{info.goal.en}</p> : null}
    </div> : null}
    {info?.sideEffects.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{info.sideEffects.map(e => <li key={e}>{e}</li>)}</ul> : null}
  </div>;
}

/** Advanced part of the op story: input, output, tokens. Reads the latest attempt for the real hand-over. */
export function LegStory({ project, wf, leg, pipeline }: { readonly project: string; readonly wf: string; readonly leg: LegRow; readonly pipeline: PipelineView }) {
  const info = legInfo(leg);
  const latest = [...leg.attempts].sort((a, b) => b.id - a.id)[0] ?? null;
  const url = latest ? `/api/attempts/${encodeURIComponent(project)}/${latest.id}` : '';
  const detail = useApiQuery<AttemptDetailV2>(url, { enabled: Boolean(latest), topics: [`wf:${project}:${wf}`, 'system'], intervalMs: 60_000 });
  const attempt = latest ? detail.data : null;
  const files = attempt?.report?.json && typeof attempt.report.json === 'object' ? (attempt.report.json as { files?: unknown }).files : undefined;
  const fileCount = Array.isArray(files) ? files.length : null;
  const byOp = new Map(pipeline.legs.map(l => [l.op, l]));
  const upstream = pipeline.edges.filter(e => e.to === leg.op).map(e => e.from);
  const downstream = pipeline.edges.filter(e => e.from === leg.op).map(e => e.to);
  const chip = (op: string) => <li key={op} className="flex flex-wrap items-center gap-2 text-sm"><StatusChip status={byOp.get(op)?.status ?? 'unknown'} /><span className="min-w-0 break-all font-mono text-xs">{op}</span></li>;
  const tokens = legTokens(leg);
  const input = attempt?.input ?? null;
  const reads = info?.reads ?? [];
  return <div>
    {latest && detail.error && <FeedbackState error onRetry={() => refreshQuery(url)}>{detail.meta ? t('The source is failing; showing the last read. {error}', { error: detail.error }) : detail.error}</FeedbackState>}
    {latest && detail.meta?.stale?.length ? <output className="shell-error block text-xs">{t('Source out of sync: {list}', { list: detail.meta.stale.join(', ') })}</output> : null}
    {latest && detail.meta && <p className="mb-3 text-xs text-muted-foreground">{t('Read observed {at}', { at: formatAbsolute(detail.observedAt) })}</p>}
    <Block title={t('Inputs')}>
      {reads.length ? <ul className="space-y-2">{reads.map(r => <li key={r.id} className="text-xs"><span className="font-mono font-semibold">{r.id}</span>{r.purpose ? <span className="block text-muted-foreground">{r.purpose}</span> : null}</li>)}</ul> : muted(info?.declarations?.reads ? t('The op declares no read data.') : t('Input declaration unknown.'))}
      {upstream.length ? <div className="mt-2"><p className="mb-1 text-[11px] text-muted-foreground">{t('Waiting on ops')}</p><ul className="space-y-1">{upstream.map(chip)}</ul></div> : null}
      {leg.needs.length ? <ul className="mt-2 space-y-1">{leg.needs.map(n => <li key={n} className="break-all font-mono text-[11px] text-muted-foreground">{n}</li>)}</ul> : null}
      <div className="mt-2 rounded-md border bg-muted/20 p-3 text-xs">
        <p className="mb-1 font-medium">{latest ? input?.source === 'contract' ? t('Contract context · attempt #{id}', { id: latest.id }) : t('Current job reference · attempt #{id}', { id: latest.id }) : t('No dispatched input yet')}</p>
        {input ? <ul className="space-y-1 text-muted-foreground">
          {input.what ? <li className="break-words">{input.what}</li> : null}
          {input.goal ? <li>{t('Workflow goal, revision {n}', { n: input.goal.revision ?? '—' })}</li> : null}
          <li>{input.ownedPaths.length ? t('{n} paths may be written:', { n: input.ownedPaths.length }) : t('{n} paths may be written', { n: input.ownedPaths.length })}</li>
          {input.ownedPaths.length ? <li><ul className="ml-2 space-y-1">{input.ownedPaths.slice(0, 6).map(p => <li key={p} className="break-all font-mono text-[11px]">{p}</li>)}{input.ownedPaths.length > 6 ? <li>{t('… and {n} more paths', { n: input.ownedPaths.length - 6 })}</li> : null}</ul></li> : null}
          {input.records.length ? <li>{t('{n} attached records', { n: input.records.length })}</li> : null}
        </ul> : <p className="text-muted-foreground">{latest ? (!detail.meta && !detail.error ? t('Loading…') : t('Could not read the dispatched data yet.')) : t('No attempts yet, nothing dispatched.')}</p>}
      </div>
    </Block>
    <Block title={t('Outputs')}>
      {leg.produces.length ? <ul className="space-y-1">{leg.produces.map(n => <li key={n} className="break-all font-mono text-xs">{n}</li>)}</ul> : muted(t('Not declared.'))}
      {info?.writes.length ? <ul className="mt-1 space-y-1">{info.writes.map(w => <li key={w} className="break-all font-mono text-[11px] text-muted-foreground">{w}</li>)}</ul> : null}
      {latest ? <div className="mt-2 rounded-md border bg-muted/20 p-3 text-xs">
        <p className="mb-1 flex flex-wrap items-center gap-2 font-medium">{t('Latest attempt #{id}', { id: latest.id })}
          <StatusChip status={statusFromOutcome(latest.reportOutcome)} label={latest.reportOutcome ? outcomeLabel[latest.reportOutcome] : t('Op has not reported')} /></p>
        {latest.summary ? <p className="line-clamp-4 whitespace-pre-wrap break-words">{latest.summary}</p> : null}
        <p className="mt-1 text-muted-foreground">{fileCount == null ? (!detail.meta && !detail.error ? t('Counting files…') : detail.data ? t('No file report yet.') : t('Could not read the dispatched data yet.')) : t('{n} files declared in the Op report', { n: fileCount })}</p>
        <a href={`${latest.href}?step=report`} className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline">{t('View Products')} <ArrowRight className="size-3" aria-hidden="true" /></a>
      </div> : null}
      {downstream.length ? <div className="mt-2"><p className="mb-1 text-[11px] text-muted-foreground">{t('Unblocks')}</p><ul className="space-y-1">{downstream.map(chip)}</ul></div> : null}
    </Block>
    <Block title="Token">
      {tokens ? <p className="font-mono text-sm">{t('{input} in · {output} out', { input: tokens.input == null ? '—' : fmt(tokens.input), output: tokens.output == null ? '—' : fmt(tokens.output) })} <span className="font-sans text-xs text-muted-foreground">{t('Recorded part · input {input}/{total}, output {output}/{total}', { input: tokens.inputKnown, output: tokens.outputKnown, total: leg.attempts.length })}</span></p> : muted(t('not recorded'))}
    </Block>
    {leg.conditions.length ? <details className="mt-6"><summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{t('Conditions · {n}', { n: leg.conditions.length })}</summary>
      <ul className="mt-2 space-y-1">{leg.conditions.map(n => <li key={n} className="break-words text-xs">{n}</li>)}</ul></details> : null}
    {info?.manifest ? <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{t('Op manifest')} <PathLink path={info.manifest} kind="file" /></p> : null}
  </div>;
}
