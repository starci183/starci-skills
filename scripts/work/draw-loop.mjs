#!/usr/bin/env node
// draw-loop.mjs — the interface.draw loop (owner rulings 2026-09-27): draw -> shoot -> evaluate -> fix, up to
// allocation.drawLoop.maxRounds rounds, until EVERY machine metric passes and an independent critic scores beauty at
// least beautyMin; the best round is kept, and the owner still gives the final acceptance (draw-review.mjs).
//
//   round  --ui <ui-record-dir> --html <source.html> --base <XBase> --state <state> --viewports <WxH,WxH>
//          --repo <product repo> [--out <dir>] [--family starci] [--no-full-page] [--no-critic] [--json]
//          renders the source with draw-render into <out>/round-<n>/, runs every machine metric, then the critic
//          (scripts/work/draw-critic.mjs: a fresh Orca worker started by worker-start on an empty-tree runtime worktree with only the PNGs, the
//          HTML and the product's brand.direction rubric), and records round-<n>/{source.html, <part>.png + its
//          draw-render .json, <part>.score.json, metrics.json, critique.json} and <out>/loop.json. It prints the
//          failures, the beauty, whether the round progressed and whether the loop stops; fix the source and run round again until it does
//   round  --source <XBase>.draw.tsx --fixture <fixture.json> [--fixture <width>=<fixture.json>]... --product <app dir>
//          [--css <product global css>]... [--grammar auto|product|claude-dist] [--grammar-dist <package root>]
//          --base <XBase> --state <state> --viewports <WxH,WxH> --repo <product repo> [--ui ...] [--out ...] [...]
//          the real-component drawing (owner ruling 2026-09-27, "locked"): the shape is a React XBase composing only
//          @starci/grammar (scripts/work/draw/draw-source.mjs). The round first runs the SOURCE gate - the grammar the
//          draw type-checks against (scripts/work/draw-grammar.mjs: the product's install, else claude-dist with the
//          product upgrade owed), DRAW_TYPECHECK_FAILED, the AST gate (DRAW_OFF_GRAMMAR_COMPONENT, DRAW_RAW_STYLED_HTML,
//          DRAW_IMPORT_OFF_GRAMMAR, DRAW_LAYOUT_VALUE_UNJUSTIFIED, DRAW_BASE_SIGNATURE) - then renders it with
//          draw-render's fixture mode in the product's own CSS, and judges the RENDERED DOM (its snapshot
//          <part>.dom.html; rendered-DOM ownership replaces the html DNA attribute gate). The round keeps
//          source.tsx, fixture(s), grammar.json (the resolution), harness/ (the bundle the browser metrics load),
//          the PNGs and records, metrics.json and critique.json; finish installs <part>.draw.tsx + <part>.fixture.json
//          beside the parts - the accepted draw source interface.implement starts from.
//   status --out <dir> [--json]
//   finish --out <dir> [--parts <dir>] [--prompt <brief.prompt.txt>] [--drawer <provider>] [--no-critic] [--json]
//          first critiques the best round when it carries no beauty (drawn with --no-critic, or its critic errored),
//          so a drawing is never blocked on a beauty nobody scored: DRAW_CRITIC_MISSING when the critic still cannot
//          answer, DRAW_BEAUTY_BELOW only for a real score under beautyMin. Then, once the loop stopped: selects the BEST round (all metrics pass first, then fewest failures, then the
//          highest beauty, then the latest), installs its parts (<XBase>#<state>--<WxH>--light.{png,json,html,
//          score.json}) into --parts (default: the source's directory) and prints the ui.assets entries to record
//          verbatim (generation.loop names this loop and round). Outcome `passed`, or `blocked` with the remaining
//          failures of the best round - the worker then reports blocked with them, never pass
//   verify --ui <ui-record-dir> --repo <product repo> [--json]
//          what starci kernel settle runs: re-renders every live part of the record from its render source and re-runs every
//          machine metric itself (never the loop's self-reported numbers); exit 1 when one fails
//
// Machine metrics (each finding a code): the capture itself (DRAW_RENDER_RED: a missing font, horizontal overflow, a
// page error, a failed request), the DNA gate (scripts/work/draw/draw-dna.mjs), the taste metrics (draw-taste.mjs:
// DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BANDS, DRAW_TOO_MANY_BADGES), the layer and measure gates (draw-layer.mjs:
// DRAW_NESTED_VARIANT - a form control on a surface without variant=secondary, a form on the bare page Background;
// DRAW_MEASURE_UNCAPPED - a form region rendered past the W-3xl cap), the copy/badge/action checks of draw-quality.mjs,
// the brand palette (PALETTE_OFF_BRAND, PRIMARY_ABSENT), the Grammar geometry (GEOMETRY_OFF_GRAMMAR,
// grammar-geometry.mjs), the ui-proof score (DRAW_SCORE_BELOW, ui-proof-brief.mjs --score) at every viewport, and the
// decision evidence (DRAW_RATIONALE_MISSING, scripts/work/draw/draw-rationale.mjs: the rationale.json beside the source,
// data-why on every element and region, every measured value covered, every rule id resolvable, a redline per part).
// A metric that cannot run is DRAW_METRICS_UNVERIFIED - a failure, never a pass.
import { opContextOf } from '../guards/op-context.mjs';
import fs from 'node:fs';
import { putBundle } from '../../engine/db/blob.mjs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {sha256} from '../../engine/digest.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { assetsOf, flag, isFile, list, sha256File, slash, workRootOf } from './work-io.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { writeJsonFile } from '../api/fs/write-json-file.mjs';
import { buildFixtureHarness, captureHtml, loadPlaywright, parseViewports } from './draw-render.mjs';
import { DRAW_OFF_GRAMMAR_COMPONENT as DOM_OFF_GRAMMAR, DRAW_SOURCE_SUFFIX, checkDrawSource, rationaleFileFor } from './draw/draw-source.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { anatomyFindings, dnaFindings, loadDna, proposalFilesFor, proposalNamesIn } from './draw/draw-dna.mjs';
import { measureFindings, nestedVariantFindings } from './draw/draw-layer.mjs';
import { assetRequestIdsFor } from './asset-slot.mjs';
import { accentBudgetOf, drawLoopSettings, htmlTasteFindings } from './draw/draw-taste.mjs';
import { badgesOf, commandsFrom, controlCountOf, internalCopyOf, visibleTextOf, DRAW_ACTION_MISSING, DRAW_BADGE_UNTONED, DRAW_COPY_INTERNAL, DRAW_SCORE_BELOW } from './draw/draw-quality.mjs';
import { brandOf, brandPalette, paletteFindings } from './brand/brand-palette.mjs';
import { parseColor } from './brand/brand.mjs';
import { criticFor, runCritic, rubricFor } from './draw-critic.mjs';
import { archetypeOf } from './ui-archetype.mjs';
import { readProposals, proposalFilesUnder } from './grammar-proposal.mjs';
import { DRAW_LOOP_MISSING, LOOP_SCHEMA, livePartsOf, loopCoverageFindings } from './draw/draw-loop-coverage.mjs';
import { loadRationale, measuresOf, rationaleFileOf, rationaleFindings, ruleResolver } from './draw/draw-rationale.mjs'; import { isMain } from '../lib/is-main.mjs';

