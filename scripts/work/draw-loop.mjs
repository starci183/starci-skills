#!/usr/bin/env node
// draw-loop.mjs — the interface.draw loop (owner rulings 2026-09-27): draw -> shoot -> evaluate -> fix, up to
// allocation.drawLoop.maxRounds rounds, until EVERY machine metric passes and an independent critic scores beauty at
// least beautyMin; the best round is kept, and the owner still gives the final acceptance (draw-review.mjs).
//
//   round  --ui <ui-record-dir> --html <source.html> --base <XBase> --state <state> --viewports <WxH,WxH>
//          --repo <product repo> [--out <dir>] [--family starci] [--no-full-page] [--no-critic] [--json]
//          renders the source with draw-render into <out>/round-<n>/, runs every machine metric, then the critic
//          (scripts/work/draw-critic.mjs: a fresh `codex exec` session in a clean temp dir with only the PNGs, the
//          HTML and the product's brand.direction rubric), and records round-<n>/{source.html, <part>.png + its
//          draw-render .json, <part>.score.json, metrics.json, critique.json} and <out>/loop.json. It prints the
//          failures, the beauty, whether the round progressed and whether the loop stops; fix the source and run
//          round again until it does
//   status --out <dir> [--json]
//   finish --out <dir> [--parts <dir>] [--prompt <brief.prompt.txt>] [--json]
//          once the loop stopped: selects the BEST round (all metrics pass first, then fewest failures, then the
//          highest beauty, then the latest), installs its parts (<XBase>#<state>--<WxH>--light.{png,json,html,
//          score.json}) into --parts (default: the source's directory) and prints the ui.assets entries to record
//          verbatim (generation.loop names this loop and round). Outcome `passed`, or `blocked` with the remaining
//          failures of the best round - the worker then reports blocked with them, never pass
//   verify --ui <ui-record-dir> --repo <product repo> [--json]
//          what api settle runs: re-renders every live part of the record from its render source and re-runs every
//          machine metric itself (never the loop's self-reported numbers); exit 1 when one fails
//
// Machine metrics (each finding a code): the capture itself (DRAW_RENDER_RED: a missing font, horizontal overflow, a
// page error, a failed request), the DNA gate (scripts/checks/draw-dna.mjs), the taste metrics (draw-taste.mjs:
// DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BANDS, DRAW_TOO_MANY_BADGES), the copy/badge/action checks of draw-quality.mjs,
// the brand palette (PALETTE_OFF_BRAND, PRIMARY_ABSENT), the Grammar geometry (GEOMETRY_OFF_GRAMMAR,
// grammar-geometry.mjs), the ui-proof score (DRAW_SCORE_BELOW, ui-proof-brief.mjs --score) at every viewport, and the
// decision evidence (DRAW_RATIONALE_MISSING, scripts/checks/draw-rationale.mjs: the rationale.json beside the source,
// data-why on every element and region, every measured value covered, every rule id resolvable, a redline per part).
// A metric that cannot run is DRAW_METRICS_UNVERIFIED - a failure, never a pass.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../engine/index.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { assetsOf, flag, list, slash, workRootOf } from './work-io.mjs';
import { captureHtml, loadPlaywright, parseViewports } from './draw-render.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { anatomyFindings, dnaFindings, loadDna, proposalFilesFor, proposalNamesIn } from '../checks/draw-dna.mjs';
import { assetRequestIdsFor } from './asset-slot.mjs';
import { accentBudgetOf, drawLoopSettings, htmlTasteFindings } from '../checks/draw-taste.mjs';
import { badgesOf, commandsFrom, controlCountOf, internalCopyOf, visibleTextOf, DRAW_ACTION_MISSING, DRAW_BADGE_UNTONED, DRAW_COPY_INTERNAL, DRAW_SCORE_BELOW } from '../checks/draw-quality.mjs';
import { brandOf, brandPalette, paletteFindings } from '../checks/brand-palette.mjs';
import { parseColor } from '../checks/brand.mjs';
import { criticFor, runCritic, rubricFor } from './draw-critic.mjs';
import { archetypeOf } from './ui-archetype.mjs';
import { readProposals, proposalFilesUnder } from './grammar-proposal.mjs';
import { DRAW_LOOP_MISSING, LOOP_SCHEMA, livePartsOf, loopCoverageFindings } from '../checks/draw-loop-coverage.mjs';
import { loadRationale, measuresOf, rationaleFileOf, rationaleFindings, ruleResolver } from '../checks/draw-rationale.mjs';

export { DRAW_LOOP_MISSING, LOOP_SCHEMA, livePartsOf, loopCoverageFindings };

