import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { isFile, list, workRootOf } from './work-io.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { DRAW_OFF_GRAMMAR_COMPONENT as DOM_OFF_GRAMMAR } from './draw/draw-source.mjs';
import { anatomyFindings, dnaFindings, loadDna, proposalFilesFor, proposalNamesIn } from './draw/draw-dna.mjs';
import { measureFindings, nestedVariantFindings } from './draw/draw-layer.mjs';
import { assetRequestIdsFor } from './asset-slot.mjs';
import { accentBudgetOf, drawLoopSettings, htmlTasteFindings } from './draw/draw-taste.mjs';
import { badgesOf, commandsFrom, controlCountOf, internalCopyOf, visibleTextOf, DRAW_ACTION_MISSING, DRAW_BADGE_UNTONED, DRAW_COPY_INTERNAL, DRAW_SCORE_BELOW } from './draw/draw-quality.mjs';
import { brandOf, brandPalette, paletteFindings } from './brand/brand-palette.mjs';
import { parseColor } from './brand/brand.mjs';
import { readProposals } from './grammar-proposal.mjs';
import { loadRationale, measuresOf, rationaleFileOf, rationaleFindings, ruleResolver } from './draw/draw-rationale.mjs';

const METRICS_SCHEMA = 'starci/draw-metrics@1';
export const DRAW_RENDER_RED = 'DRAW_RENDER_RED';
export const DRAW_METRICS_UNVERIFIED = 'DRAW_METRICS_UNVERIFIED';
export const DRAW_METRICS_FAILED = 'DRAW_METRICS_FAILED';
export const GEOMETRY_OFF_GRAMMAR = 'GEOMETRY_OFF_GRAMMAR';
export const DRAW_BEAUTY_BELOW = 'DRAW_BEAUTY_BELOW';
export const DRAW_CRITIC_MISSING = 'DRAW_CRITIC_MISSING';
export const stemOf = (png) => path.basename(png).replace(/\.png$/i, '');
const finding = (metric, code, detail, extra = {}) => ({ metric, code, detail, ...extra });