export { DRAW_LOOP_MISSING, LOOP_SCHEMA, livePartsOf, loopCoverageFindings };

const METRICS_SCHEMA = 'starci/draw-metrics@1';
export const DRAW_RENDER_RED = 'DRAW_RENDER_RED';
export const DRAW_METRICS_UNVERIFIED = 'DRAW_METRICS_UNVERIFIED';
export const DRAW_METRICS_FAILED = 'DRAW_METRICS_FAILED';
export const GEOMETRY_OFF_GRAMMAR = 'GEOMETRY_OFF_GRAMMAR';
export const DRAW_BEAUTY_BELOW = 'DRAW_BEAUTY_BELOW';
/** The best round carries no beauty: no critic ran (--no-critic) or the critic could not answer - never a low score. */
export const DRAW_CRITIC_MISSING = 'DRAW_CRITIC_MISSING';
const LOOP_DIR = 'draw-loop';
export const STOP = Object.freeze({ passed: 'passed', maxRounds: 'max-rounds', noProgress: 'no-progress' });
const DESKTOP_MIN_WIDTH = 768;


export const breakpointOf = (viewport) => (Number(viewport?.width) >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile');
const stemOf = (png) => path.basename(png).replace(/\.png$/i, '');

// ---------------------------------------------------------------------------------------------------------
// Machine metrics
// ---------------------------------------------------------------------------------------------------------

/** The real browser-backed metrics; tests replace them. */
const browserProbes = {
  async geometry(html, viewport, { repo, family, drawCss = {} }) {
    const { checkGeometry } = await import('./ui/grammar-geometry.mjs');
    return checkGeometry(html, { repo, family, viewport, ...drawCss });
  },
  async score(html, viewport, { repo, family, record, recordFile, drawCss = {} }) {
    const { buildBrief, scoreRender } = await import('./ui/ui-proof-brief.mjs');
    const brief = buildBrief({ record: record ?? {}, recordFile, repo, family, ...drawCss });
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
export async function machineMetrics({ html, captures, ui = null, repo, family = null, settings = drawLoopSettings(), probes = browserProbes, proposalDirs = [], rationaleFile = undefined, sourceGate = null, domHtml = null, probeRepo = null, drawCss = {} }) {
  // A real-component drawing (sourceGate set) is judged on its RENDERED DOM (draw-render's snapshot), never on the
  // harness page that only loads the bundle.
  const text = domHtml ?? fs.readFileSync(html, 'utf8');
  const component = sourceGate != null;
  const label = path.basename(html);
  const metrics = [];
  const scores = new Map();
  const push = (id, findings, measured = undefined) => metrics.push({ id, ok: findings.length === 0, findings, ...(measured !== undefined ? { measured } : {}) });

  // 0. The source gate of a real-component drawing: the type-check against the grammar it renders with and the AST gate.
  if (component) push('source', list(sourceGate.findings).map((f) => finding('source', f.code, f.detail)), sourceGate.grammar ? { grammarSource: sourceGate.grammar.grammarSource ?? null, upgradeOwed: sourceGate.grammar.upgradeOwed ?? null } : undefined);

  // 1. The capture itself (rendered-DOM ownership is judged by the DNA metric).
  const redOf = (c) => list(c.record?.failures).filter((f) => f !== 'off-grammar-dom');
  push('render', captures.flatMap((c) => (c.record && (c.record.ok !== false || !redOf(c).length) ? [] : [finding('render', DRAW_RENDER_RED, `${stemOf(c.png)}: ${c.record ? `red capture (${redOf(c).join(', ')})` : 'no draw-render record'}`)])));

  // 2. DNA: every element a DNA component, notices Alert, ratios Meter.
  const proposalFiles = proposalFilesFor(html, [...proposalDirs, ...(ui?.dir ? [ui.dir] : [])]);
  const proposals = proposalNamesIn(proposalFiles);
  // The anatomy each capture measured (draw-render record `anatomy`): the real HeroUI Alert and the full-width h-2 Meter track.
  const measuredAnatomy = captures.flatMap((c) => anatomyFindings(c.record?.anatomy, { label: stemOf(c.png) })).map((f) => finding('dna', f.code, f.detail));
  const assetRequests = assetRequestIdsFor(html, [...proposalDirs, ...(ui?.dir ? [ui.dir] : [])]);
  // A real-component drawing: every painting element of the rendered DOM belongs to a grammar component (draw-render
  // record `ownership`); a hand-drawn html one: every element carries its DNA attribute.
  const ownership = captures.flatMap((c) => (c.record?.ownership ? (c.record.ownership.unownedCount ? [finding('dna', DOM_OFF_GRAMMAR, `${stemOf(c.png)} rendered DOM: ${c.record.ownership.unownedCount} painting element(s) owned by a drawn layout element, not a grammar component - ${list(c.record.ownership.unowned).slice(0, 5).join('; ')}`)] : [])
    : component ? [finding('dna', DRAW_METRICS_UNVERIFIED, `${stemOf(c.png)}: the capture measured no rendered-DOM ownership`)] : []));
  push('dna', [...(component ? ownership : dnaFindings(text, { dna: loadDna({ family: family ?? undefined }), proposals, label, assetRequests }).map((f) => finding('dna', f.code, f.detail, { count: f.count }))), ...measuredAnatomy],
    { proposals: readProposals(proposalFiles).map((p) => ({ name: p.name, complete: p.complete, missing: p.missing })) });

  // 2b. Layer and measure (draw-layer.mjs, owner 2026-09-28): every form control on a surface in the nested
  // `secondary` variant and no form region on the bare page Background (ANATOMY-2, the rendered DOM), and no form
  // region wider than the W-3xl cap at any viewport (MEASURE-4 case-3/case-4, each capture's measured `layer`).
  const layerMeasured = captures.map((c) => ({ part: stemOf(c.png), forms: list(c.record?.layer?.forms).map((f) => ({ desc: f.desc, width: Math.round(Number(f.width)) })) }));
  push('layer', [
    ...nestedVariantFindings(text, { label }).map((f) => finding('layer', f.code, f.detail, { count: f.count })),
    ...captures.flatMap((c) => (c.record?.layer?.error ? [finding('layer', DRAW_METRICS_UNVERIFIED, `${stemOf(c.png)}: the form measure could not be read (${c.record.layer.error})`)]
      : measureFindings(c.record?.layer, { label: stemOf(c.png) }).map((f) => finding('layer', f.code, f.detail, { count: f.count })))),
  ], layerMeasured);

  // 3. Taste: bands per card, badges per entity (html), accent share (every capture).
  push('taste', htmlTasteFindings(text, { settings, label }).map((f) => finding('taste', f.code, f.detail, { count: f.count })));
  const workRoot = ui?.dir ? workRootOf(ui.dir) : null;
  const brand = workRoot ? brandOf(workRoot) : { brand: null };
  const palette = brand.brand ? brandPalette(brand.brand, { brandDir: brand.dir }) : null;
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
  push('palette', brand.brand ? captures.flatMap((c) => paletteFindings({ file: c.png, shownAs: stemOf(c.png), brand: brand.brand, palette, subject: 'drawn part', at: c.png, record: c.record ?? undefined })
    .filter((f) => f.level === 'refuse').map((f) => finding('palette', f.code, f.message))) : []);

  // 6 + 7. Grammar geometry and the ui-proof score at every viewport (browser-backed; unavailable is a failure).
  const geometry = [], score = [];
  for (const c of captures) {
    const viewport = { width: c.viewport.width, height: c.viewport.height };
    let g = null, s = null;
    try { g = await probes.geometry(html, viewport, { repo: probeRepo ?? repo, family, drawCss }); } catch (error) { g = { error: String(error?.message ?? error) }; }
    if (!g || g.error) geometry.push(finding('geometry', DRAW_METRICS_UNVERIFIED, `grammar-geometry could not run at ${viewport.width}x${viewport.height}: ${g?.error ?? 'no result'}`));
    else for (const f of list(g.findings)) geometry.push(finding('geometry', f.code ?? GEOMETRY_OFF_GRAMMAR, `${viewport.width}x${viewport.height} ${f.element ?? ''} ${f.at ?? ''} ${f.property ?? ''} is ${f.got ?? '?'}, the grammar renders ${f.expected ?? '?'}`.replace(/\s+/g, ' ').trim()));
    try { s = await probes.score(html, viewport, { repo: probeRepo ?? repo, family, drawCss, record: ui?.record ?? null, recordFile: ui?.file ?? null }); } catch (error) { s = { error: String(error?.message ?? error) }; }
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
    doc: { schema: METRICS_SCHEMA, html: path.basename(html), htmlSha256: sha256(text), ...(component ? { mode: 'component', source: sourceGate.file ? path.basename(sourceGate.file) : null, sourceSha256: sourceGate.sha256 ?? null } : {}), viewports: captures.map((c) => ({ width: c.viewport.width, height: c.viewport.height, part: stemOf(c.png) })),
      metrics, failures: failures.length, codes: [...new Set(failures.map((f) => f.code))].sort(), allPass: failures.length === 0 },
    scores,
  };
}

// ---------------------------------------------------------------------------------------------------------
// The loop record
// ---------------------------------------------------------------------------------------------------------

const loopFileOf = (out) => path.join(out, 'loop.json');
// The loop is agent data (ARCHITECTURE-DB §5.1): its rounds live in the op's job scratch (op-context.mjs; else an OS-temp
// folder keyed by the ui record), never in .starciwork. finish puts the whole loop in the blob store as one bundle
// (engine/db/blob.mjs putBundle) and generation.loop cites it {sha256: <bundle manifest>, round}.
export const defaultOutOf = (uiDir, base, state, context = opContextOf()) => path.join(
  context?.scratchDir ? path.resolve(context.scratchDir) : path.join(os.tmpdir(), 'starci-draw-loop', sha256(path.resolve(uiDir)).slice(0, 16)),
  LOOP_DIR, `${base}--${state}`);
/** The manifest file finish writes beside the loop dir (<out>.bundle.json), so starci kernel report --attach carries it too. */
const bundleFileOf = (out) => `${path.resolve(out)}.bundle.json`;

export function readLoop(out) {
  const doc = readJsonFile(loopFileOf(out));
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
  const source = { mode: 'html', html: { path: html, sha256: sha256File(html) } };
  return captureHtml({ html, out, viewports, theme: 'light', fullPage, name, source, playwright });
}

/** Parse --fixture values: "<file>" for every viewport, "<width>=<file>" for one width. */
export function fixturesByWidth(values) {
  const out = { default: null, byWidth: {} };
  for (const v of list(values)) {
    const m = /^(\d{2,5})=(.+)$/.exec(v);
    if (m) out.byWidth[m[1]] = path.resolve(m[2]);
    else out.default = path.resolve(v);
  }
  return out;
}

/**
 * Render a real-component drawing: draw-render's fixture mode with the product's CSS and the resolved grammar, one
 * bundle per distinct fixture. Keeps the first bundle in `harnessDir` (the browser metrics load its index.html).
 */
async function defaultComponentRender({ source, fixtures, css = [], productDir, grammar, out, viewports, name, fullPage, harnessDir, rationale = null }) {
  const playwright = loadPlaywright([productDir, path.dirname(source), process.cwd()]);
  const groups = new Map();
  for (const v of viewports) {
    const f = fixtures.byWidth[String(v.width)] ?? fixtures.default;
    if (!f) throw Error(`no fixture for the ${v.width}px viewport`);
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(v);
  }
  const records = [];
  for (const [props, vps] of groups) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-loop-'));
    try {
      const built = await buildFixtureHarness({ component: source, exportName: name.split('#')[0], props, css, theme: 'light', workDir, productDir, grammar });
      records.push(...await captureHtml({ html: built.html, out, viewports: vps, theme: 'light', fullPage, name, source: built.source, playwright, rationale }));
      if (harnessDir && !fs.existsSync(path.join(harnessDir, 'index.html'))) { fs.mkdirSync(harnessDir, { recursive: true }); fs.cpSync(workDir, harnessDir, { recursive: true }); }
    } finally {
      safeRemove(workDir, { hold: artifactHoldReason });
    }
  }
  return records;
}

const loadUi = (uiDir) => {
  if (!uiDir) return null;
  const file = path.join(uiDir, 'index.yaml');
  let record = null;
  try { record = parseYaml(fs.readFileSync(file, 'utf8')); } catch { record = null; }
  return { dir: uiDir, file, record };
};

/**
 * The prelude both round kinds share: resolve `out`, refuse a foreign or stopped loop, load the ui record and its archetype,
 * create the loop record on first round (`extra`: the component-round fields {mode, product}, in the record's key order). */
const openLoop = (o, sourcePath, { settings, extra = {} }) => {
  const uiDir = o.ui ? path.resolve(o.ui) : null;
  const out = path.resolve(o.out ?? defaultOutOf(uiDir ?? path.dirname(sourcePath), o.base, o.state));
  const name = `${o.base}#${o.state}`;
  let loop = readLoop(out);
  if (loop && (loop.base !== o.base || loop.state !== o.state)) throw Error(`${out} is the loop of ${loop.base}#${loop.state}, not ${name}`);
  if (loop?.stop) throw Error(`the loop stopped at round ${loop.stop.atRound} (${loop.stop.reason}): run finish`);
  const ui = loadUi(uiDir);
  const archetype = ui?.record ? archetypeOf(ui.record) : null;
  // Paths are relative to the loop directory, so the record reads the same from any checkout.
  loop ??= { schema: LOOP_SCHEMA, base: o.base, state: o.state, ...(extra.mode ? { mode: extra.mode } : {}),
    ui: uiDir ? slash(path.relative(out, uiDir)) || '.' : null,
    source: slash(path.relative(out, sourcePath)), ...(extra.product ? { product: extra.product } : {}),
    viewports: o.viewports, archetype: archetype?.archetype ?? null,
    settings: { maxRounds: settings.maxRounds, stallRounds: settings.stallRounds, beautyMin: settings.beautyMin, accentBudget: settings.accentBudget, bandsPerCardMax: settings.bandsPerCardMax, badgesPerEntityMax: settings.badgesPerEntityMax },
    rounds: [], stop: null, best: null, outcome: null };
  return { uiDir, out, name, loop, ui, archetype };
};

/**
 * One round of the loop. Options: {ui, html, base, state, viewports:[{width,height}], repo, out?, family?, fullPage?,
 * critic? (false: no critic), render? probes? criticOrca? (tests: a fake Orca client for the critic worker)}. Returns {loop, round, stop}.
 */
export async function runRound(o) {
  if (o.source) return runComponentRound(o);
  const settings = o.settings ?? drawLoopSettings();
  const html = path.resolve(o.html);
  if (!isFile(html)) throw Error(`${o.html} does not exist`);
  const { uiDir, out, name, loop, ui, archetype } = openLoop(o, html, { settings });
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
  for (const [png, s] of scores) writeJsonFile(png.replace(/\.png$/i, '.score.json'), s);
  writeJsonFile(path.join(roundDir, 'metrics.json'), metrics);

  let critique = null;
  if (o.critic !== false) {
    critique = await critiqueRound({ loop, n, roundDir, captures, html, uiDir, archetype: archetype?.archetype ?? null, record: ui?.record ?? null, shape: name, settings, drawer: o.drawer, orca: o.criticOrca ?? null });
  }
  const beauty = critique?.verdict?.beauty ?? null;
  const round = { n, dir: `round-${n}`, at: new Date().toISOString(), htmlSha256: metrics.htmlSha256, failures: metrics.failures, codes: metrics.codes, allPass: metrics.allPass,
    beauty, criticFailed: critique?.verdict?.failed ?? null, ...(loop.ownerChecks?.length ? { ownerFailed: loop.ownerChecks.filter((id) => critique?.verdict?.checks?.find((c) => c.id === id)?.pass !== true) } : {}), critic: critique ? { model: critique.critic.model, independent: critique.critic.independent, error: critique.error ?? null } : null,
    parts: captures.map((c) => ({ part: stemOf(c.png), width: c.viewport.width, height: c.viewport.height, sha256: c.record?.image?.sha256 ?? sha256File(c.png) })) };
  round.progress = progressed(round, loop.rounds);
  loop.rounds.push(round);
  loop.stop = stopOf(loop.rounds, settings);
  loop.best = bestRound(loop.rounds)?.n ?? null;
  writeJsonFile(loopFileOf(out), loop);
  return { out, loop, round, metrics, critique, stop: loop.stop };
}

/**
 * The independent critic of one round (both round kinds): the rubric (brand.direction's, with the owner's open notes as
 * gate checks), the critic picked by criticFor - a different model from the drawer (--drawer, else the op launch's
 * op's provider, op-context.mjs) - run by runCritic, written to <round>/critique.json. Never throws: a critic that cannot be
 * picked or cannot answer is a critique with `error` and no verdict (the round then has no beauty and finish reports
 * DRAW_CRITIC_MISSING, not a low score).
 */
export async function critiqueRound({ loop, n, roundDir, captures, html, uiDir = null, archetype = null, record = null, shape, settings, drawer = undefined, orca = null }) {
  const { rubric, ownerChecks } = rubricFor({ workRoot: uiDir ? workRootOf(uiDir) : null, archetype, record, shape });
  // The owner's notes this shape must address ride as gate checks (draw-feedback.mjs); the loop records which.
  if (ownerChecks.length) loop.ownerChecks = ownerChecks;
  const who = drawer ?? opContextOf()?.provider ?? null;
  const pick = criticFor(settings, who);
  let critique;
  try {
    critique = pick.error
      ? { schema: 'starci/draw-critique@1', outcome: 'not-configured', critic: { independent: false }, verdict: null, error: pick.error }
      : await runCritic({ images: captures.map((c) => ({ path: c.png, label: `${breakpointOf(c.viewport)} ${c.viewport.width}px` })), html, rubric, critic: pick.critic, orca });
  } catch (error) {
    critique = { schema: 'starci/draw-critique@1', outcome: 'launch-failed', critic: { independent: false }, verdict: null, error: String(error?.message ?? error) };
  }
  critique.critic = { ...(critique.critic ?? {}), drawer: who };
  critique.round = n;
  writeJsonFile(path.join(roundDir, 'critique.json'), critique);
  return critique;
}

/**
 * The best round's critique, run now when that round has none (a round drawn with --no-critic, or one whose critic
 * errored): finish never reports a drawing blocked on a beauty nobody scored. Updates the round's beauty and critic in
 * loop.json. Returns {ran, critique|null, round}. `orca` replaces the Orca client of the critic worker (tests).
 */
export async function critiqueBest({ out, settings = drawLoopSettings(), drawer = undefined, orca = null }) {
  const loop = readLoop(out);
  if (!loop?.rounds?.length) return { ran: false, critique: null, round: null };
  const best = bestRound(loop.rounds);
  if (Number.isFinite(best.beauty)) return { ran: false, critique: null, round: best.n };
  const roundDir = path.join(out, best.dir);
  const captures = best.parts.map((p) => ({ png: path.join(roundDir, `${p.part}.png`), viewport: { width: p.width, height: p.height } })).filter((c) => isFile(c.png));
  if (!captures.length) return { ran: false, critique: null, round: best.n };
  const dom = best.parts.map((p) => path.join(roundDir, `${p.part}.dom.html`)).find(isFile);
  const html = dom ?? [path.join(roundDir, 'source.html'), path.join(roundDir, 'source.tsx')].find(isFile);
  const uiDir = loop.ui != null ? path.resolve(out, loop.ui) : null;
  const ui = loadUi(uiDir);
  const critique = await critiqueRound({ loop, n: best.n, roundDir, captures, html, uiDir, archetype: loop.archetype ?? null, record: ui?.record ?? null, shape: `${loop.base}#${loop.state}`, settings, drawer, orca });
  const beauty = critique?.verdict?.beauty ?? null;
  Object.assign(best, { beauty, criticFailed: critique?.verdict?.failed ?? null, critic: { model: critique.critic?.model ?? null, independent: critique.critic?.independent ?? false, error: critique.error ?? null, late: true },
    ...(loop.ownerChecks?.length ? { ownerFailed: loop.ownerChecks.filter((id) => critique?.verdict?.checks?.find((c) => c.id === id)?.pass !== true) } : {}) });
  if (loop.stop?.reason !== STOP.maxRounds) loop.stop = stopOf(loop.rounds, settings) ?? loop.stop;
  loop.best = bestRound(loop.rounds)?.n ?? null;
  writeJsonFile(loopFileOf(out), loop);
  return { ran: true, critique, round: best.n };
}

/**
 * Gate, render and measure one real-component drawing into `out`: the source gate (checkDrawSource), the render in the
 * product's CSS against the resolved grammar (render), every machine metric on the rendered DOM. `keep` copies the
 * draw source, fixtures, grammar resolution and rationale into `out` (a loop round). Shared by a loop round and the
 * settle re-measure (verifyRecordParts), so the runtime judges an installed part exactly as the loop did.
 */
export async function componentMeasure({ source, fixtures, fixtureFiles, productDir, css = [], prefer = 'auto', grammarDist = null, ui = null, repo, family = null, settings = drawLoopSettings(),
  probes = browserProbes, out, proposalDirs = [], viewports, name, fullPage = true, render = defaultComponentRender, sourceCheck = checkDrawSource, keep = false, rationaleFile = undefined }) {
  // The source gate first: TypeScript against the grammar the draw will ship with, then the AST.
  const gate = await sourceCheck({ file: source, fixtures: fixtureFiles, productDir, prefer, grammarDist });
  gate.file = source;
  gate.sha256 = sha256File(source);
  const whyFile = rationaleFile === undefined ? rationaleFileFor(source) : rationaleFile;
  if (keep) {
    fs.copyFileSync(source, path.join(out, 'source.tsx'));
    for (const f of fixtureFiles) fs.copyFileSync(f, path.join(out, f === fixtures.default ? 'fixture.json' : `fixture.${Object.keys(fixtures.byWidth).find((w) => fixtures.byWidth[w] === f)}.json`));
    writeJsonFile(path.join(out, 'grammar.json'), { schema: 'starci/draw-grammar@1', grammarSource: gate.grammar.grammarSource ?? null, pick: gate.grammar.pick ?? null,
      productVersion: gate.grammar.productVersion ?? null, productRange: gate.grammar.productRange ?? null, upgradeOwed: gate.grammar.upgradeOwed ?? null, attempts: gate.grammar.attempts ?? [] });
    if (whyFile) fs.copyFileSync(whyFile, path.join(out, 'rationale.json'));
  }
  // A draw that type-checks nowhere still renders (against the last candidate) so the round shows it - and fails.
  const grammar = gate.grammar.ok ? gate.grammar : { ...gate.grammar, pick: gate.grammar.attempts?.length ? { source: gate.grammar.attempts.at(-1).source, version: gate.grammar.attempts.at(-1).version, root: gate.grammar.attempts.at(-1).root } : null };
  const harnessDir = path.join(out, 'harness');
  const cssFiles = list(css).map((c) => path.resolve(c));
  const records = await render({ source, fixtures, css: cssFiles, productDir, grammar, out, viewports, name, fullPage, harnessDir, rationale: whyFile });
  const captures = records.map((r) => ({ png: r.image.path, record: r, viewport: { width: r.viewport.width, height: r.viewport.height } }));
  const domFile = captures.map((c) => c.record?.dom?.path).find((f) => f && isFile(f)) ?? null;
  const html = isFile(path.join(harnessDir, 'index.html')) ? path.join(harnessDir, 'index.html') : (domFile ?? source);
  const { doc: metrics, scores } = await machineMetrics({ html, captures, ui, repo, family, settings, probes, proposalDirs, rationaleFile: whyFile, sourceGate: gate, probeRepo: productDir,
    // The browser metrics resolve the expected geometry from the cascade the render used: the picked grammar (a
    // claude-dist alias) and the draw's stylesheets outside the product.
    drawCss: { grammarDist: grammar.pick && grammar.pick.source !== 'product' ? grammar.pick.root : null, extraCss: cssFiles.filter((c) => path.relative(productDir, c).startsWith('..')) },
    domHtml: domFile ? fs.readFileSync(domFile, 'utf8') : null });
  return { gate, grammar, captures, domFile, metrics, scores, whyFile };
}

/**
 * One round of a real-component drawing. Options: {source (<XBase>.draw.tsx), fixtures ({default, byWidth}) or fixture,
 * product (app dir), css [], grammar ('auto'), grammarDist, ui, base, state, viewports, repo, out?, family?, fullPage?,
 * critic?, render? probes? criticOrca? sourceCheck? (tests)}.
 */
async function runComponentRound(o) {
  const settings = o.settings ?? drawLoopSettings();
  const source = path.resolve(o.source);
  if (!isFile(source)) throw Error(`${o.source} does not exist`);
  if (!source.endsWith(DRAW_SOURCE_SUFFIX)) throw Error(`${o.source} is not a <XBase>${DRAW_SOURCE_SUFFIX} draw file`);
  if (!o.product) throw Error('--product <app dir> is required for a --source drawing');
  const productDir = path.resolve(o.product);
  const fixtures = o.fixtures ?? fixturesByWidth(o.fixture ? [o.fixture] : []);
  const fixtureFiles = [...new Set([fixtures.default, ...Object.values(fixtures.byWidth)].filter(Boolean))];
  if (!fixtureFiles.length) throw Error('--fixture <fixture.json> is required for a --source drawing');
  const { uiDir, out, name, loop, ui, archetype } = openLoop(o, source, { settings, extra: { mode: 'component', product: slash(productDir) } });
  const n = loop.rounds.length + 1;
  const roundDir = path.join(out, `round-${n}`);
  fs.mkdirSync(roundDir, { recursive: true });
  const { gate, captures, domFile, metrics, scores } = await componentMeasure({ source, fixtures, fixtureFiles, productDir, css: o.css, prefer: o.grammar ?? 'auto', grammarDist: o.grammarDist ?? null,
    ui: ui ? { ...ui, state: o.state } : null, repo: o.repo, family: o.family ?? null, settings, probes: o.probes ?? browserProbes, out: roundDir, proposalDirs: [out, path.dirname(source)],
    viewports: o.viewports, name, fullPage: o.fullPage !== false, render: o.render ?? defaultComponentRender, sourceCheck: o.sourceCheck ?? checkDrawSource, keep: true });
  metrics.round = n;
  for (const [png, sc] of scores) writeJsonFile(png.replace(/\.png$/i, '.score.json'), sc);
  writeJsonFile(path.join(roundDir, 'metrics.json'), metrics);

  let critique = null;
  if (o.critic !== false) {
    // The critic reads the rendered DOM (what the images show), never the bundle harness; it is picked by criticFor
    // exactly as for an html round - a real-component round used to hand settings.critic straight to runCritic, so a
    // Codex drawer was judged by Codex and a missing critic threw (no critique.json, DRAW_BEAUTY_BELOW with no score).
    critique = await critiqueRound({ loop, n, roundDir, captures, html: domFile ?? source, uiDir, archetype: archetype?.archetype ?? null, record: ui?.record ?? null, shape: name, settings, drawer: o.drawer, orca: o.criticOrca ?? null });
  }
  const beauty = critique?.verdict?.beauty ?? null;
  const round = { n, dir: `round-${n}`, at: new Date().toISOString(), mode: 'component', sourceSha256: gate.sha256, grammarSource: gate.grammar.grammarSource ?? null,
    ...(gate.grammar.upgradeOwed ? { grammarUpgradeOwed: gate.grammar.upgradeOwed } : {}), htmlSha256: metrics.htmlSha256, failures: metrics.failures, codes: metrics.codes, allPass: metrics.allPass,
    beauty, criticFailed: critique?.verdict?.failed ?? null, ...(loop.ownerChecks?.length ? { ownerFailed: loop.ownerChecks.filter((id) => critique?.verdict?.checks?.find((c) => c.id === id)?.pass !== true) } : {}),
    critic: critique ? { model: critique.critic.model, independent: critique.critic.independent, error: critique.error ?? null } : null,
    parts: captures.map((c) => ({ part: stemOf(c.png), width: c.viewport.width, height: c.viewport.height, sha256: c.record?.image?.sha256 ?? sha256File(c.png) })) };
  round.progress = progressed(round, loop.rounds);
  loop.rounds.push(round);
  loop.stop = stopOf(loop.rounds, settings);
  loop.best = bestRound(loop.rounds)?.n ?? null;
  writeJsonFile(loopFileOf(out), loop);
  return { out, loop, round, metrics, critique, stop: loop.stop };
}

// What finish installs is a Work file the product commits, so its JSON (the draw-render record, the ui-proof score, the
// rationale, the fixture) never cites the loop's scratch: the loop dir, the job scratch, an OS-temp render harness.
// Such a path is gone once the op files its report, and the job scratch's 64-hex name is a "long hex blob" to the
// product's commit guard (secrets-guard.mjs), which refuses the commit. A scratch path becomes the installed file it
// was copied to (relative to the JSON's own directory), else a member of the loop bundle `draw-loop:<path in the loop>`
// (generation.loop cites the bundle's sha256), else `scratch:<path in the job scratch>`, else (a temp path that is
// gone) `temp:<file name>`.
const LOOP_REF = 'draw-loop:';
const SCRATCH_REF = 'scratch:';
const TEMP_REF = 'temp:';
const WIN = process.platform === 'win32';
const pathKey = (p) => { const r = path.resolve(p); return WIN ? r.toLowerCase() : r; };
const within = (root, p) => { const rel = path.relative(root, p); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
const withReal = (d) => { const out = [path.resolve(d)]; try { out.push(fs.realpathSync.native(d)); } catch { /* missing */ } return out; };
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The scratch roots of a loop (the loop dir, the job scratch, the OS temp dirs), with a mapper of a path under them. */
export function scratchRewriter({ out, env = process.env, context = opContextOf({ env }), installed = new Map() }) {
  const loopRoots = withReal(out);
  const jobRoots = context?.scratchDir ? withReal(context.scratchDir) : [];
  const roots = [...new Set([...loopRoots, ...jobRoots, ...[os.tmpdir(), env.TEMP, env.TMP].filter(Boolean).flatMap(withReal)])]
    .filter((d) => path.parse(d).root !== d).sort((a, b) => b.length - a.length);
  // Each root as written with either separator, optionally as a file URL; the tail runs to the first quote or space.
  const forms = [...new Set(roots.flatMap((r) => [r, r.replace(/\\/g, '/'), r.replace(/\//g, '\\')]))].sort((a, b) => b.length - a.length);
  const re = forms.length ? new RegExp(`(file:\\/\\/\\/?)?(?:${forms.map(reEscape).join('|')})(?:[\\\\/][^\\s"'<>|*?]*)?(?![^\\\\/\\s"'<>|*?])`, WIN ? 'gi' : 'g') : null;
  const map = (abs) => {
    const hit = installed.get(pathKey(abs));
    if (hit) return hit;
    const inRoot = (list) => list.find((r) => within(r, abs));
    const loopRoot = inRoot(loopRoots);
    if (loopRoot) return `${LOOP_REF}${slash(path.relative(loopRoot, abs)) || '.'}`;
    const jobRoot = inRoot(jobRoots);
    if (jobRoot) return `${SCRATCH_REF}${slash(path.relative(jobRoot, abs)) || '.'}`;
    // Elsewhere under the OS temp dir only a path that is gone (a render harness) is scratch: a live one (a product
    // checkout there) stays, because the settle re-measure reads it (verifyRecordParts: source.product, css).
    return fs.existsSync(abs) ? null : `${TEMP_REF}${path.basename(abs)}`;
  };
  const text = (s) => (re ? s.replace(re, (m, url) => {
    let p = m;
    if (url) { try { p = fileURLToPath(m); } catch { p = decodeURIComponent(m.slice(url.length)); } }
    return map(p) ?? m;
  }) : s);
  const value = (v) => (typeof v === 'string' ? text(v) : Array.isArray(v) ? v.map(value)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)])) : v);
  return { roots, map, text, value };
}

/**
 * Install one loop JSON at `to` with every scratch path rewritten (scratchRewriter): an installed sibling becomes its
 * path relative to `to`'s directory. A file that is not JSON is copied as is.
 */
function installJson(from, to, { out, installed }) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(from, 'utf8')); } catch { fs.copyFileSync(from, to); return; }
  const rel = new Map([...installed].map(([k, abs]) => [k, slash(path.relative(path.dirname(to), abs))]));
  writeJsonFile(to, scratchRewriter({ out, installed: rel }).value(doc));
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
  const metrics = readJsonFile(path.join(roundDir, 'metrics.json'));
  const passed = best.allPass && !best.ownerFailed?.length && Number.isFinite(best.beauty) && best.beauty >= Number(settings.beautyMin);
  const source = path.resolve(out, loop.source);
  const partsDir = path.resolve(parts ?? path.dirname(source));
  fs.mkdirSync(partsDir, { recursive: true });
  const installed = [];
  const uiDir = loop.ui != null ? path.resolve(out, loop.ui) : null;
  const relTo = uiDir ?? partsDir;
  const promptPath = prompt ? slash(path.relative(relTo, path.resolve(prompt))) : slash(path.relative(relTo, source.replace(/(?:\.draw\.tsx|\.html?)$/i, '.prompt.txt')));
  const assets = [];
  const loopRef = { round: best.n };
  for (const p of best.parts) {
    const from = path.join(roundDir, `${p.part}.png`);
    const to = path.join(partsDir, `${p.part}.png`);
    const component = isFile(path.join(roundDir, 'source.tsx'));
    const tsx = path.join(partsDir, `${p.part}.draw.tsx`), fx = path.join(partsDir, `${p.part}.fixture.json`);
    const perWidth = path.join(roundDir, `fixture.${p.width}.json`);
    // Every file of the round this part installs, [from, to, json]: the JSON ones are installed through
    // installJson, so a scratch path they cite becomes the installed sibling it names (or a loop-bundle member).
    // The decision evidence travels with the part: <part>.rationale.json and the annotated <part>.redline.png. A
    // real-component drawing: the accepted draw source (<part>.draw.tsx) and its fixture are what interface.implement
    // starts the XBase from; the rendered DOM rides along for the html-reading checks.
    const copies = [[from, to], ...['.json', '.score.json'].map((ext) => [path.join(roundDir, `${p.part}${ext}`), path.join(partsDir, `${p.part}${ext}`), true]),
      [path.join(roundDir, 'rationale.json'), path.join(partsDir, `${p.part}.rationale.json`), true], [path.join(roundDir, `${p.part}.redline.png`), path.join(partsDir, `${p.part}.redline.png`)],
      ...(component ? [[path.join(roundDir, 'source.tsx'), tsx], [isFile(perWidth) ? perWidth : path.join(roundDir, 'fixture.json'), fx, true],
        [path.join(roundDir, `${p.part}.dom.html`), path.join(partsDir, `${p.part}.dom.html`)]] : [[path.join(roundDir, 'source.html'), path.join(partsDir, `${p.part}.html`)]])].filter(([f]) => isFile(f));
    const installedAs = new Map(copies.map(([f, t]) => [pathKey(f), t]));
    // The files the round was measured from, as the render record cites them: the draw source and its rationale.
    installedAs.set(pathKey(source), component ? tsx : path.join(partsDir, `${p.part}.html`));
    const sourceWhy = component ? rationaleFileFor(source) : rationaleFileOf(source);
    if (sourceWhy && isFile(path.join(roundDir, 'rationale.json'))) installedAs.set(pathKey(sourceWhy), path.join(partsDir, `${p.part}.rationale.json`));
    for (const [f, t, json] of copies) {
      if (json) installJson(f, t, { out, installed: installedAs });
      else fs.copyFileSync(f, t);
    }
    const sha = sha256File(to);
    if (component) {
      // The art placeholders the draw source imports (./assets/x.png) travel with it, so the installed source renders.
      for (const m of fs.readFileSync(tsx, 'utf8').matchAll(/from\s+["'](\.{1,2}\/[^"']+\.(?:png|jpe?g|webp|gif|avif))["']/gi)) {
        const from3 = path.resolve(path.dirname(source), m[1]), to3 = path.resolve(partsDir, m[1]);
        if (!isFile(from3) || path.resolve(from3) === to3) continue;
        fs.mkdirSync(path.dirname(to3), { recursive: true });
        fs.copyFileSync(from3, to3);
        if (!assets.some((a) => a.path === slash(path.relative(relTo, to3)))) assets.push({ path: slash(path.relative(relTo, to3)), role: 'render-asset', sha256: sha256File(to3) });
      }
      installed.push({ path: slash(path.relative(relTo, to)), sha256: sha, source: slash(path.relative(relTo, tsx)), fixture: slash(path.relative(relTo, fx)) });
      assets.push({ path: slash(path.relative(relTo, to)), role: 'direction-content', breakpoint: breakpointOf(p), theme: 'light', sha256: sha,
        generation: { tool: 'draw-render', mode: 'draw-loop-component', promptPath, loop: loopRef, grammarSource: best.grammarSource ?? null,
          ...(best.grammarUpgradeOwed ? { grammarUpgradeOwed: best.grammarUpgradeOwed } : {}) } });
      assets.push({ path: slash(path.relative(relTo, tsx)), role: 'render-source', sha256: sha256File(tsx) });
      assets.push({ path: slash(path.relative(relTo, fx)), role: 'render-fixture', sha256: sha256File(fx) });
      for (const [ext, role] of [['.rationale.json', 'rationale'], ['.redline.png', 'direction-redline']]) {
        const f = path.join(partsDir, `${p.part}${ext}`);
        if (isFile(f)) assets.push({ path: slash(path.relative(relTo, f)), role, breakpoint: breakpointOf(p), theme: 'light', sha256: sha256File(f) });
      }
      continue;
    }
    installed.push({ path: slash(path.relative(relTo, to)), sha256: sha, html: slash(path.relative(relTo, path.join(partsDir, `${p.part}.html`))) });
    assets.push({ path: slash(path.relative(relTo, to)), role: 'direction-content', breakpoint: breakpointOf(p), theme: 'light', sha256: sha,
      generation: { tool: 'draw-render', promptPath, mode: 'draw-loop', loop: loopRef } });
    assets.push({ path: slash(path.relative(relTo, path.join(partsDir, `${p.part}.html`))), role: 'render-source' });
    for (const [ext, role] of [['.rationale.json', 'rationale'], ['.redline.png', 'direction-redline']]) {
      const f = path.join(partsDir, `${p.part}${ext}`);
      if (isFile(f)) assets.push({ path: slash(path.relative(relTo, f)), role, breakpoint: breakpointOf(p), theme: 'light', sha256: sha256File(f) });
    }
  }
  const remaining = passed ? [] : [
    ...list(metrics?.metrics).flatMap((m) => m.findings.map((f) => ({ code: f.code, detail: f.detail }))),
    ...(Number.isFinite(best.beauty) && best.beauty >= Number(settings.beautyMin) ? []
      : Number.isFinite(best.beauty) ? [{ code: DRAW_BEAUTY_BELOW, detail: `the critic scored beauty ${best.beauty} (at least ${settings.beautyMin} is the bar)${best.criticFailed?.length ? `; failed ${best.criticFailed.join(', ')}` : ''}` }]
        : [{ code: DRAW_CRITIC_MISSING, detail: `no critic scored round ${best.n}${best.critic?.error ? `: ${String(best.critic.error).slice(0, 300)}` : ' (drawn with --no-critic)'} - run finish without --no-critic (it critiques the best round) or fix the critic (runtimes.yaml allocation.drawLoop.critic)` }]),
    ...(best.ownerFailed?.length ? [{ code: 'DRAW_FEEDBACK_UNADDRESSED', detail: `the critic fails the owner's note(s) ${best.ownerFailed.join(', ')} (draw-feedback.mjs brief lists them)` }] : []),
  ];
  loop.outcome = passed ? 'passed' : 'blocked';
  loop.remaining = remaining.slice(0, 50);
  loop.installed = installed;
  loop.finishedAt = new Date().toISOString();
  if (!loop.stop) loop.stop = { reason: 'finished-early', atRound: loop.rounds.length };
  writeJsonFile(loopFileOf(out), loop);
  // The whole loop (loop.json, every round, critique and metrics) becomes one blob bundle the ui assets cite.
  loopRef.sha256 = putBundle(out);
  writeJsonFile(bundleFileOf(out), { schema: 'starci/draw-loop-bundle@1', sha256: loopRef.sha256, base: loop.base ?? null, state: loop.state ?? null });
  const proposals = readProposals([...new Set([...proposalFilesUnder(out, 3), ...proposalFilesFor(source), ...(uiDir ? proposalFilesUnder(uiDir, 1) : [])])]);
  return { outcome: loop.outcome, stop: loop.stop, bundle: loopRef.sha256, best: { n: best.n, failures: best.failures, beauty: best.beauty, codes: best.codes }, remaining, installed, assets,
    grammarProposals: proposals.map((p) => ({ name: p.name, complete: p.complete, file: p.file })) };
}

// ---------------------------------------------------------------------------------------------------------
// Settle: every live part re-rendered and re-measured by the runtime
// ---------------------------------------------------------------------------------------------------------

/**
 * Re-render every live part of a ui record from its render source and re-run every machine metric. Returns
 * {findings:[{code, path, detail, codes}], parts:[{part, failures, codes}]}. `render`/`probes` are injectable.
 */
export async function verifyRecordParts({ recordDir, record = null, repo, family = null, settings = drawLoopSettings(), render = null, componentRender = null, sourceCheck = null, probes = browserProbes, tmpRoot = os.tmpdir() }) {
  const ui = loadUi(recordDir);
  const rec = record ?? ui.record;
  const findings = [], parts = [];
  const byHtml = new Map();
  const byDraw = new Map();
  for (const p of livePartsOf(recordDir, rec)) {
    const at = slash(path.relative(repo, p.png));
    // A real-component part (<part>.draw.tsx + <part>.fixture.json beside it) is re-measured from its draw source.
    if (p.source && p.viewport) {
      const key = `${sha256File(p.source)}|${p.fixture ? sha256File(p.fixture) : ''}`;
      if (!byDraw.has(key)) byDraw.set(key, { source: p.source, fixture: p.fixture, parts: [] });
      byDraw.get(key).parts.push(p);
      continue;
    }
    if (!p.html || !p.viewport) { findings.push({ code: DRAW_METRICS_UNVERIFIED, path: at, detail: `${p.asset.path} has no ${p.html ? 'viewport (draw-render record or <WxH> in its name)' : 'render source (.html) beside it'}: the runtime cannot re-measure it` }); continue; }
    const key = sha256File(p.html);
    if (!byHtml.has(key)) byHtml.set(key, { html: p.html, parts: [] });
    byHtml.get(key).parts.push(p);
  }
  for (const { source, fixture, parts: group } of byDraw.values()) {
    const at = slash(path.relative(repo, source));
    const rec0 = readJsonFile(group[0].png.replace(/\.png$/i, '.json'))?.source ?? {};
    const productDir = rec0.product ?? null;
    if (!fixture || !productDir) { findings.push({ code: DRAW_METRICS_UNVERIFIED, path: at, detail: `${path.basename(source)} has no ${fixture ? 'product app in its draw-render record (source.product)' : 'fixture (<part>.fixture.json) beside it'}: the runtime cannot re-measure it` }); continue; }
    const dir = fs.mkdtempSync(path.join(tmpRoot, 'starci-draw-verify-'));
    try {
      const stem = path.basename(group[0].png).split('--')[0];
      const [base, state] = stem.includes('#') ? stem.split('#') : [stem, 'part'];
      const viewports = [...new Map(group.map((p) => [`${p.viewport.width}x${p.viewport.height}`, p.viewport])).values()];
      const g = rec0.grammar ?? {};
      const fixtures = { default: fixture, byWidth: {} };
      let r;
      try {
        r = await componentMeasure({ source, fixtures, fixtureFiles: [fixture], productDir, css: list(rec0.css).map((c) => c.path).filter(Boolean), grammarDist: g.source === 'claude-dist' ? g.root : null,
          prefer: g.source === 'claude-dist' ? 'claude-dist' : 'auto', ui: { ...ui, record: rec, state }, repo, family, settings, probes, out: dir, viewports, name: `${base}#${state}`, fullPage: true,
          ...(componentRender ? { render: componentRender } : {}), ...(sourceCheck ? { sourceCheck } : {}) });
      } catch (error) { findings.push({ code: DRAW_METRICS_UNVERIFIED, path: at, detail: `the runtime could not re-render ${path.basename(source)}: ${String(error?.message ?? error).split('\n')[0]}` }); continue; }
      const doc = r.metrics;
      parts.push({ html: at, failures: doc.failures, codes: doc.codes });
      if (!doc.allPass) {
        const all = doc.metrics.flatMap((m) => m.findings);
        findings.push({ code: all.every((f) => f.code === DRAW_METRICS_UNVERIFIED) ? DRAW_METRICS_UNVERIFIED : DRAW_METRICS_FAILED, path: at, codes: doc.codes,
          detail: `re-measured by the runtime, ${path.basename(source)} fails ${doc.failures} machine metric finding(s) (${doc.codes.join(', ')}): ${all.slice(0, 4).map((f) => f.detail).join(' | ').slice(0, 900)}` });
      }
    } finally {
      safeRemove(dir, { hold: artifactHoldReason });
    }
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
      safeRemove(dir, { hold: artifactHoldReason });
    }
  }
  return { findings, parts };
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

const USAGE = `use:
  starci work draw-loop round --ui <ui-record-dir> --html <source.html> --base <XBase> --state <state> --viewports <WxH,WxH> --repo <product repo> [--out <dir>] [--family starci] [--drawer <provider>] [--no-full-page] [--no-critic] [--json]
  starci work draw-loop round --source <XBase>.draw.tsx --fixture <fixture.json> [--fixture <width>=<fixture.json>]... --product <app dir> [--css <file>]... [--grammar auto|product|claude-dist] [--grammar-dist <package root>] --base <XBase> --state <state> --viewports <WxH,WxH> --repo <product repo> [--ui <ui-record-dir>] [--out <dir>] [--family starci] [--no-full-page] [--no-critic] [--json]
  starci work draw-loop status --out <dir> [--json]
  starci work draw-loop finish --out <dir> [--parts <dir>] [--prompt <brief.prompt.txt>] [--repo <product repo>] [--drawer <provider>] [--no-critic] [--json]
  starci work draw-loop verify --ui <ui-record-dir> --repo <product repo> [--json]
`;

async function drawLoopMain(argv) {
  const [cmd, ...rest] = argv;
  const json = rest.includes('--json');
  const say = (obj, text) => (json ? `${JSON.stringify(obj, null, 2)}\n` : `${text}\n`);
  if (cmd === 'round') {
    const component = Boolean(flag(rest, '--source'));
    for (const k of [component ? '--source' : '--html', ...(component ? ['--fixture', '--product'] : []), '--base', '--state', '--viewports', '--repo']) if (!flag(rest, k)) return { code: 2, text: `${k} is required\n${USAGE}` };
    const all = (k) => rest.flatMap((a, i) => (rest[i - 1] === k ? [a] : []));
    const r = await runRound({ ui: flag(rest, '--ui'), html: flag(rest, '--html'),
      ...(component ? { source: flag(rest, '--source'), fixtures: fixturesByWidth(all('--fixture')), product: flag(rest, '--product'), css: all('--css'), grammar: flag(rest, '--grammar') ?? 'auto', grammarDist: flag(rest, '--grammar-dist') } : {}), base: flag(rest, '--base'), state: flag(rest, '--state'), viewports: parseViewports(flag(rest, '--viewports')),
      repo: path.resolve(flag(rest, '--repo')), out: flag(rest, '--out'), family: flag(rest, '--family'), fullPage: !rest.includes('--no-full-page'), critic: rest.includes('--no-critic') ? false : undefined, drawer: flag(rest, '--drawer') ?? undefined });
    const next = r.stop ? `the loop stopped (${r.stop.reason}): starci work draw-loop finish --out ${r.out}` : 'fix the source against metrics.json and critique.json, then run round again';
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
    // A best round nobody critiqued (drawn with --no-critic, or its critic errored) is critiqued now, before the verdict.
    const late = rest.includes('--no-critic') ? null : await critiqueBest({ out: path.resolve(out), drawer: flag(rest, '--drawer') ?? undefined });
    const r = finishLoop({ out: path.resolve(out), parts: flag(rest, '--parts'), prompt: flag(rest, '--prompt'), repo: flag(rest, '--repo') ? path.resolve(flag(rest, '--repo')) : null, force: rest.includes('--force') });
    if (late?.ran) r.lateCritique = { round: late.round, beauty: late.critique?.verdict?.beauty ?? null, error: late.critique?.error ?? null };
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

if (isMain(import.meta.url)) {
  drawLoopMain(process.argv.slice(2)).then((r) => { process.stdout.write(r.text); process.exitCode = r.code; }, (error) => { process.stderr.write(`draw-loop: ${error?.message ?? error}\n`); process.exitCode = 2; });
}
