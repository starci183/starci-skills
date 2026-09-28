// artifact-subkind.mjs — what produced one indexed artifact (job_artifacts.subkind), derived from facts only: the
// op id of the job that owns it, the path conventions the runtime's own writers use, and the ui record manifests
// (<ui record>/index.yaml assets[].generation.tool). Never a guess: a file no rule below proves stays null.
//
//   subkind            proven by
//   patch              kind patch (the job .patch writeJobPatch cut)
//   patch-json         <job>.patch.json (patch-json.mjs writePatchJson)
//   diff               kind diff (a .diff file)
//   playwright-trace   kind trace (trace.zip, *.trace.zip, *.trace)
//   critique           critique*.json (draw-loop's independent critic, scripts/work/draw-critic.mjs)
//   metrics            metrics.json, *-metrics.json, *.metrics.json, *.score.json (draw-loop round metrics)
//   grammar-proposal   grammar-proposal*.{md,yaml,yml,json} (scripts/work/grammar-proposal.mjs)
//   asset-request      asset-request*.{md,yaml,yml,json}
//   draw-render        an image (or its prompt) a manifest (index.yaml/draws.yaml/manifest.yaml) gives generation.tool or
//                      provenance.tool draw-render; any file of
//                      a draw-loop round (draw-loop/<shape>/round-<n>/) that is not critique or metrics; an image
//                      beside a starci/draw-render@1 record (<stem>.json); a token-render/redraw/draft directory
//   asset-gen          an image (or its prompt) a manifest gives tool image_gen.*; any image
//                      an interface.asset job produced
//   uat-capture        an image of a uat.* job, or under a features/<f>/uat/ record
//   e2e-capture        an image of an e2e.verify job, or under a features/<f>/e2e/ record
//   app-capture        an image of the running app: under features/<f>/(impl|operations)/ in a capture directory
//                      (E, E-*, evidence, screens, captures, live, observed, renders, calibration, tools), or any
//                      capture-directory image of an interface.implement / interface.audit / interface.scaffold job
//   uat-video          a video of a uat.* job, or under a features/<f>/uat/ record
//   e2e-video          a video of an e2e.verify job, or under a features/<f>/e2e/ record
//   report             kind report (a job's report envelope or filed report)
//   log                kind log (.log/.txt/.out/.jsonl, the typed-log sidecar)
import fs from 'node:fs';
import path from 'node:path';
import { JOB_ARTIFACT_SUBKINDS } from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export { JOB_ARTIFACT_SUBKINDS };
export const DRAW_RENDER_SCHEMA = 'starci/draw-render@1';

const UAT_OPS = new Set(['uat.verify', 'uat.assisted.prepare', 'uat.assisted.verify']);
const E2E_OPS = new Set(['e2e.verify']);
const APP_OPS = new Set(['interface.implement', 'interface.audit', 'interface.scaffold']);
const CAPTURE_SEG = /^(?:e|e-[^/]+|evidence|screens|captures|live|observed|renders|calibration|tools)$/i;
const TOKEN_DIR = /^(?:token-render(?:-.+)?|token-redraw(?:-.+)?|token-draft|token-\d[^/]*)$/i;

const slashed = (p) => String(p ?? '').replace(/\\/g, '/');

/** The generation tool a manifest names, as a subkind: draw-render, asset-gen, or null. */
export function subkindOfTool(tool) {
  const t = String(tool ?? '').trim().toLowerCase();
  if (!t) return null;
  if (t === 'draw-render') return 'draw-render';
  if (/^image[_-]?gen\b|imagegen/.test(t)) return 'asset-gen';
  return null;
}

// ------------------------------------------------------------------------------------------ manifests
const recordCache = new Map();
const readRecord = (dir, name = 'index.yaml') => {
  const key = path.join(dir, name);
  if (!recordCache.has(key)) { let doc = null; try { const st = fs.statSync(key); doc = st.size < 8 * 1024 * 1024 ? parseYaml(fs.readFileSync(key, 'utf8')) : null; } catch { doc = null; } recordCache.set(key, doc); }
  return recordCache.get(key);
};
/** Forget cached ui records (a backfill run or a spec that rewrites them). */
export const clearManifestCache = () => { recordCache.clear(); recordIndexCache.clear(); drawRecordCache.clear(); };

