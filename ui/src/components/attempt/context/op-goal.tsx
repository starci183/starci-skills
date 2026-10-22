import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { Advanced } from '../../motion';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { t } from '../../../i18n/t';
import { FeedbackState } from '../../feedback-state';
import { formatAbsolute } from '../../../i18n/vi';

export const concept: Concept = 'C8';

const h3 = 'm-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
type OwnedPath = { rel: string; abs: string | null };

function ownedPathsOf(attempt: AttemptDetailV3): OwnedPath[] {
  if (attempt.where?.ownedPaths?.length) return attempt.where.ownedPaths;
  return (attempt.input?.ownedPaths ?? []).map(rel => ({ rel, abs: null as string | null }));
}

function ProductsList({ produces, info }: Readonly<{ produces: string[]; info: OpInfo | null }>) {
  if (!produces.length) return <p className="m-0 text-sm text-muted-foreground">{info?.declarations?.writes ? t('The op contract declares no products.') : t('Product declarations not recorded')}</p>;
  return <ul className="m-0 flex list-none flex-col gap-1 p-0">{produces.map(item => <li key={item} className="break-all font-mono text-xs">{item}</li>)}</ul>;
}

function OwnedList({ owned, scopeKnown }: Readonly<{ owned: OwnedPath[]; scopeKnown: boolean }>) {
  if (!owned.length) return <p className="m-0 text-muted-foreground">{scopeKnown ? t('Captured write scope is empty') : t('Write scope not recorded')}</p>;
  return <div className="flex flex-col items-start gap-2">{owned.map(item => item.abs ? <PathLink key={item.rel} path={item.abs} label={item.rel} /> : <code key={item.rel} className="break-all text-xs">{item.rel}</code>)}</div>;
}

function EffectsList({ effects, info }: Readonly<{ effects: string[]; info: OpInfo | null }>) {
  if (!effects.length) return <p className="m-0 text-muted-foreground">{info?.declarations?.sideEffects ? t('no external effects') : t('External effect declarations not recorded')}</p>;
  return <ul className="m-0 list-disc pl-6 text-xs">{effects.map(item => <li key={item} className="break-words">{item}</li>)}</ul>;
}

function Description({ main, loading }: Readonly<{ main: string | null; loading: boolean }>) {
  if (main) return <p className="m-0 max-w-[80ch] whitespace-pre-line break-words text-sm leading-relaxed">{main}</p>;
  return <p className="m-0 text-sm text-muted-foreground">{loading ? t('Loading the description…') : t('No description for this op yet.')}</p>;
}

/** Shows the current operation's human purpose and declared outputs beside this dispatch's recorded write scope. */
export function OpGoalCard({ attempt, info, loading }: Readonly<{ attempt: AttemptDetailV3; info: OpInfo | null; loading: boolean }>) {
  const goalVi = info?.goal?.vi?.trim() || null;
  const goalEn = info?.goal?.en?.trim() || null;
  const main = goalVi ?? goalEn;
  const owned = ownedPathsOf(attempt);
  const produces = info?.writes ?? [];
  const effects = info?.sideEffects ?? [];
  const scopeKnown = attempt.where.scopeSource === 'contract';
  return <Card id="attempt-op-goal" concept="C8" title={t('What this op does')} hint={info?.nameVi?.trim() || info?.nameEn?.trim() || attempt.op}>
    <div className="flex min-w-0 flex-col gap-4">
      {info?.readError ? <FeedbackState error>{info.readError}</FeedbackState> : null}
      <section className="min-w-0"><h3 className="m-0 mb-2 text-sm font-medium">{t('Assignment')}</h3><p className="m-0 max-w-[80ch] whitespace-pre-line break-words text-sm leading-relaxed">{attempt.input?.what ?? t('Historical dispatch input was not recorded.')}</p><p className="mb-0 mt-2 text-xs text-muted-foreground">{attempt.dispatchContext ? t('Dispatch contract captured at {at}', { at: formatAbsolute(attempt.dispatchContext.createdAt) }) : t('Dispatch contract capture unavailable')}</p></section>
      <section className="min-w-0 border-t pt-4"><h3 className="m-0 mb-2 text-xs text-muted-foreground">{t('Current operation YAML reference')}</h3><Description main={main} loading={loading} />
      {attempt.dispatchContext?.runtimeSha ? <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('Dispatched runtime revision')}: <code>{attempt.dispatchContext.runtimeSha.slice(0, 12)}</code></p> : null}</section>
      {goalVi && goalEn ? <Advanced title={t('English version')} keepMounted><p className="m-0 whitespace-pre-wrap break-words text-sm text-muted-foreground">{goalEn}</p></Advanced> : null}
      <Advanced summary={scopeKnown ? t('{n} writable paths', { n: owned.length }) : t('Write scope not recorded')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className={h3}>{t('Declared products')}</h3>
            <ProductsList produces={produces} info={info} />
          </div>
          <div>
            <h3 className={h3}>{t('Limits')}</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('May write to')}</span>
                <OwnedList owned={owned} scopeKnown={scopeKnown} />
              </div>
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('External effects')}</span>
                <EffectsList effects={effects} info={info} />
              </div>
            </div>
          </div>
        </div>
      </Advanced>
    </div>
  </Card>;
}
