import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { Advanced } from '../../motion';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C8';

/** Block 2 "What this op does": the Vietnamese goal, what it must produce, its limits. `info` is null while loading or when the op has no yaml. */
export function OpGoalCard({ attempt, info, loading }: { attempt: AttemptDetailV3; info: OpInfo | null; loading: boolean }) {
  const goalVi = info?.goal?.vi ?? null;
  const goalEn = info?.goal?.en ?? null;
  const main = goalVi ?? goalEn;
  const owned = attempt.where?.ownedPaths?.length ? attempt.where.ownedPaths : (attempt.input?.ownedPaths ?? []).map(rel => ({ rel, abs: null as string | null }));
  const produces = info?.writes ?? [];
  const effects = info?.sideEffects ?? [];
  const h3 = 'm-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  return <Card id="attempt-op-goal" concept="C8" title={t('What this op does')} hint={info?.nameEn ?? undefined}>
    <div className="flex min-w-0 flex-col gap-4">
      {main ? <p className="m-0 max-w-[72ch] text-base leading-relaxed">{main}</p> : <p className="m-0 text-sm text-muted-foreground">{loading ? t('Loading the description…') : t('No description for this op yet.')}</p>}
      {goalVi && goalEn ? <details className="text-sm"><summary className="cursor-pointer text-xs text-muted-foreground">{t('English version')}</summary><p className="mb-0 mt-2 whitespace-pre-wrap break-words text-muted-foreground">{goalEn}</p></details> : null}
      <Advanced summary={t('{n} declared products · {limits}', { n: produces.length, limits: owned.length ? t('{n} writable paths', { n: owned.length }) : t('no path limit') })}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className={h3}>{t('Must produce')}</h3>
            {produces.length ? <ul className="m-0 flex list-none flex-col gap-1 p-0">{produces.map(item => <li key={item} className="break-all font-mono text-xs">{item}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">{t('The op contract declares no products.')}</p>}
          </div>
          <div>
            <h3 className={h3}>{t('Limits')}</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('May write to')}</span>
                {owned.length ? <div className="flex flex-col items-start gap-2">{owned.map(item => item.abs ? <PathLink key={item.rel} path={item.abs} label={item.rel} /> : <code key={item.rel} className="break-all text-xs">{item.rel}</code>)}</div> : <p className="m-0 text-muted-foreground">{t('No dedicated-path limit.')}</p>}
              </div>
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t('External effects')}</span>
                {effects.length ? <ul className="m-0 list-disc pl-6 text-xs">{effects.map(item => <li key={item} className="break-words">{item}</li>)}</ul> : <p className="m-0 text-muted-foreground">{t('no external effects')}</p>}
              </div>
            </div>
          </div>
        </div>
      </Advanced>
    </div>
  </Card>;
}