export const METRICS_SCHEMA = 'starci/draw-metrics@1';
export const DRAW_RENDER_RED = 'DRAW_RENDER_RED';
export const DRAW_METRICS_UNVERIFIED = 'DRAW_METRICS_UNVERIFIED';
export const DRAW_METRICS_FAILED = 'DRAW_METRICS_FAILED';
export const GEOMETRY_OFF_GRAMMAR = 'GEOMETRY_OFF_GRAMMAR';
export const LOOP_DIR = 'draw-loop';
export const STOP = Object.freeze({ passed: 'passed', maxRounds: 'max-rounds', noProgress: 'no-progress' });
export const DESKTOP_MIN_WIDTH = 768;

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };
const shaOfFile = (f) => sha256(fs.readFileSync(f));
export const breakpointOf = (viewport) => (Number(viewport?.width) >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile');
const stemOf = (png) => path.basename(png).replace(/\.png$/i, '');

// ---------------------------------------------------------------------------------------------------------
// Machine metrics
// ---------------------------------------------------------------------------------------------------------

/** The real browser-backed metrics; tests replace them. */
export const browserProbes = {
  async geometry(html, viewport, { repo, family }) {
    const { checkGeometry } = await import('../checks/grammar-geometry.mjs');
    return checkGeometry(html, { repo, family, viewport });
  },
  async score(html, viewport, { repo, family, record, recordFile }) {
    const { buildBrief, scoreRender } = await import('../checks/ui-proof-brief.mjs');
    const brief = buildBrief({ record: record ?? {}, recordFile, repo, family });
    if (!brief.geometry.ok) return { error: `the product CSS did not resolve (${list(brief.geometry.errors).join('; ')})` };
    return scoreRender(brief, html, { repo, viewport });
  },
};

const finding = (metric, code, detail, extra = {}) => ({ metric, code, detail, ...extra });

/**
 * Every machine metric of one render: `html` (the source file), `captures` [{png, record (starci/draw-render@1),
 * viewport}], `ui` {dir, record, file, state} or null. Returns the metrics document (METRICS_SCHEMA) and the ui-proof
 * scores per capture (scores: Map(png -> score)). Nothing is green by default: a metric that cannot run fails.
 */
export async function machineMetrics({ html, captures, ui = null, repo, family = null, settings = drawLoopSettings(), probes = browserProbes, proposalDirs = [], rationaleFile = undefined }) {
  const text = fs.readFileSync(html, 'utf8');
  const label = path.basename(html);
  const metrics = [];
  const scores = new Map();
  const push = (id, findings, measured = undefined) => metrics.push({ id, ok: findings.length === 0, findings, ...(measured !== undefined ? { measured } : {}) });

  // 1. The capture itself.
  push('render', captures.flatMap((c) => (c.record && c.record.ok !== false ? [] : [finding('render', DRAW_RENDER_RED, `${stemOf(c.png)}: ${c.record ? `red capture (${list(c.record.failures).join(', ')})` : 'no draw-render record'}`)])));

  // 2. DNA: every element a DNA component, notices Alert, ratios Meter.
  const proposalFiles = proposalFilesFor(html, [...proposalDirs, ...(ui?.dir ? [ui.dir] : [])]);
  const proposals = proposalNamesIn(proposalFiles);
  // The anatomy each capture measured (draw-render record `anatomy`): the real HeroUI Alert and the full-width h-2 Meter track.
  const measuredAnatomy = captures.flatMap((c) => anatomyFindings(c.record?.anatomy, { label: stemOf(c.png) })).map((f) => finding('dna', f.code, f.detail));
  const assetRequests = assetRequestIdsFor(html, [...proposalDirs, ...(ui?.dir ? [ui.dir] : [])]);
  push('dna', [...dnaFindings(text, { dna: loadDna({ family: family ?? undefined }), proposals, label, assetRequests }).map((f) => finding('dna', f.code, f.detail, { count: f.count })), ...measuredAnatomy],
    { proposals: readProposals(proposalFiles).map((p) => ({ name: p.name, complete: p.complete, missing: p.missing })) });

  // 3. Taste: bands per card, badges per entity (html), accent share (every capture).
  push('taste', htmlTasteFindings(text, { settings, label }).map((f) => finding('taste', f.code, f.detail, { count: f.count })));
  const workRoot = ui?.dir ? workRootOf(ui.dir) : null;
  const brand = workRoot ? brandOf(workRoot) : { brand: null };
  const palette = brand.brand ? brandPalette(brand.brand) : null;
  const primary = palette?.primary?.hex ? parseColor(palette.primary.hex) : null;
  const accentMeasured = [];
  const accentFindings = [];
  for (const c of captures) {
    const r = accentBudgetOf(c.png, { html: text, accent: null, settings, label: stemOf(c.png) });
    const fallback = r.accent == null && primary ? accentBudgetOf(c.png, { accent: primary, settings, label: stemOf(c.png) }) : null;
    const got = fallback ?? r;
    accentMeasured.push({ part: stemOf(c.png), accent: got.accent, share: got.share });
    if (got.finding) accentFindings.push(finding('accent', got.finding.code, got.finding.detail));
  }
  push('accent', accentFindings, accentMeasured);

  // 4. Copy, badges, commands (draw-quality.mjs).
  const quality = [];
  const leaks = internalCopyOf(visibleTextOf(text));
  if (leaks.length) quality.push(finding('quality', DRAW_COPY_INTERNAL, `${label} shows internal copy: ${leaks.slice(0, 5).map((l) => `"${l.match}" (${l.why})`).join('; ')}`));
  for (const b of badgesOf(text)) if (!b.tone) quality.push(finding('quality', DRAW_BADGE_UNTONED, `${label} badge "${b.text}" binds no tone token`));
  if (ui?.record && ui.state) {
    const commands = commandsFrom(ui.record, ui.state);
    const controls = controlCountOf(text);
    if (commands.length && controls < commands.length) quality.push(finding('quality', DRAW_ACTION_MISSING, `${ui.state} is left by ${commands.length} command(s) (${commands.map((c) => c.id ?? c.trigger).join(', ')}) but the render draws ${controls} control(s)`));
  }
  push('quality', quality);

  // 5. Brand palette on every capture.
  push('palette', brand.brand ? captures.flatMap((c) => paletteFindings({ file: c.png, shownAs: stemOf(c.png), brand: brand.brand, palette, subject: 'drawn part', at: c.png })
    .filter((f) => f.level === 'refuse').map((f) => finding('palette', f.code, f.message))) : []);

  // 6 + 7. Grammar geometry and the ui-proof score at every viewport (browser-backed; unavailable is a failure).
  const geometry = [], score = [];
  for (const c of captures) {
    const viewport = { width: c.viewport.width, height: c.viewport.height };
    let g = null, s = null;
    try { g = await probes.geometry(html, viewport, { repo, family }); } catch (error) { g = { error: String(error?.message ?? error) }; }
    if (!g || g.error) geometry.push(finding('geometry', DRAW_METRICS_UNVERIFIED, `grammar-geometry could not run at ${viewport.width}x${viewport.height}: ${g?.error ?? 'no result'}`));
    else for (const f of list(g.findings)) geometry.push(finding('geometry', f.code ?? GEOMETRY_OFF_GRAMMAR, `${viewport.width}x${viewport.height} ${f.element ?? ''} ${f.at ?? ''} ${f.property ?? ''} is ${f.got ?? '?'}, the grammar renders ${f.expected ?? '?'}`.replace(/\s+/g, ' ').trim()));
    try { s = await probes.score(html, viewport, { repo, family, record: ui?.record ?? null, recordFile: ui?.file ?? null }); } catch (error) { s = { error: String(error?.message ?? error) }; }
    if (!s || s.error) score.push(finding('score', DRAW_METRICS_UNVERIFIED, `ui-proof-brief --score could not run at ${viewport.width}x${viewport.height}: ${s?.error ?? 'no result'}`));
    else {
      scores.set(c.png, s);
      const failed = [...list(s.spacing), ...list(s.cases)].filter((x) => x?.status === 'fail').map((x) => x.id ?? `${x.rule} ${x.case}`);
      if ((s.summary?.fail ?? failed.length) > 0) score.push(finding('score', DRAW_SCORE_BELOW, `${viewport.width}x${viewport.height} scores ${s.summary?.pass ?? '?'} pass / ${s.summary?.fail ?? failed.length} fail: ${failed.slice(0, 8).join('; ')}`, { count: failed.length }));
    }
  }
  push('geometry', geometry);
  push('score', score);

  // 8. Evidence for every decision (owner ruling 2026-09-27): rationale.json, data-why, measured values, rule ids, redlines.
  const whyFile = rationaleFile === undefined ? rationaleFileOf(html) : rationaleFile;
  const why = loadRationale(whyFile);
  const whyRoot = ui?.dir ? workRootOf(ui.dir) : null;
  const redlines = captures.map((c) => ({ part: stemOf(c.png), ok: Boolean(c.record?.redline?.path && isFile(c.record.redline.path)) }));
  push('rationale', rationaleFindings({ html: text, entries: why.entries, errors: why.errors, measures: measuresOf(captures.map((c) => c.record)), resolve: ruleResolver({ workRoot: whyRoot, record: ui?.record ?? null, repoRoot: repo ?? null }),
    record: ui?.record ?? null, label, redlines }).map((f) => finding('rationale', f.code, f.detail, { count: f.count })), whyFile ? { file: path.basename(whyFile), decisions: why.entries.length } : { file: null });

  const failures = metrics.flatMap((m) => m.findings);
  return {
    doc: { schema: METRICS_SCHEMA, html: path.basename(html), htmlSha256: sha256(text), viewports: captures.map((c) => ({ width: c.viewport.width, height: c.viewport.height, part: stemOf(c.png) })),
      metrics, failures: failures.length, codes: [...new Set(failures.map((f) => f.code))].sort(), allPass: failures.length === 0 },
    scores,
  };
}

// ---------------------------------------------------------------------------------------------------------
// The loop record
// ---------------------------------------------------------------------------------------------------------

export const loopFileOf = (out) => path.join(out, 'loop.json');
export const defaultOutOf = (uiDir, base, state) => path.join(uiDir, 'assets', 'directions', LOOP_DIR, `${base}--${state}`);

export function readLoop(out) {
  const doc = readJson(loopFileOf(out));
  return doc?.schema === LOOP_SCHEMA ? doc : null;
}

/** Rank rounds: every metric passing first, then fewest failures, then highest beauty, then the latest. */
export function bestRound(rounds) {
  const b = (r) => (Number.isFinite(r.beauty) ? r.beauty : -1);
  return [...list(rounds)].sort((x, y) => (Number(y.allPass) - Number(x.allPass)) || (x.failures - y.failures) || (b(y) - b(x)) || (y.n - x.n))[0] ?? null;
}

/** Whether round `r` progressed on every earlier round: fewer failures than the best so far, or a higher beauty. */
export function progressed(r, earlier) {
  if (!earlier.length) return true;
  const fewest = Math.min(...earlier.map((e) => e.failures));
  const beauty = Math.max(...earlier.map((e) => (Number.isFinite(e.beauty) ? e.beauty : -1)));
  return r.failures < fewest || (Number.isFinite(r.beauty) && r.beauty > beauty);
}

/** Why the loop stops after its last round, or null. */
export function stopOf(rounds, settings) {
  const last = rounds[rounds.length - 1];
  if (!last) return null;
  if (last.allPass && !last.ownerFailed?.length && Number.isFinite(last.beauty) && last.beauty >= Number(settings.beautyMin)) return { reason: STOP.passed, atRound: last.n };
  if (rounds.length >= Number(settings.maxRounds)) return { reason: STOP.maxRounds, atRound: last.n };
  const stall = Number(settings.stallRounds);
  if (rounds.length > stall && rounds.slice(-stall).every((r) => r.progress === false)) return { reason: STOP.noProgress, atRound: last.n };
  return null;
}

async function defaultRender({ html, out, viewports, name, fullPage, repo = null }) {
  // Playwright is the product's own install (draw-render.mjs): from the source's directory, the product repo, the cwd.
  const playwright = loadPlaywright([path.dirname(html), ...(repo ? [repo] : []), process.cwd()]);
  const source = { mode: 'html', html: { path: html, sha256: shaOfFile(html) } };
  return captureHtml({ html, out, viewports, theme: 'light', fullPage, name, source, playwright });
}

const loadUi = (uiDir) => {
  if (!uiDir) return null;
  const file = path.join(uiDir, 'index.yaml');
  let record = null;
  try { record = parseYaml(fs.readFileSync(file, 'utf8')); } catch { record = null; }
  return { dir: uiDir, file, record };
};

/**
 * One round of the loop. Options: {ui, html, base, state, viewports:[{width,height}], repo, out?, family?, fullPage?,
 * critic? (false: no critic), render? probes? criticRunner? (tests)}. Returns {loop, round, stop}.
 */
export async function runRound(o) {
  const settings = o.settings ?? drawLoopSettings();
  const html = path.resolve(o.html);
  if (!isFile(html)) throw Error(`${o.html} does not exist`);
  const uiDir = o.ui ? path.resolve(o.ui) : null;
  const out = path.resolve(o.out ?? defaultOutOf(uiDir ?? path.dirname(html), o.base, o.state));
  const name = `${o.base}#${o.state}`;
  let loop = readLoop(out);
  if (loop && (loop.base !== o.base || loop.state !== o.state)) throw Error(`${out} is the loop of ${loop.base}#${loop.state}, not ${name}`);
  if (loop?.stop) throw Error(`the loop stopped at round ${loop.stop.atRound} (${loop.stop.reason}): run finish`);
  const ui = loadUi(uiDir);
  const archetype = ui?.record ? archetypeOf(ui.record) : null;
  // Paths are relative to the loop directory, so the record reads the same from any checkout.
  loop ??= { schema: LOOP_SCHEMA, base: o.base, state: o.state, ui: uiDir ? slash(path.relative(out, uiDir)) || '.' : null,
    source: slash(path.relative(out, html)), viewports: o.viewports, archetype: archetype?.archetype ?? null,
    settings: { maxRounds: settings.maxRounds, stallRounds: settings.stallRounds, beautyMin: settings.beautyMin, accentBudget: settings.accentBudget, bandsPerCardMax: settings.bandsPerCardMax, badgesPerEntityMax: settings.badgesPerEntityMax },
    rounds: [], stop: null, best: null, outcome: null };
  const n = loop.rounds.length + 1;
  const roundDir = path.join(out, `round-${n}`);
  fs.mkdirSync(roundDir, { recursive: true });
  const records = await (o.render ?? defaultRender)({ html, out: roundDir, viewports: o.viewports, name, fullPage: o.fullPage !== false, repo: o.repo ?? null });
  fs.copyFileSync(html, path.join(roundDir, 'source.html'));
  const whyFile = rationaleFileOf(html);
  if (whyFile) fs.copyFileSync(whyFile, path.join(roundDir, 'rationale.json'));
  const captures = records.map((r) => ({ png: r.image.path, record: r, viewport: { width: r.viewport.width, height: r.viewport.height } }));
  const { doc: metrics, scores } = await machineMetrics({ html, captures, ui: ui ? { ...ui, state: o.state } : null, repo: o.repo, family: o.family ?? null, settings, probes: o.probes ?? browserProbes, proposalDirs: [out] });
  metrics.round = n;
  for (const [png, s] of scores) writeJson(png.replace(/\.png$/i, '.score.json'), s);
  writeJson(path.join(roundDir, 'metrics.json'), metrics);

  let critique = null;
  if (o.critic !== false) {
    const { rubric, ownerChecks } = rubricFor({ workRoot: uiDir ? workRootOf(uiDir) : null, archetype: archetype?.archetype ?? null, record: ui?.record ?? null, shape: name });
    // The owner's notes this shape must address ride as gate checks (draw-feedback.mjs); the loop records which.
    if (ownerChecks.length) loop.ownerChecks = ownerChecks;
    // The critic is a different model from the drawer (owner ruling 2026-09-27): --drawer, else the op's provider.
    const drawer = o.drawer ?? process.env.STARCI_OP_PROVIDER ?? null;
    const pick = criticFor(settings, drawer);
    critique = pick.error
      ? { schema: 'starci/draw-critique@1', critic: { drawer, independent: false }, verdict: null, error: pick.error }
      : await runCritic({ images: captures.map((c) => ({ path: c.png, label: `${breakpointOf(c.viewport)} ${c.viewport.width}px` })), html, rubric, critic: pick.critic, runner: o.criticRunner ?? null });
    critique.critic.drawer = drawer;
    critique.round = n;
    writeJson(path.join(roundDir, 'critique.json'), critique);
  }
  const beauty = critique?.verdict?.beauty ?? null;
  const round = { n, dir: `round-${n}`, at: new Date().toISOString(), htmlSha256: metrics.htmlSha256, failures: metrics.failures, codes: metrics.codes, allPass: metrics.allPass,
    beauty, criticFailed: critique?.verdict?.failed ?? null, ...(loop.ownerChecks?.length ? { ownerFailed: loop.ownerChecks.filter((id) => critique?.verdict?.checks?.find((c) => c.id === id)?.pass !== true) } : {}), critic: critique ? { model: critique.critic.model, independent: critique.critic.independent, error: critique.error ?? null } : null,
    parts: captures.map((c) => ({ part: stemOf(c.png), width: c.viewport.width, height: c.viewport.height, sha256: c.record?.image?.sha256 ?? shaOfFile(c.png) })) };
  round.progress = progressed(round, loop.rounds);
  loop.rounds.push(round);
  loop.stop = stopOf(loop.rounds, settings);
  loop.best = bestRound(loop.rounds)?.n ?? null;
  writeJson(loopFileOf(out), loop);
  return { out, loop, round, metrics, critique, stop: loop.stop };
}

/**
 * Finish a stopped loop: pick the best round, install its parts and report the outcome. Returns {outcome: passed|
 * blocked, best, remaining, installed, assets}.
 */
export function finishLoop({ out, parts = null, prompt = null, repo = null, settings = drawLoopSettings(), force = false }) {
  const loop = readLoop(out);
  if (!loop) throw Error(`${out} holds no draw loop (loop.json)`);
  if (!loop.rounds.length) throw Error('the loop has no round');
  if (!loop.stop && !force) throw Error(`the loop has not stopped (round ${loop.rounds.length} of at most ${settings.maxRounds}): fix the source and run another round`);
  const best = bestRound(loop.rounds);
  const roundDir = path.join(out, best.dir);
  const metrics = readJson(path.join(roundDir, 'metrics.json'));
  const passed = best.allPass && !best.ownerFailed?.length && Number.isFinite(best.beauty) && best.beauty >= Number(settings.beautyMin);
  const source = path.resolve(out, loop.source);
  const partsDir = path.resolve(parts ?? path.dirname(source));
  fs.mkdirSync(partsDir, { recursive: true });
  const installed = [];
  const uiDir = loop.ui != null ? path.resolve(out, loop.ui) : null;
  const relTo = uiDir ?? partsDir;
  const promptPath = prompt ? slash(path.relative(relTo, path.resolve(prompt))) : slash(path.relative(relTo, source.replace(/\.html?$/i, '.prompt.txt')));
  const loopRel = slash(path.relative(relTo, loopFileOf(out)));
  const assets = [];
  for (const p of best.parts) {
    const from = path.join(roundDir, `${p.part}.png`);
    const to = path.join(partsDir, `${p.part}.png`);
    fs.copyFileSync(from, to);
    for (const ext of ['.json', '.score.json']) { const f = path.join(roundDir, `${p.part}${ext}`); if (isFile(f)) fs.copyFileSync(f, path.join(partsDir, `${p.part}${ext}`)); }
    fs.copyFileSync(path.join(roundDir, 'source.html'), path.join(partsDir, `${p.part}.html`));
    // The decision evidence travels with the part: <part>.rationale.json and the annotated <part>.redline.png.
    const why = path.join(roundDir, 'rationale.json'), red = path.join(roundDir, `${p.part}.redline.png`);
    if (isFile(why)) fs.copyFileSync(why, path.join(partsDir, `${p.part}.rationale.json`));
    if (isFile(red)) fs.copyFileSync(red, path.join(partsDir, `${p.part}.redline.png`));
    const sha = shaOfFile(to);
    installed.push({ path: slash(path.relative(relTo, to)), sha256: sha, html: slash(path.relative(relTo, path.join(partsDir, `${p.part}.html`))) });
    assets.push({ path: slash(path.relative(relTo, to)), role: 'direction-content', breakpoint: breakpointOf(p), theme: 'light', sha256: sha,
      generation: { tool: 'draw-render', promptPath, mode: 'draw-loop', loop: { path: loopRel, round: best.n } } });
    assets.push({ path: slash(path.relative(relTo, path.join(partsDir, `${p.part}.html`))), role: 'render-source' });
    for (const [ext, role] of [['.rationale.json', 'rationale'], ['.redline.png', 'direction-redline']]) {
      const f = path.join(partsDir, `${p.part}${ext}`);
      if (isFile(f)) assets.push({ path: slash(path.relative(relTo, f)), role, breakpoint: breakpointOf(p), theme: 'light', sha256: shaOfFile(f) });
    }
  }
  const remaining = passed ? [] : [
    ...list(metrics?.metrics).flatMap((m) => m.findings.map((f) => ({ code: f.code, detail: f.detail }))),
    ...(Number.isFinite(best.beauty) && best.beauty >= Number(settings.beautyMin) ? [] : [{ code: 'DRAW_BEAUTY_BELOW', detail: `the critic scored beauty ${best.beauty ?? 'nothing'} (at least ${settings.beautyMin} is the bar)` }]),
    ...(best.ownerFailed?.length ? [{ code: 'DRAW_FEEDBACK_UNADDRESSED', detail: `the critic fails the owner's note(s) ${best.ownerFailed.join(', ')} (draw-feedback.mjs brief lists them)` }] : []),
  ];
  loop.outcome = passed ? 'passed' : 'blocked';
  loop.remaining = remaining.slice(0, 50);
  loop.installed = installed;
  loop.finishedAt = new Date().toISOString();
  if (!loop.stop) loop.stop = { reason: 'finished-early', atRound: loop.rounds.length };
  writeJson(loopFileOf(out), loop);
  const proposals = readProposals([...new Set([...proposalFilesUnder(out, 3), ...proposalFilesFor(source), ...(uiDir ? proposalFilesUnder(uiDir, 1) : [])])]);
  return { outcome: loop.outcome, stop: loop.stop, best: { n: best.n, failures: best.failures, beauty: best.beauty, codes: best.codes }, remaining, installed, assets,
    grammarProposals: proposals.map((p) => ({ name: p.name, complete: p.complete, file: p.file })) };
}

// ---------------------------------------------------------------------------------------------------------
// Settle: every live part re-rendered and re-measured by the runtime
// ---------------------------------------------------------------------------------------------------------

/**
 * Re-render every live part of a ui record from its render source and re-run every machine metric. Returns
 * {findings:[{code, path, detail, codes}], parts:[{part, failures, codes}]}. `render`/`probes` are injectable.
 */
export async function verifyRecordParts({ recordDir, record = null, repo, family = null, settings = drawLoopSettings(), render = null, probes = browserProbes, tmpRoot = os.tmpdir() }) {
  const ui = loadUi(recordDir);
  const rec = record ?? ui.record;
  const findings = [], parts = [];
  const byHtml = new Map();
  for (const p of livePartsOf(recordDir, rec)) {
    const at = slash(path.relative(repo, p.png));
    if (!p.html || !p.viewport) { findings.push({ code: DRAW_METRICS_UNVERIFIED, path: at, detail: `${p.asset.path} has no ${p.html ? 'viewport (draw-render record or <WxH> in its name)' : 'render source (.html) beside it'}: the runtime cannot re-measure it` }); continue; }
    const key = shaOfFile(p.html);
    if (!byHtml.has(key)) byHtml.set(key, { html: p.html, parts: [] });
    byHtml.get(key).parts.push(p);
  }
  for (const { html, parts: group } of byHtml.values()) {
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'starci-draw-verify-'));
    try {
      const state = String(group[0].asset.path.split('/').pop().split('--')[0]).split('#').pop();
      const base = String(group[0].asset.path.split('/').pop().split('--')[0]).split('#')[0] || 'part';
      // The source is rendered where it lives (its relative assets resolve), into a temp dir.
      const viewports = [...new Map(group.map((p) => [`${p.viewport.width}x${p.viewport.height}`, p.viewport])).values()];
      let records;
      try { records = await (render ?? defaultRender)({ html, out: dir, viewports, name: `${base}#${state}`.replace(/[^\w.#-]/g, '-'), fullPage: true, repo }); }
      catch (error) { findings.push({ code: DRAW_METRICS_UNVERIFIED, path: slash(path.relative(repo, html)), detail: `the runtime could not re-render ${path.basename(html)}: ${String(error?.message ?? error).split('\n')[0]}` }); continue; }
      const captures = records.map((r) => ({ png: r.image.path, record: r, viewport: { width: r.viewport.width, height: r.viewport.height } }));
      const { doc } = await machineMetrics({ html, captures, ui: { ...ui, record: rec, state }, repo, family, settings, probes });
      parts.push({ html: slash(path.relative(repo, html)), failures: doc.failures, codes: doc.codes });
      if (!doc.allPass) {
        const all = doc.metrics.flatMap((m) => m.findings);
        findings.push({ code: all.every((f) => f.code === DRAW_METRICS_UNVERIFIED) ? DRAW_METRICS_UNVERIFIED : DRAW_METRICS_FAILED, path: slash(path.relative(repo, html)), codes: doc.codes,
          detail: `re-measured by the runtime, ${path.basename(html)} fails ${doc.failures} machine metric finding(s) (${doc.codes.join(', ')}): ${all.slice(0, 4).map((f) => f.detail).join(' | ').slice(0, 900)}` });
      }
    } finally {
      safeRemoveTree(dir);
    }
  }
  return { findings, parts };
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

const USAGE = `use:
  node scripts/work/draw-loop.mjs round --ui <ui-record-dir> --html <source.html> --base <XBase> --state <state> --viewports <WxH,WxH> --repo <product repo> [--out <dir>] [--family starci] [--drawer <provider>] [--no-full-page] [--no-critic] [--json]
  node scripts/work/draw-loop.mjs status --out <dir> [--json]
  node scripts/work/draw-loop.mjs finish --out <dir> [--parts <dir>] [--prompt <brief.prompt.txt>] [--repo <product repo>] [--json]
  node scripts/work/draw-loop.mjs verify --ui <ui-record-dir> --repo <product repo> [--json]
`;

export async function drawLoopMain(argv) {
  const [cmd, ...rest] = argv;
  const json = rest.includes('--json');
  const say = (obj, text) => (json ? `${JSON.stringify(obj, null, 2)}\n` : `${text}\n`);
  if (cmd === 'round') {
    for (const k of ['--html', '--base', '--state', '--viewports', '--repo']) if (!flag(rest, k)) return { code: 2, text: `${k} is required\n${USAGE}` };
    const r = await runRound({ ui: flag(rest, '--ui'), html: flag(rest, '--html'), base: flag(rest, '--base'), state: flag(rest, '--state'), viewports: parseViewports(flag(rest, '--viewports')),
      repo: path.resolve(flag(rest, '--repo')), out: flag(rest, '--out'), family: flag(rest, '--family'), fullPage: !rest.includes('--no-full-page'), critic: rest.includes('--no-critic') ? false : undefined, drawer: flag(rest, '--drawer') ?? undefined });
    const next = r.stop ? `the loop stopped (${r.stop.reason}): node scripts/work/draw-loop.mjs finish --out ${r.out}` : 'fix the source against metrics.json and critique.json, then run round again';
    const lines = [`round ${r.round.n}: ${r.round.failures} machine failure(s)${r.round.codes.length ? ` [${r.round.codes.join(', ')}]` : ''}; beauty ${r.round.beauty ?? '-'}${r.critique?.error ? ` (critic: ${r.critique.error.slice(0, 160)})` : ''}; ${r.round.progress ? 'progress' : 'NO progress'}; best round ${r.loop.best}`,
      ...r.metrics.metrics.filter((m) => !m.ok).flatMap((m) => m.findings.slice(0, 3).map((f) => `  [${f.code}] ${f.detail.slice(0, 300)}`)),
      ...(r.critique?.verdict ? r.critique.verdict.checks.filter((c) => !c.pass).slice(0, 8).map((c) => `  critic ${c.id}: ${c.evidence}${c.fix ? ` -> ${c.fix}` : ''}`) : []),
      `next: ${next}`];
    return { code: 0, text: say({ out: r.out, round: r.round, stop: r.stop, best: r.loop.best, next }, lines.join('\n')) };
  }
  if (cmd === 'status') {
    const out = flag(rest, '--out');
    const loop = out ? readLoop(path.resolve(out)) : null;
    if (!loop) return { code: 2, text: `no draw loop at ${out}\n${USAGE}` };
    return { code: 0, text: say(loop, [`${loop.base}#${loop.state}: ${loop.rounds.length} round(s), best ${loop.best}, stop ${loop.stop ? loop.stop.reason : '-'}, outcome ${loop.outcome ?? '-'}`,
      ...loop.rounds.map((r) => `  round ${r.n}: failures ${r.failures}, beauty ${r.beauty ?? '-'}${r.progress ? '' : ' (no progress)'}`)].join('\n')) };
  }
  if (cmd === 'finish') {
    const out = flag(rest, '--out');
    if (!out) return { code: 2, text: USAGE };
    const r = finishLoop({ out: path.resolve(out), parts: flag(rest, '--parts'), prompt: flag(rest, '--prompt'), repo: flag(rest, '--repo') ? path.resolve(flag(rest, '--repo')) : null, force: rest.includes('--force') });
    return { code: r.outcome === 'passed' ? 0 : 1, text: say(r, [`outcome ${r.outcome}: best round ${r.best.n} (failures ${r.best.failures}, beauty ${r.best.beauty ?? '-'})`,
      ...r.remaining.slice(0, 12).map((f) => `  remaining [${f.code}] ${String(f.detail).slice(0, 240)}`),
      ...r.grammarProposals.map((p) => `  grammar proposal ${p.name}${p.complete ? '' : ' (INCOMPLETE)'} - the owner is asked through the draw-review ask`),
      'record these ui.assets entries verbatim:', ...r.assets.map((a) => `  - ${JSON.stringify(a)}`),
      r.outcome === 'passed' ? 'then file the draw-review ask (draw-review.mjs question)' : 'report outcome blocked naming these remaining failures and the best round - never pass'].join('\n')) };
  }
  if (cmd === 'verify') {
    const ui = flag(rest, '--ui'), repo = flag(rest, '--repo');
    if (!ui || !repo) return { code: 2, text: USAGE };
    const r = await verifyRecordParts({ recordDir: path.resolve(ui), repo: path.resolve(repo) });
    return { code: r.findings.length ? 1 : 0, text: say(r, `${r.findings.length ? 'REFUSED' : 'ok'}: ${r.parts.length} render source(s) re-measured\n${r.findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}`) };
  }
  return { code: 2, text: USAGE };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  drawLoopMain(process.argv.slice(2)).then((r) => { process.stdout.write(r.text); process.exitCode = r.code; }, (error) => { process.stderr.write(`draw-loop: ${error?.message ?? error}\n`); process.exitCode = 2; });
}
