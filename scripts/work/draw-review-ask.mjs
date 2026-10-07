// draw-review-ask.mjs — the evidence and the wording of a draw-review ask's question (draw-review.mjs, the owner).
import fs from 'node:fs';
import path from 'node:path';
import { slash } from './work-io.mjs';
import { proposalImageOf } from './grammar-proposal.mjs';
import { rationaleFileOf, rationaleSummary } from './draw/draw-rationale.mjs';

/** The annotated redline render (<part>.redline.png) kept beside each drawn part that has one. */
export function redlinesOf(dir, repoRoot, reviewed) {
  return reviewed.map((p) => ({ part: p.path, abs: path.join(dir, p.path.replace(/.png$/i, '.redline.png')), shape: p.shape, breakpoint: p.breakpoint }))
    .filter((r) => fs.existsSync(r.abs)).map((r) => ({ part: r.part, path: slash(path.relative(dir, r.abs)), repoPath: slash(path.relative(repoRoot, r.abs)), shape: r.shape, breakpoint: r.breakpoint }));
}

/** The rationale.json of each drawn part's html (one per file): every decision with its value, rule ids and reason. */
export function rationaleOf(dir, repoRoot, reviewed) {
  return [...new Map(reviewed.map((p) => {
    const file = rationaleFileOf(path.join(dir, p.path.replace(/.png$/i, '.html')));
    return file ? [file, { shape: p.shape, file: slash(path.relative(repoRoot, file)), ...rationaleSummary(file) }] : null;
  }).filter(Boolean)).values()];
}

const lineWhen = (items, line) => (items.length ? line() : '');

/** The sentences a question adds when it has something to say: the redraw round, retired images, proposals, evidence. */
export function askLines({ tr, priorRounds, answered, retired, proposals, rationale }) {
  return {
    roundLine: lineWhen(priorRounds, () => tr(' Round {n}; this redraw addresses your notes: {notes}.',
      { n: priorRounds.length + 1, notes: answered.map((n) => `[${n.id}] ${n.text}`).join(' | ') || tr('(none)') })),
    retiredLine: lineWhen(retired, () => tr(' Data-status images ({states}) are retired and not for review.', { states: retired.join(', ') })),
    proposalLine: lineWhen(proposals, () => tr(' Grammar proposals (yours to decide, never auto-accepted): {names}.', { names: proposals.map((p) => p.name).join(', ') })),
    whyLine: lineWhen(rationale, () => tr(' Evidence for every decision: the redline images (spacing, rule ids) and {list}.',
      { list: rationale.map((r) => `${r.file} ${tr('({n} decisions)', { n: r.decisions })}`).join(', ') })),
  };
}

/** The images the owner critiques from: every drawn part, its redline, and each grammar proposal's image. */
export function askAssets({ tr, dir, repoRoot, reviewed, redlines, proposals, label, bpLabel }) {
  return [...reviewed.map((p) => ({ path: slash(path.relative(repoRoot, path.join(dir, p.path))), label: label(p) })),
    ...redlines.map((r) => ({ path: r.repoPath, label: `${r.shape} - redline ${bpLabel(r.breakpoint)}` })),
    ...proposals.map((p) => [p, proposalImageOf(p)]).filter(([, img]) => img).map(([p, img]) => ({ path: slash(path.relative(repoRoot, img)), label: `${tr('proposal')} ${p.name}` }))];
}
