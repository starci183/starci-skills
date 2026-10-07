// The surface per-record concepts of the example Work standard (check-example-work.mjs): a ui record is done only
// with a generated drawing and full state coverage, generated assets are ui-owned, a done uat-flow cites a
// settled passing run, and typed _resources custody uses the resource schema. Each rule is `(ctx, rec)` and appends
// to ctx.problems.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { blobPath, getBlob } from '../../../engine/db/blob.mjs';
import { DRAW_TOOL, RASTER_TOOL, generatedDrawingsOf, recipeRenderedOf, uiShapeFindings } from '../ui/ui-shapes.mjs';
import { ASSET_SLOT_UNFILLED, assetSlotsOf } from '../asset-slot.mjs';

/** Why an artwork slot is still owed, in the words of the first reason that holds. */
const slotOwedReason = (slot) => (slot.master && 'its bytes are a brand master (the landing art), not a new generation')
  || (!slot.sha256 && 'it is still the drawing placeholder')
  || (!slot.prompt && 'no prompt.txt names its generation')
  || 'data-asset-sha256 is not the bytes of its src';

// Owner ruling 2026-09-27: a product artwork slot is a NEW interface.asset generation (sha + prompt), never a
// brand master (the landing's art) and never a placeholder - the surface is not done while one is owed.
function checkOwedArtworkSlots({ problems, workRoot }, rec) {
  for (const slot of assetSlotsOf([rec.dir], {repo: path.dirname(workRoot)}).filter(s => !s.filled)) {
    problems.push(`${rec.shown}: state is done but artwork slot "${slot.id}" (${slot.html}) is owed - ${slotOwedReason(slot)}; interface.asset fills it with a new generation (src, data-asset-sha256, data-asset-prompt) [${ASSET_SLOT_UNFILLED}]`);
  }
}

function checkUiStateCoverage({ problems }, rec) {
  const uiSpec = rec.data.ui;
  if (!uiSpec) return;
  const stateNames = (uiSpec.states ?? []).map(s => s?.name).filter(Boolean);
  const covered = new Set((uiSpec.coverage?.map ?? []).map(m => m?.state));
  for (const name of stateNames) {
    if (!covered.has(name)) problems.push(`${rec.shown}: ui.coverage.map names no entry for state "${name}", which ui.states lists`);
  }
}

// ---- concept 10: a ui record is done only with a generated drawing (or rendered by recipe) and full state coverage ----
function checkUiScreenDone(ctx, rec) {
  const data = rec.data;
  if (rec.schema !== 'work/ui-screen@1' || data.state !== 'done') return;
  if (!recipeRenderedOf(data) && !generatedDrawingsOf(data.assets).length) {
    ctx.problems.push(`${rec.shown}: state is done but no asset carries generation.tool: ${DRAW_TOOL} (${RASTER_TOOL} on a record drawn before token rendering) - a ui record is done only with at least one interface.draw direction, never an authored claim`);
  }
  checkOwedArtworkSlots(ctx, rec);
  checkUiStateCoverage(ctx, rec);
}

// ---- concept 10b: a ui record draws shapes, never a slot's data status (scripts/work/ui/ui-shapes.mjs) ----
function checkUiShapes({ problems }, rec) {
  for (const finding of uiShapeFindings(rec.data)) problems.push(`${rec.shown}: ${finding.detail} [${finding.code}]`);
}

// ---- concept 11: a generation-carrying asset is ui-owned direction, never an implementation capture ----
function checkAssetGeneration({ problems }, rec) {
  const { data, schema } = rec;
  if (!Array.isArray(data.assets)) return;
  for (const a of data.assets) {
    if (!a || typeof a !== 'object' || !a.generation) continue;
    if (schema === 'work/implementation@1') {
      problems.push(`${rec.shown}: implementation asset ${a.path ?? a.name} carries generation - implementation captures are real running-page screenshots and never carry ImageGen generation provenance`);
    } else if (schema !== 'work/ui-screen@1') {
      problems.push(`${rec.shown}: asset ${a.path} carries generation but the owning record is ${schema}, not work/ui-screen@1 - a generated direction asset is ui-owned only`);
    }
  }
}

const cited = (v) => [v || []].flat().filter((c) => c && typeof c === 'object' && /^[a-f0-9]{64}$/.test(String(c.sha256 ?? '')));

