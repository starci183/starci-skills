import { useState } from 'react';
import type { LegRow } from '../../../contract';
import { PathLink } from '../../path-link';
import { legInfo } from '../pipeline/node/op-identity';
import type { Concept } from '../../concept';
import { t } from '../../../i18n/t';

export const concept: Concept = 'C4';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}

/** "What this op does" + inputs, outputs, side effects, manifest — from the op's own yaml (read-only). */
export function OpAbout({ leg }: { leg: LegRow }) {
  const info = legInfo(leg);
  const [more, setMore] = useState(false);
  if (!info) return null;
  const goalVi = info.goal.vi ?? info.goal.en;
  return <div className="mb-2">
    <Block title={t('What this op does')}>
      <p className="text-sm">{goalVi ?? t('No description for this op yet.')}</p>
      {info.goal.en && info.goal.vi ? <div className="mt-2">
        <button type="button" className="text-xs font-medium text-primary hover:underline" aria-expanded={more} onClick={() => setMore(v => !v)}>{more ? t('Hide the English original') : t('View the English original')}</button>
        {more ? <p className="mt-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">{info.goal.en}</p> : null}
      </div> : null}
    </Block>
    <Block title={t('Needs inputs')}>{info.reads.length ? <ul className="space-y-2">{info.reads.map(read => <li key={read.id} className="text-xs">
      <span className="font-mono font-semibold">{read.id}</span>{read.purpose ? <span className="block text-muted-foreground">{read.purpose}</span> : null}</li>)}</ul> : <p className="text-xs text-muted-foreground">{t('Not declared.')}</p>}</Block>
    <Block title={t('Produces')}>{info.writes.length ? <ul className="space-y-2">{info.writes.map(w => <li key={w} className="break-all font-mono text-xs">{w}</li>)}</ul> : <p className="text-xs text-muted-foreground">{t('Not declared.')}</p>}</Block>
    <Block title={t('Effects')}>{info.sideEffects.length ? <ul className="list-disc space-y-1 pl-4 text-xs">{info.sideEffects.map(e => <li key={e}>{e}</li>)}</ul> : <p className="text-xs text-muted-foreground">{t('No external effects.')}</p>}</Block>
    <Block title={t('Op manifest file')}>{info.manifest ? <PathLink path={info.manifest} kind="file" /> : <p className="text-xs text-muted-foreground">{t('None')}</p>}</Block>
    <hr className="mt-6" />
  </div>;
}
