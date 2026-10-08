import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { Advanced } from '../../motion';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { t } from '../../../i18n/t';
import { FeedbackState } from '../../feedback-state';

export const concept: Concept = 'C8';

/** Shows the current operation's human purpose and declared outputs beside this dispatch's recorded write scope. */
export function OpGoalCard({ attempt, info, loading }: Readonly<{ attempt: AttemptDetailV3; info: OpInfo | null; loading: boolean }>) {
  const goalVi = info?.goal?.vi?.trim() || null;
  const goalEn = info?.goal?.en?.trim() || null;
  const main = goalVi ?? goalEn;
  const owned = attempt.where?.ownedPaths?.length ? attempt.where.ownedPaths : (attempt.input?.ownedPaths ?? []).map(rel => ({ rel, abs: null as string | null }));
  const produces = info?.writes ?? [];
  const effects = info?.sideEffects ?? [];
  const scopeKnown = attempt.where.scopeSource === 'contract';
  const h3 = 'm-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  return <Card id="attempt-op-goal" concept="C8" title={t('What this op does')} hint={info?.nameVi?.trim() || info?.nameEn?.trim() || attempt.op}>
    <div className="flex min-w-0 flex-col gap-4">
      {info?.readError ? <FeedbackState error>{info.readError}</FeedbackState> : null}
      {main ? <p className="m-0 max-w-[72ch] text-base leading-relaxed">{main}</p> : <p className="m-0 text-sm text-muted-foreground">{loading ? t('Loading the description…') : t('No description for this op yet.')}</p>}
      <p className="m-0 text-xs text-muted-foreground">{t('Current operation YAML reference')}{attempt.dispatchContext?.runtimeSha ? <> · {t('Dispatched runtime revision')}: <code>{attempt.dispatchContext.runtimeSha.slice(0, 12)}</code></> : null}</p>
      {goalVi && goalEn ? <details className="text-sm"><summary className="cursor-pointer text-xs text-muted-foreground">{t('English version')}</summary><p className="mb-0 mt-2 whitespace-pre-wrap break-words text-muted-foreground">{goalEn}</p></details> : null}
      <Advanced summary={scopeKnown ? t('{n} writable paths', { n: owned.length }) : t('Write scope not recorded')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className={h3}>{t('Declared products')}</h3>
            {produces.length ? <ul className="m-0 flex list-none flex-col gap-1 p-0">{produces.map(item => <li key={item} className="break-all font-mono text-xs">{item}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">{info?.declarations?.writes ? t('The op contract declares no products.') : t('Product declarations not recorded')}</p>}
          </div>
          <div>
            <h3 className={h3}>{t('Limits')}</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('May write to')}</span>
                {owned.length ? <div className="flex flex-col items-start gap-2">{owned.map(item => item.abs ? <PathLink key={item.rel} path={item.abs} label={item.rel} /> : <code key={item.rel} className="break-all text-xs">{item.rel}</code>)}</div> : <p className="m-0 text-muted-foreground">{scopeKnown ? t('Captured write scope is empty') : t('Write scope not recorded')}</p>}
              </div>
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('External effects')}</span>
                {effects.length ? <ul className="m-0 list-disc pl-6 text-xs">{effects.map(item => <li key={item} className="break-words">{item}</li>)}</ul> : <p className="m-0 text-muted-foreground">{info?.declarations?.sideEffects ? t('no external effects') : t('External effect declarations not recorded')}</p>}
              </div>
            </div>
          </div>
        </div>
      </Advanced>
    </div>
  </Card>;
}
