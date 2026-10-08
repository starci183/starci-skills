import { ArrowRight } from 'lucide-react';
import type { Why } from '../../contract';
import type { Concept } from '../concept';
import { Advanced } from '../motion';
import { t } from '../../i18n/t';

export const concept: Concept = 'C10';

/** Display the supplied handling role or retry handoff; it does not identify an assigned person or prove active work. */
export function whyOwner(owner: string | null | undefined): { label: string; tone: 'owner' | 'warning' | 'failed' | 'running' | 'queued' } {
  if (!owner) return { label: t('Handling role not recorded'), tone: 'queued' };
  if (owner === 'owner') return { label: t('Workflow owner'), tone: 'owner' };
  if (owner === 'op-retry') return { label: t('Kernel · retry coordination'), tone: 'warning' };
  if (owner === 'supervisor') return { label: t('Supervisor'), tone: 'queued' };
  if (owner === 'kernel') return { label: t('Kernel'), tone: 'queued' };
  if (owner === 'controller') return { label: t('Reconciler controller'), tone: 'queued' };
  if (owner === 'runtime-core') return { label: t('Runtime core'), tone: 'queued' };
  if (owner.startsWith('other-op:')) return { label: t('Op: {op}', { op: owner.slice('other-op:'.length) }), tone: 'warning' };
  return { label: t('Handling role: {role}', { role: owner }), tone: 'queued' };
}

/** Render the source role label without implying a named person, launch, repair or completed outcome. */
export function WhyOwnerBadge({ owner }: Readonly<{ owner: string | null | undefined }>) {
  const o = whyOwner(owner);
  return <span data-tone={o.tone} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--tone)]">
    <span className="size-1.5 rounded-full bg-[var(--tone)]" aria-hidden="true" />{o.label}
  </span>;
}

function CodeChips({ why }: Readonly<{ why: Why }>) {
  const items = why.codeInfo?.length ? why.codeInfo : why.codes.map(code => ({ code, known: false, title: code, meaning: null, next: null }));
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-2">{items.map(item => <span key={item.code} title={[item.title, item.meaning].filter(Boolean).join(' — ')}
    className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted px-2 py-0.5 text-xs">
    <span className="truncate">{item.title}</span><span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{item.code}</span>
  </span>)}</div>;
}

/**
 * The owner-facing reason (starci/why@1). `compact`: source headline and a separate handling role.
 * Full: headline, cause, op-vs-runtime disagreement, what happens next; codes and refs under "Advanced".
 */
export function WhyBlock({ why, compact = false, className = '' }: Readonly<{ why: Why | null | undefined; compact?: boolean; className?: string }>) {
  if (!why?.headline) return null;
  if (compact) return <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
    <p className="m-0 min-w-0 text-sm leading-6">{why.headline}</p>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t('Handling role:')}</span><WhyOwnerBadge owner={why.owner} /></div>
  </div>;
  return <div className={`flex min-w-0 flex-col gap-3 ${className}`}>
    <p className="m-0 min-w-0 text-[15px] font-medium leading-6">{why.headline}</p>
    {why.cause ? <p className="m-0 text-sm leading-6 text-muted-foreground">{why.cause}</p> : null}
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t('Handling role:')}</span><WhyOwnerBadge owner={why.owner} /></div>
    {why.disagreement ? <div data-tone="warning" className="rounded-lg border border-[var(--tone-line)] bg-[var(--tone-bg)] p-3 text-sm leading-6">
      <strong className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--tone)]">{t('Op and runtime disagree')}</strong>{why.disagreement}
    </div> : null}
    {why.next ? <p className="m-0 flex items-start gap-2 text-sm leading-6"><ArrowRight className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true" /><span><strong className="font-medium">{t('Next step:')}</strong> {why.next}</span></p> : null}
    {why.codes.length || why.refs?.length ? <Advanced summary={t('{codes} codes · {refs} references', { codes: why.codes.length, refs: why.refs?.length ?? 0 })}>
      <div className="flex flex-col gap-3">
        <CodeChips why={why} />
        {why.refs?.length ? <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs text-muted-foreground">{why.refs.map((ref, i) => <li key={`${ref.kind}-${i}`} className="break-all">
          {ref.kind === 'check' ? `check ${ref.name} · ${ref.runner} · ${ref.status}` : ref.kind === 'commit' ? `commit ${String(ref.sha).slice(0, 12)}` : ref.kind === 'report' ? `report #${ref.reportId}` : JSON.stringify(ref)}
        </li>)}</ul> : null}
      </div>
    </Advanced> : null}
  </div>;
}