export const browserProbes = {
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

function pushMetric(metrics, id, findings, measured = undefined) {
  metrics.push({ id, ok: findings.length === 0, findings, ...(measured !== undefined ? { measured } : {}) });
}

function sourceMetric(metrics, component, sourceGate) {
  if (component) pushMetric(metrics, 'source', list(sourceGate.findings).map((f) => finding('source', f.code, f.detail)), sourceGate.grammar ? { grammarSource: sourceGate.grammar.grammarSource ?? null, upgradeOwed: sourceGate.grammar.upgradeOwed ?? null } : undefined);
}

function renderMetric(metrics, captures) {
  const redOf = (capture) => list(capture.record?.failures).filter((code) => code !== 'off-grammar-dom');
  pushMetric(metrics, 'render', captures.flatMap((capture) => (capture.record && (capture.record.ok !== false || !redOf(capture).length) ? [] : [finding('render', DRAW_RENDER_RED, `${stemOf(capture.png)}: ${capture.record ? 'red capture (' + redOf(capture).join(', ') + ')' : 'no draw-render record'}`)])));
}

function dnaMetric(metrics, { text, captures, ui, family, label, proposalDirs, sourceGate }) {
  const proposalFiles = proposalFilesFor(text, [...proposalDirs, ...(ui?.dir ? [ui.dir] : [])]);
  const proposals = proposalNamesIn(proposalFiles);
  const measuredAnatomy = captures.flatMap((capture) => anatomyFindings(capture.record?.anatomy, { label: stemOf(capture.png) })).map((f) => finding('dna', f.code, f.detail));
  const assetRequests = assetRequestIdsFor(text, [...proposalDirs, ...(ui?.dir ? [ui.dir] : [])]);
  const component = sourceGate != null;
  const ownership = captures.flatMap((capture) => {
    if (capture.record?.ownership) return capture.record.ownership.unownedCount ? [finding('dna', DOM_OFF_GRAMMAR, `${stemOf(capture.png)} rendered DOM: ${capture.record.ownership.unownedCount} painting element(s) owned by a drawn layout element, not a grammar component - ${list(capture.record.ownership.unowned).slice(0, 5).join('; ')}`)] : [];
    if (component) return [finding('dna', DRAW_METRICS_UNVERIFIED, `${stemOf(capture.png)}: the capture measured no rendered-DOM ownership`)];
    return [];
  });
  const dna = component ? ownership : dnaFindings(text, { dna: loadDna({ family: family ?? undefined }), proposals, label, assetRequests }).map((f) => finding('dna', f.code, f.detail, { count: f.count }));
  pushMetric(metrics, 'dna', [...dna, ...measuredAnatomy], { proposals: readProposals(proposalFiles).map((p) => ({ name: p.name, complete: p.complete, missing: p.missing })) });
}

function layerMetric(metrics, text, captures, label) {
  const measured = captures.map((capture) => ({ part: stemOf(capture.png), forms: list(capture.record?.layer?.forms).map((form) => ({ desc: form.desc, width: Math.round(Number(form.width)) })) }));
  pushMetric(metrics, 'layer', [
    ...nestedVariantFindings(text, { label }).map((f) => finding('layer', f.code, f.detail, { count: f.count })),
    ...captures.flatMap((capture) => (capture.record?.layer?.error ? [finding('layer', DRAW_METRICS_UNVERIFIED, `${stemOf(capture.png)}: the form measure could not be read (${capture.record.layer.error})`)]
      : measureFindings(capture.record?.layer, { label: stemOf(capture.png) }).map((f) => finding('layer', f.code, f.detail, { count: f.count })))),
  ], measured);
}

function accentMetric(metrics, captures, text, settings, primary) {
  const measured = [], findings = [];
  for (const capture of captures) {
    const result = accentBudgetOf(capture.png, { html: text, accent: null, settings, label: stemOf(capture.png) });
    const fallback = result.accent == null && primary ? accentBudgetOf(capture.png, { accent: primary, settings, label: stemOf(capture.png) }) : null;
    const got = fallback ?? result;
    measured.push({ part: stemOf(capture.png), accent: got.accent, share: got.share });
    if (got.finding) findings.push(finding('accent', got.finding.code, got.finding.detail));
  }
  pushMetric(metrics, 'accent', findings, measured);
}

function qualityMetric(metrics, text, label, ui) {
  const quality = [];
  const leaks = internalCopyOf(visibleTextOf(text));
  if (leaks.length) quality.push(finding('quality', DRAW_COPY_INTERNAL, `${label} shows internal copy: ${leaks.slice(0, 5).map((leak) => '"' + leak.match + '" (' + leak.why + ')').join('; ')}`));
  for (const badge of badgesOf(text)) if (!badge.tone) quality.push(finding('quality', DRAW_BADGE_UNTONED, `${label} badge "${badge.text}" binds no tone token`));
  if (ui?.record && ui.state) {
    const commands = commandsFrom(ui.record, ui.state);
    const controls = controlCountOf(text);
    if (commands.length && controls < commands.length) quality.push(finding('quality', DRAW_ACTION_MISSING, `${ui.state} is left by ${commands.length} command(s) (${commands.map((c) => c.id ?? c.trigger).join(', ')}) but the render draws ${controls} control(s)`));
  }
  pushMetric(metrics, 'quality', quality);
}

function paletteMetric(metrics, captures, brand, palette) {
  pushMetric(metrics, 'palette', brand ? captures.flatMap((capture) => paletteFindings({ file: capture.png, shownAs: stemOf(capture.png), brand, palette, subject: 'drawn part', at: capture.png, record: capture.record ?? undefined })
    .filter((f) => f.level === 'refuse').map((f) => finding('palette', f.code, f.message))) : []);
}

const sizeOf = (viewport) => `${viewport.width}x${viewport.height}`;
/** A probe's result, or `{ error }` when it throws or rejects. */
async function probeResult(run) {
  try { return await run(); } catch (error) { return { error: String(error?.message ?? error) }; }
}

function geometryFindingsAt(result, size) {
  if (!result || result.error) return [finding('geometry', DRAW_METRICS_UNVERIFIED, `grammar-geometry could not run at ${size}: ${result?.error ?? 'no result'}`)];
  return list(result.findings).map((f) => finding('geometry', f.code ?? GEOMETRY_OFF_GRAMMAR, `${size} ${f.element ?? ''} ${f.at ?? ''} ${f.property ?? ''} is ${f.got ?? '?'}, the grammar renders ${f.expected ?? '?'}`.replace(/\s+/g, ' ').trim()));
}

function scoreFindingsAt(result, size, png, scores) {
  if (!result || result.error) return [finding('score', DRAW_METRICS_UNVERIFIED, `ui-proof-brief --score could not run at ${size}: ${result?.error ?? 'no result'}`)];
  scores.set(png, result);
  const failed = [...list(result.spacing), ...list(result.cases)].filter((x) => x?.status === 'fail').map((x) => x.id ?? `${x.rule} ${x.case}`);
  const failCount = result.summary?.fail ?? failed.length;
  return failCount > 0 ? [finding('score', DRAW_SCORE_BELOW, `${size} scores ${result.summary?.pass ?? '?'} pass / ${failCount} fail: ${failed.slice(0, 8).join('; ')}`, { count: failed.length })] : [];
}

async function browserMetrics({ captures, html, ui, repo, probeRepo, family, drawCss, probes, scores }) {
  const geometry = [], score = [];
  const probeOptions = { repo: probeRepo ?? repo, family, drawCss };
  await eachInOrder(captures, async (capture) => {
    const viewport = { width: capture.viewport.width, height: capture.viewport.height };
    const size = sizeOf(viewport);
    geometry.push(...geometryFindingsAt(await probeResult(() => probes.geometry(html, viewport, { ...probeOptions })), size));
    const scoreOptions = { ...probeOptions, record: ui?.record ?? null, recordFile: ui?.file ?? null };
    score.push(...scoreFindingsAt(await probeResult(() => probes.score(html, viewport, scoreOptions)), size, capture.png, scores));
  });
  return { geometry, score };
}

function rationaleMetric(metrics, { htmlPath, htmlText, captures, ui, repo, family, label, rationaleFile }) {
  const whyFile = rationaleFile === undefined ? rationaleFileOf(htmlPath) : rationaleFile;
  const why = loadRationale(whyFile);
  const whyRoot = ui?.dir ? workRootOf(ui.dir) : null;
  const redlines = captures.map((capture) => ({ part: stemOf(capture.png), ok: Boolean(capture.record?.redline?.path && isFile(capture.record.redline.path)) }));
  pushMetric(metrics, 'rationale', rationaleFindings({ html: htmlText, entries: why.entries, errors: why.errors, measures: measuresOf(captures.map((capture) => capture.record)), resolve: ruleResolver({ workRoot: whyRoot, record: ui?.record ?? null, repoRoot: repo ?? null }),
    record: ui?.record ?? null, label, redlines }).map((f) => finding('rationale', f.code, f.detail, { count: f.count })), whyFile ? { file: path.basename(whyFile), decisions: why.entries.length } : { file: null });
}

export async function machineMetrics({ html, captures, ui = null, repo, family = null, settings = drawLoopSettings(), probes = browserProbes, proposalDirs = [], rationaleFile = undefined, sourceGate = null, domHtml = null, probeRepo = null, drawCss = {} }) {
  const text = domHtml ?? fs.readFileSync(html, 'utf8');
  const component = sourceGate != null;
  const label = path.basename(html);
  const metrics = [], scores = new Map();
  sourceMetric(metrics, component, sourceGate);
  renderMetric(metrics, captures);
  dnaMetric(metrics, { text, captures, ui, family, label, proposalDirs, sourceGate });
  layerMetric(metrics, text, captures, label);
  pushMetric(metrics, 'taste', htmlTasteFindings(text, { settings, label }).map((f) => finding('taste', f.code, f.detail, { count: f.count })));
  const workRoot = ui?.dir ? workRootOf(ui.dir) : null;
  const brandInfo = workRoot ? brandOf(workRoot) : { brand: null };
  const palette = brandInfo.brand ? brandPalette(brandInfo.brand, { brandDir: brandInfo.dir }) : null;
  const primary = palette?.primary?.hex ? parseColor(palette.primary.hex) : null;
  accentMetric(metrics, captures, text, settings, primary);
  qualityMetric(metrics, text, label, ui);
  paletteMetric(metrics, captures, brandInfo.brand, palette);
  const browser = await browserMetrics({ captures, html, ui, repo, probeRepo, family, drawCss, probes, scores });
  pushMetric(metrics, 'geometry', browser.geometry);
  pushMetric(metrics, 'score', browser.score);
  rationaleMetric(metrics, { htmlPath: html, htmlText: text, captures, ui, repo, family, label, rationaleFile });
  const failures = metrics.flatMap((m) => m.findings);
  return {
    doc: { schema: METRICS_SCHEMA, html: path.basename(html), htmlSha256: sha256(text), ...(component ? { mode: 'component', source: sourceGate.file ? path.basename(sourceGate.file) : null, sourceSha256: sourceGate.sha256 ?? null } : {}), viewports: captures.map((capture) => ({ width: capture.viewport.width, height: capture.viewport.height, part: stemOf(capture.png) })),
      metrics, failures: failures.length, codes: [...new Set(failures.map((f) => f.code))].sort(byCodeUnit), allPass: failures.length === 0 },
    scores,
  };
}
