// draw-loop-groups.mjs — how the settle re-measure (scripts/work/draw-loop.mjs verifyRecordParts) sorts a ui record's live
// parts: every part rendered from the same draw source (plus fixture) or the same html source is measured once.
import path from 'node:path';
import { livePartsOf } from './draw/draw-loop-coverage.mjs';
import { DRAW_METRICS_UNVERIFIED } from './draw-loop-metrics.mjs';
import { sha256File, slash } from './work-io.mjs';

const addToGroup = (groups, key, seed, part) => {
  if (!groups.has(key)) groups.set(key, { ...seed, parts: [] });
  groups.get(key).parts.push(part);
};

const unmeasurableDetail = (p) => `${p.asset.path} has no ${p.html ? 'viewport (draw-render record or <WxH> in its name)' : 'render source (.html) beside it'}: the runtime cannot re-measure it`;

/** {byDraw, byHtml}: Maps of the groups to re-measure; a part with neither source nor viewport is an unverified finding pushed to `findings`. */
export function groupLiveParts({ recordDir, rec, repo, findings }) {
  const byHtml = new Map();
  const byDraw = new Map();
  for (const p of livePartsOf(recordDir, rec)) {
    const at = slash(path.relative(repo, p.png));
    // A real-component part (<part>.draw.tsx + <part>.fixture.json beside it) is re-measured from its draw source.
    if (p.source && p.viewport) {
      addToGroup(byDraw, `${sha256File(p.source)}|${p.fixture ? sha256File(p.fixture) : ''}`, { source: p.source, fixture: p.fixture }, p);
      continue;
    }
    if (!p.html || !p.viewport) { findings.push({ code: DRAW_METRICS_UNVERIFIED, path: at, detail: unmeasurableDetail(p) }); continue; }
    addToGroup(byHtml, sha256File(p.html), { html: p.html }, p);
  }
  return { byDraw, byHtml };
}
