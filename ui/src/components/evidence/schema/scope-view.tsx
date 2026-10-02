import type { ReactNode } from 'react';
import type { Concept } from '../../concept';
import { CopyButton } from '../renderers/common';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C8';

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Rec : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);
const strs = (v: unknown): string[] => arr(v).map(x => str(x) ?? '').filter(Boolean);

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return <section className="min-w-0">
    <h4 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">{title}{count != null ? <span className="text-xs font-normal text-muted-foreground">{count}</span> : null}</h4>
    {children}
  </section>;
}
const Bullets = ({ items }: { items: string[] }) => <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm">{items.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ul>;

/** `starci/scope-evidence@1` (scope.json): what the op decided to include, own, defer and how far its effects may reach. */
export function ScopeView({ data }: { data: unknown }) {
  const root = rec(data) ?? {};
  const scope = rec(root.scope) ?? {};
  const request = rec(scope.request) ?? {};
  const nodes = arr(scope.nodes).map(rec).filter((n): n is Rec => n != null);
  const deps = arr(scope.deps).map(rec).filter((n): n is Rec => n != null);
  const exclusions = arr(scope.exclusions).map(rec).filter((n): n is Rec => n != null);
  const questions = arr(scope.openQuestions).map(q => str(q) ?? str(rec(q)?.question) ?? JSON.stringify(q));
  const digest = str(root.requestDigest);
  const verbatim = str(root.requestVerbatim);
  const prior = str(request.priorScope) ?? str(request.prior) ?? str(root.priorScope);
  const effects = strs(request.effectCeiling);
  const criteria = strs(request.completionCriteria);
  return <div className="grid min-w-0 gap-6 rounded-lg border bg-card p-4 text-sm">
    <Section title={t('The brief the op read')}>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
        {digest ? <><dt className="text-muted-foreground">{t('Brief id (digest)')}</dt><dd className="flex min-w-0 flex-wrap items-center gap-2"><code className="break-all font-mono text-xs">{digest}</code><CopyButton value={digest} /></dd></> : null}
        {str(root.scopeRecord) ? <><dt className="text-muted-foreground">{t('Scope record')}</dt><dd className="min-w-0 break-all font-mono text-xs">{str(root.scopeRecord)}</dd></> : null}
        {str(request.workflow) ? <><dt className="text-muted-foreground">Workflow</dt><dd className="min-w-0 break-all font-mono text-xs">{str(request.workflow)}{request.goalRevision != null ? ` · goal rev ${String(request.goalRevision)}` : ''}</dd></> : null}
        <dt className="text-muted-foreground">{t('Previous scope')}</dt><dd className="min-w-0 break-words">{prior ?? str(request.source) ?? t('Not recorded.')}</dd>
        {str(request.outcome) ? <><dt className="text-muted-foreground">{t('Required outcome')}</dt><dd className="min-w-0 max-w-[72ch] break-words">{str(request.outcome)}</dd></> : null}
      </dl>
      {verbatim ? <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{t('The verbatim brief')}</summary><p className="mt-2 max-w-[72ch] whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 text-xs">{verbatim}</p></details> : null}
    </Section>

    {nodes.length ? <Section title={t('Selected nodes')} count={nodes.length}>
      <ul className="grid min-w-0 gap-2 md:grid-cols-2">
        {nodes.map((n, i) => {
          const dependsOn = strs(n.dependsOn); const grounding = strs(n.grounding);
          return <li key={str(n.id) ?? i} className="min-w-0 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 break-all font-mono text-xs font-semibold">{str(n.id)}</code>{str(n.kind) ? <span className="rounded border px-1.5 text-[11px] text-muted-foreground">{str(n.kind)}</span> : null}</div>
            {str(n.purpose) ? <p className="mt-1 break-words text-muted-foreground">{str(n.purpose)}</p> : null}
            {str(n.path) ? <p className="mt-2 text-xs"><span className="text-muted-foreground">{t('Owned path:')} </span><code className="break-all font-mono">{str(n.path)}</code></p> : null}
            {dependsOn.length ? <p className="mt-1 break-all text-xs"><span className="text-muted-foreground">{t('Depends on:')} </span>{dependsOn.join(', ')}</p> : null}
            {grounding.length ? <details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">{t('Grounding ({n})', { n: grounding.length })}</summary><ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{grounding.map(g => <li key={g} className="break-all">{g}</li>)}</ul></details> : null}
          </li>;
        })}
      </ul>
    </Section> : null}

    {deps.length ? <Section title={t('Dependencies')} count={deps.length}>
      <ul className="grid gap-1 text-xs">{deps.map((d, i) => <li key={i} className="min-w-0 break-words"><code className="font-mono">{str(d.from)}</code> <span className="text-muted-foreground">{t('needs')}</span> <code className="font-mono">{str(d.to)}</code>{str(d.reason) ? <span className="text-muted-foreground"> — {str(d.reason)}</span> : null}</li>)}</ul>
    </Section> : null}

    {exclusions.length ? <Section title={t('Deferred / not done')} count={exclusions.length}>
      <ul className="grid gap-2">{exclusions.map((e, i) => <li key={i} data-tone="skipped" className="min-w-0 rounded-lg border border-dashed border-[var(--tone-line)] p-2"><strong className="break-words">{str(e.subject)}</strong>{str(e.reason) ? <p className="break-words text-muted-foreground">{str(e.reason)}</p> : null}</li>)}</ul>
    </Section> : null}

    {effects.length ? <Section title={t('Maximum allowed effects')}><Bullets items={effects} /></Section> : null}
    {criteria.length ? <Section title={t('Completion criteria')}><Bullets items={criteria} /></Section> : null}
    {questions.length ? <Section title={t('Open questions')} count={questions.length}><Bullets items={questions} /></Section> : null}
  </div>;
}