/** The bytes of a cited result: the artifact store when the read context names one, else the shared blob store (null when none). */
const resultBytesOf = (blobOptions, sha256) => {
  if (blobOptions.root != null) return getBlob(sha256, blobOptions);
  const file = blobPath(sha256);
  return file ? fs.readFileSync(file) : null;
};

function checkCitedResult({ problems, blobOptions }, rec, { ev, run }) {
  try {
    const bytes = resultBytesOf(blobOptions, cited(run.result)[0].sha256);
    const outcome = bytes ? (/outcome:\s*pass/i.test(bytes.toString('utf8')) && 'pass' || 'not-pass') : (run.outcome ?? ev.outcome ?? null);
    if (outcome !== 'pass') problems.push(`${rec.shown}: run ${run.id ?? '?'}'s result does not record outcome: pass`);
  } catch (error) {
    if (blobOptions.root == null) throw error;
    problems.push(`${rec.shown}: run ${run.id ?? '?'}'s selected result bytes cannot be verified: ${error.message} [UAT_RESULT_INVALID]`);
  }
}

/** The run is agent data in the blob store; evidence.yaml cites its files by sha256 (+ artifact id). */
function checkCitedRun(ctx, rec, ev) {
  const { problems } = ctx;
  const run = ev.run;
  if (!cited(run.screens).length) problems.push(`${rec.shown}: run ${run.id ?? '?'} cites no screenshot (run.screens[] {artifact?, sha256})`);
  if (!cited(run.videos).length) problems.push(`${rec.shown}: run ${run.id ?? '?'} cites no playable recording (run.videos[] {artifact?, sha256})`);
  if (!cited(run.result).length) problems.push(`${rec.shown}: run ${run.id ?? '?'} cites no result (run.result {artifact?, sha256})`);
  else checkCitedResult(ctx, rec, { ev, run });
}

function checkRunDirectory({ problems }, rec, ev) {
  const runDir = path.join(rec.dir, ev.run);
  const screensDir = path.join(runDir, 'screens');
  const videosDir = path.join(runDir, 'videos');
  const resultFile = path.join(runDir, 'result.md');
  const hasFiles = dir => fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  if (!hasFiles(screensDir)) { problems.push(`${rec.shown}: run ${ev.run} has no screens/ with at least one screenshot`); }
  if (!hasFiles(videosDir)) { problems.push(`${rec.shown}: run ${ev.run} has no videos/ with at least one playable recording`); }
  if (!fs.existsSync(resultFile)) {
    problems.push(`${rec.shown}: run ${ev.run} has no result.md`);
  } else if (!/outcome:\s*pass/i.test(fs.readFileSync(resultFile, 'utf8'))) {
    problems.push(`${rec.shown}: run ${ev.run}'s result.md does not record outcome: pass`);
  }
}

// ---- concept 12: a done uat-flow needs a settled run with screens, video and a passing result.md ----
function checkUatFlowDone(ctx, rec) {
  if (rec.schema !== 'work/uat-flow@1' || rec.data.state !== 'done') return;
  const evidenceFile = path.join(rec.dir, 'evidence.yaml');
  if (!fs.existsSync(evidenceFile)) {
    ctx.problems.push(`${rec.shown}: state is done but there is no sibling evidence.yaml naming the run it settled on`);
    return;
  }
  const ev = parseYaml(fs.readFileSync(evidenceFile, 'utf8'));
  if (ev?.run && typeof ev.run === 'object') checkCitedRun(ctx, rec, ev);
  else if (!ev?.run) ctx.problems.push(`${rec.shown}: evidence.yaml has no run - a done uat-flow must cite the exact run it settled on (run {id, result, screens[], videos[]} by sha256)`);
  else checkRunDirectory(ctx, rec, ev);
}

// ---- concept 13: typed _resources custody uses exactly the work/resource@1 schema ----
function checkResourceCustodySchema({ problems }, rec) {
  const file = rec.file.replaceAll('\\', '/');
  if (file.includes('/_resources/') && file.endsWith('/resource.yaml') && rec.schema !== 'work/resource@1') {
    problems.push(`${rec.shown}: _resources custody uses schema work/resource@1, not "${rec.schema}"`);
  }
}

/** The surface rules in the order they run for each record. */
export const surfaceRules = [checkUiScreenDone, checkUiShapes, checkAssetGeneration, checkUatFlowDone, checkResourceCustodySchema];