const MANIFEST_FILES = new Set(['index.yaml', 'draws.yaml', 'manifest.yaml']);
const NAME_KEYS = ['path', 'image', 'file', 'prompt', 'promptPath'];
const MANIFEST_WALK_DEPTH = 5;
const MANIFEST_WALK_MAX = 400;
const toolOfNode = (node) => {
  const gen = node.generation && typeof node.generation === 'object' ? node.generation : null;
  const prov = node.provenance && typeof node.provenance === 'object' ? node.provenance : null;
  return gen?.tool ?? prov?.tool ?? null;
};
// The file names an entry carrying a tool speaks for: its own path-like keys, generation.promptPath, and the path of
// each direct child object (a draws.yaml entry's part / composite / prompt).
const namesOfNode = (node) => [
  ...NAME_KEYS.map((k) => node[k]), node.generation?.promptPath,
  ...Object.values(node).filter((v) => v && typeof v === 'object' && !Array.isArray(v)).map((v) => v.path),
].filter((v) => typeof v === 'string' && v.trim());
const keyOfAbs = (abs) => (process.platform === 'win32' ? path.resolve(abs).toLowerCase() : path.resolve(abs));

const recordIndexCache = new Map();
/**
 * The generation tools one record's manifests declare, as Map<absolute path key, tool>: every index.yaml, draws.yaml
 * and manifest.yaml under the record directory (depth-bounded), index.yaml first so the record's own entry wins. A
 * named path is resolved against the manifest's directory, the record directory and the repository.
 */
function recordToolIndex(repo, recordDir) {
  if (recordIndexCache.has(recordDir)) return recordIndexCache.get(recordDir);
  const manifests = [];
  const visitDir = (dir, depth) => {
    if (depth > MANIFEST_WALK_DEPTH || manifests.length >= MANIFEST_WALK_MAX) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isFile() && MANIFEST_FILES.has(e.name)) manifests.push(path.join(dir, e.name));
    for (const e of entries) if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') visitDir(path.join(dir, e.name), depth + 1);
  };
  visitDir(recordDir, 0);
  manifests.sort((a, b) => (path.basename(a) === 'index.yaml' ? 0 : 1) - (path.basename(b) === 'index.yaml' ? 0 : 1) || a.length - b.length);
  const index = new Map();
  for (const file of manifests) {
    const doc = readRecord(path.dirname(file), path.basename(file));
    if (!doc || typeof doc !== 'object') continue;
    const bases = [path.dirname(file), recordDir, repo];
    const visit = (node, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 12) return;
      if (Array.isArray(node)) { for (const v of node) visit(v, depth + 1); return; }
      const tool = toolOfNode(node);
      if (tool) for (const name of namesOfNode(node)) for (const base of bases) { const k = keyOfAbs(path.resolve(base, name)); if (!index.has(k)) index.set(k, String(tool)); }
      for (const v of Object.values(node)) visit(v, depth + 1);
    };
    visit(doc);
  }
  recordIndexCache.set(recordDir, index);
  return index;
}

/**
 * The generation tool a manifest declares for `rel` (repo-relative) inside a ui or impl record
 * (features/<f>/(ui|impl)[/<surface>]/...): an entry carrying generation.tool or provenance.tool that names the file
 * (recordToolIndex). Null when no manifest of its record names it.
 */
export function manifestToolOf(repo, rel) {
  if (!repo) return null;
  const file = slashed(rel);
  const m = /^(\.starciwork\/features\/[^/]+\/(?:ui|impl))(\/[^/]+)?\//.exec(file);
  if (!m) return null;
  // The record: features/<f>/ui (or impl) when it is one record itself, else features/<f>/ui/<surface>.
  const top = path.resolve(repo, m[1]);
  const recordDir = fs.existsSync(path.join(top, 'index.yaml')) || !m[2] ? top : path.resolve(repo, m[1] + m[2]);
  return recordToolIndex(repo, recordDir).get(keyOfAbs(path.resolve(repo, file))) ?? null;
}

const drawRecordCache = new Map();
/** True when `<stem>.json` beside the image is a starci/draw-render@1 record (scripts/work/draw-render.mjs captureHtml). */
export function hasDrawRenderRecord(abs) {
  const json = abs.replace(/\.[^./\\]+$/, '.json');
  if (!drawRecordCache.has(json)) {
    let ok = false;
    try { const st = fs.statSync(json); if (st.size < 2 * 1024 * 1024) ok = JSON.parse(fs.readFileSync(json, 'utf8'))?.schema === DRAW_RENDER_SCHEMA; } catch { ok = false; }
    drawRecordCache.set(json, ok);
  }
  return drawRecordCache.get(json);
}

// ----------------------------------------------------------------------------------------- derivation
/**
 * The subkind of one artifact: {kind, path (repo-relative, the stored job_artifacts.path), opId, origin?, repo?}.
 * `origin` (a copied file's source path) is read as the path conventions' second witness. `repo` enables the
 * manifest and draw-render record lookups; without it only the op id and the path decide. Null when unproven.
 */
export function subkindOf({ kind, path: rel, opId = null, origin = null, repo = null }) {
  const file = slashed(rel);
  const lower = file.toLowerCase();
  const base = lower.split('/').pop() ?? '';
  const segs = lower.split('/');
  const from = slashed(origin).toLowerCase();
  const paths = [lower, ...(from ? [from] : [])];
  const op = String(opId ?? '');

  if (kind === 'patch' || base.endsWith('.patch')) return 'patch';
  if (base.endsWith('.patch.json')) return 'patch-json';
  if (kind === 'diff' || base.endsWith('.diff')) return 'diff';
  if (kind === 'trace' || base === 'trace.zip' || base.endsWith('.trace.zip') || base.endsWith('.trace')) return 'playwright-trace';
  if (/^critique(?:[-.][^/]*)?\.json$/.test(base)) return 'critique';
  if (/^(?:metrics|[^/]+[-.]metrics)\.json$/.test(base) || base.endsWith('.score.json')) return 'metrics';
  if (/^grammar-proposal(?:[-.][^/]*)?\.(?:md|ya?ml|json)$/.test(base)) return 'grammar-proposal';
  if (/^asset-request(?:[-.][^/]*)?\.(?:md|ya?ml|json)$/.test(base)) return 'asset-request';

  const inDrawLoopRound = paths.some((p) => /\/draw-loop\/[^/]+\/round-\d+\//.test(p));
  const isImage = kind === 'image';
  const isPrompt = /\.prompt\.(?:txt|md)$/.test(base);
  if (isImage || isPrompt) {
    const tool = subkindOfTool(manifestToolOf(repo, file));
    if (tool) return tool;
  }
  if (inDrawLoopRound && kind !== 'report' && kind !== 'log') return 'draw-render';
  if (isImage) {
    if (segs.some((s) => TOKEN_DIR.test(s))) return 'draw-render';
    if (repo && hasDrawRenderRecord(path.join(repo, file))) return 'draw-render';
    if (op === 'interface.asset') return 'asset-gen';
    if (UAT_OPS.has(op) || paths.some((p) => /(?:^|\/)features\/[^/]+\/uat\//.test(p))) return 'uat-capture';
    if (E2E_OPS.has(op) || paths.some((p) => /(?:^|\/)features\/[^/]+\/e2e\//.test(p))) return 'e2e-capture';
    const dirs = segs.slice(0, -1);
    const captureDir = dirs.some((s) => CAPTURE_SEG.test(s)) && !dirs.includes('lcov-report') && !dirs.includes('coverage');
    if (captureDir && /(?:^|\/)features\/[^/]+\/(?:impl|operations)\//.test(lower)) return 'app-capture';
    if (captureDir && APP_OPS.has(op)) return 'app-capture';
    return null;
  }
  if (kind === 'video') {
    if (UAT_OPS.has(op) || paths.some((p) => /(?:^|\/)features\/[^/]+\/uat\//.test(p))) return 'uat-video';
    if (E2E_OPS.has(op) || paths.some((p) => /(?:^|\/)features\/[^/]+\/e2e\//.test(p))) return 'e2e-video';
    return null;
  }
  if (kind === 'report') return 'report';
  if (kind === 'log') return 'log';
  return null;
}

