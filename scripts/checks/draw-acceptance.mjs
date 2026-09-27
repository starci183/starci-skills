#!/usr/bin/env node
// draw-acceptance.mjs — what an interface.draw pass is judged by: EVERY asset its accepted record binds, the files it
// wrote and the ones it adopted, inherited or found already there alike (nivo wf-nivo-app-auth-mujek72s
// op-interface.draw-7c2821e002 settled pass by committing 40 image-gen evidence files of three older jobs unchanged).
//
// Owner ruling 2026-09-27: interface.draw draws shapes only - one image per XBase#state of the ui record's ui.shapes -
// token-rendered by scripts/work/draw-render.mjs, never an image-gen whole screen, and never a data status. So a pass
// is refused when what it binds:
//   DRAW_ASSET_NOT_TOKEN_RENDERED  an image under a ui record's assets, or a live drawing of a bound record, carries no
//                                  draw-render receipt (the record's `generation.tool: draw-render`, or a
//                                  starci/draw-render@1 capture record whose image sha256 is the file's), or carries
//                                  image-gen provenance (`generation.tool: image_gen.imagegen` on a drawing, a draws
//                                  entry with provenance.tool other than draw-render, an evidence record asserting
//                                  `imagegen-provenance`). A raster region beside a live draw-render drawing is not a
//                                  drawing and passes; a retired asset is a kept proof, never a drawing;
//   DATA_STATUS_DRAWN              a bound record draws or lists a data status (scripts/checks/ui-shapes.mjs), or a
//                                  draws / selected-matrix entry names one as its state;
//   DRAW_NOT_SHAPES                a bound record declares no ui.shapes (and is not rendered by recipe), draws a state
//                                  that is none of its shapes, or a draws / selected-matrix entry names a screen with
//                                  no shape (XBase#state);
//   DRAW_NOT_REDRAWN               the pass binds no token-rendered drawing and no recipe-rendered record: it adopted
//                                  or reused prior evidence without drawing under the current contract.
// Adopting a prior drawing is allowed only when that drawing itself meets all of the above.
//
//   node scripts/checks/draw-acceptance.mjs --repo <repo> (--job <jobId> | --files <a,b,...>) [--json]
// --job reads the ledger read-only for the job's report files and owned paths. Exit 0 accepted, 1 refused, 2 usage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { assetsOf, list, slash } from '../work/work-io.mjs';
import { DATA_STATUS_DRAWN, DRAWING_ROLES, DRAW_TOOL, RASTER_TOOL, assetStateOf, dataStatusOf, drawingsOf, recipeRenderedOf, uiShapeFindings } from './ui-shapes.mjs';

export const DRAW_ASSET_NOT_TOKEN_RENDERED = 'DRAW_ASSET_NOT_TOKEN_RENDERED';
export const DRAW_NOT_SHAPES = 'DRAW_NOT_SHAPES';
export const DRAW_NOT_REDRAWN = 'DRAW_NOT_REDRAWN';
export { DATA_STATUS_DRAWN };
export const DRAW_ACCEPTANCE_CODES = Object.freeze([DRAW_ASSET_NOT_TOKEN_RENDERED, DATA_STATUS_DRAWN, DRAW_NOT_SHAPES, DRAW_NOT_REDRAWN]);
/** The contract change that made the draw acceptance judge every bound asset (modules/kernel/contract-changes.yaml). */
export const DRAW_ACCEPTANCE_CHANGE = 'draw-adopt-gate';
export const RENDER_RECORD_SCHEMA = 'starci/draw-render@1';
export const IMAGEGEN_ASSERTION = 'imagegen-provenance';
/** The `retired` reason of a drawing image_gen.imagegen painted before token rendering (work-ui-screen.schema.yaml). */
export const RETIRED_IMAGE_GEN = 'image-gen';

const IMAGE = /\.(png|jpe?g|webp)$/i;
const UI_SCHEMA = 'work/ui-screen@1';
const readDoc = (file) => {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return /\.json$/i.test(file) ? JSON.parse(text) : parseYaml(text);
  } catch { return null; }
};
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const shaOf = (file) => { try { return sha256File(file); } catch { return null; } };
const inAssets = (rel) => /(^|\/)assets\//.test(rel);

/** The ui record directory a file belongs to: the nearest ancestor (or itself) holding a work/ui-screen@1 index.yaml under .starciwork. */
export function uiRecordDirOf(abs) {
  let dir = isDir(abs) ? abs : path.dirname(abs);
  for (let hop = 0; hop < 8; hop += 1) {
    if (!slash(dir).includes('/.starciwork/')) return null;
    const index = path.join(dir, 'index.yaml');
    if (isFile(index) && readDoc(index)?.schema === UI_SCHEMA) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}

const imageProvenanceOf = (abs) => {
  const stem = abs.replace(/\.[^.]+$/, '');
  for (const prompt of [`${stem}.prompt.txt`, `${stem.replace(/\.content$/, '')}.prompt.txt`]) {
    if (!isFile(prompt)) continue;
    const head = fs.readFileSync(prompt, 'utf8').slice(0, 400);
    if (/^Use case:\s*ui-mockup/im.test(head) || /image_gen|imagegen/i.test(head)) return 'image-gen prompt';
  }
  return null;
};

/** Every starci/draw-render@1 capture record beside the given files or in their directories: Map(sha256 -> record path). */
function renderReceiptsNear(files) {
  const out = new Map();
  const dirs = new Set(files.map((f) => path.dirname(f)));
  for (const dir of dirs) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      const doc = readDoc(path.join(dir, name));
      if (doc?.schema === RENDER_RECORD_SCHEMA && doc.ok !== false && typeof doc.image?.sha256 === 'string') out.set(doc.image.sha256, path.join(dir, name));
    }
  }
  return out;
}

/** Findings for one ui record: [{code, path, detail}] and whether it holds a token-rendered drawing or is recipe-rendered. */
function judgeRecord(recordDir, repo) {
  const index = path.join(recordDir, 'index.yaml');
  const record = readDoc(index);
  const rel = slash(path.relative(repo, index));
  const findings = [];
  for (const f of uiShapeFindings(record)) if (f.code === DATA_STATUS_DRAWN) findings.push({ code: f.code, path: rel, detail: f.detail });
  const recipe = recipeRenderedOf(record);
  if (recipe) return { record, findings, drawn: false, recipe: true, tokenRendered: new Set() };
  const shapes = list(record?.ui?.shapes);
  if (!shapes.length) findings.push({ code: DRAW_NOT_SHAPES, path: rel, detail: `${rel} declares no ui.shapes: a drawing is one image per XBase#state of ui.shapes, never a whole screen (scripts/work/migrate-ui-shapes.mjs writes them)` });
  const shapeStates = new Set(shapes.map((s) => String(s?.state)));
  const live = assetsOf(record).filter((a) => !a.retired && a.selected !== false);
  const drawRendered = live.filter((a) => a.generation?.tool === DRAW_TOOL);
  const tokenRendered = new Set(drawRendered.map((a) => slash(path.resolve(recordDir, a.path))));
  for (const a of live) {
    if (!DRAWING_ROLES.has(a.role)) {
      // A raster region is legal only beside a live token-rendered drawing.
      if (a.generation?.tool === RASTER_TOOL && !drawRendered.length) {
        findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: slash(path.join(path.relative(repo, recordDir), a.path)), detail: `${a.path} is an image_gen.imagegen image in a record with no draw-render drawing: nothing token-rendered embeds it` });
      }
      continue;
    }
    const at = slash(path.join(path.relative(repo, recordDir), a.path));
    if (a.generation?.tool !== DRAW_TOOL) {
      findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: at, detail: `${a.path} (${a.role}) is a live drawing with ${a.generation?.tool ? `generation.tool ${a.generation.tool}` : 'no generation receipt'}: a drawing is token-rendered by draw-render; redraw the shape through draw-render and retire this file (retired: ${RETIRED_IMAGE_GEN}); it is kept, never deleted` });
    }
    const state = assetStateOf(record, a);
    if (shapes.length && state && !shapeStates.has(state) && !dataStatusOf(state)) {
      findings.push({ code: DRAW_NOT_SHAPES, path: at, detail: `${a.path} draws "${state}", which is none of the record's ui.shapes states` });
    }
  }
  for (const d of drawingsOf(record)) {
    if (d.via === 'coverage.map' && !tokenRendered.has(slash(path.resolve(recordDir, d.path))) && !live.some((a) => slash(a.path) === d.path)) {
      findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: slash(path.join(path.relative(repo, recordDir), d.path)), detail: `coverage.map names ${d.path} as the drawing of "${d.state}" but the record carries no draw-render receipt for it` });
    }
  }
  return { record, findings, drawn: drawRendered.some((a) => DRAWING_ROLES.has(a.role)), recipe: false, tokenRendered };
}

/** Findings for one bound evidence document (draws.yaml, a work/evidence@1 draw audit, a manifest). */
function judgeEvidence(abs, doc, repo) {
  const rel = slash(path.relative(repo, abs));
  const findings = [];
  const assertions = [...list(doc?.assertions), ...list(doc?.proofs)];
  if (assertions.some((a) => a?.id === IMAGEGEN_ASSERTION) || doc?.assertions?.[IMAGEGEN_ASSERTION]) {
    findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: rel, detail: `${rel} asserts ${IMAGEGEN_ASSERTION}: the drawing proof is render-provenance (a draw-render capture), never an image-gen invocation` });
  }
  const entries = [...list(doc?.draws).map((e) => ['draws', e]), ...list(doc?.selectedMatrix?.cells).map((e) => ['selectedMatrix.cells', e])];
  for (const [where, e] of entries) {
    if (!e || typeof e !== 'object') continue;
    const id = e.id ?? e.state ?? '?';
    const status = dataStatusOf(e.state);
    if (status && !e.nonDerivable) findings.push({ code: DATA_STATUS_DRAWN, path: rel, detail: `${rel} ${where} ${id} draws "${e.state}", the data status ${status.status}; data statuses render by recipe` });
    if (!e.shape && !e.base) findings.push({ code: DRAW_NOT_SHAPES, path: rel, detail: `${rel} ${where} ${id} names ${e.screen ? `screen ${e.screen}` : 'no shape'}: each drawing is one XBase#state shape` });
    const tool = e.provenance?.tool ?? e.generation?.tool ?? null;
    if (tool !== DRAW_TOOL) findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: rel, detail: `${rel} ${where} ${id} records ${tool ? `provenance.tool ${tool}` : 'no provenance.tool'}, not draw-render` });
  }
  return findings;
}

const walkImages = (dir, out, depth = 0) => {
  if (depth > 4) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkImages(abs, out, depth + 1);
    else if (IMAGE.test(e.name) || /\.(ya?ml|json)$/i.test(e.name)) out.push(abs);
  }
};

/**
 * Judge an interface.draw pass over the files it binds (absolute paths or repo-relative; directories are walked).
 * Returns {ok, findings:[{code, path, detail}], records:[repo-relative index paths], drawn:boolean}.
 */
export function drawAcceptanceFindings({ repo, files }) {
  const abs = [];
  for (const f of list(files)) {
    const p = path.isAbsolute(f) ? f : path.resolve(repo, f);
    if (isDir(p)) walkImages(p, abs);
    else if (isFile(p)) abs.push(p);
  }
  const unique = [...new Map(abs.map((p) => [slash(path.resolve(p)).toLowerCase(), path.resolve(p)])).values()];
  const findings = [];
  const recordDirs = new Map();
  for (const p of unique) {
    const dir = uiRecordDirOf(p);
    if (dir && !recordDirs.has(slash(dir).toLowerCase())) recordDirs.set(slash(dir).toLowerCase(), dir);
  }
  const judged = [...recordDirs.values()].map((dir) => ({ dir, ...judgeRecord(dir, repo) }));
  for (const r of judged) findings.push(...r.findings);
  const receipts = renderReceiptsNear(unique.filter((p) => IMAGE.test(p)));
  let drawn = judged.some((r) => r.drawn || r.recipe);
  for (const p of unique) {
    const rel = slash(path.relative(repo, p));
    if (IMAGE.test(p)) {
      const owner = judged.find((r) => slash(p).toLowerCase().startsWith(`${slash(r.dir).toLowerCase()}/`));
      if (!owner || !inAssets(slash(path.relative(owner.dir, p)))) continue;
      const assetRel = slash(path.relative(owner.dir, p));
      const asset = assetsOf(owner.record).find((a) => slash(a.path) === assetRel);
      if (asset?.retired) continue;
      if (owner.tokenRendered.has(slash(p))) continue;
      const sha = shaOf(p);
      if (sha && receipts.has(sha)) { drawn = true; continue; }
      if (asset && !DRAWING_ROLES.has(asset.role) && asset.generation?.tool === RASTER_TOOL && owner.drawn) continue;
      if (asset && DRAWING_ROLES.has(asset.role)) continue; // judged with its record above
      const why = asset?.generation?.tool === RASTER_TOOL ? 'generation.tool image_gen.imagegen' : imageProvenanceOf(p) ?? 'no draw-render receipt';
      findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: rel, detail: `${rel} is bound by the draw with ${why}: a drawing is a draw-render capture of one XBase#state, never an image-gen whole screen; adopt a prior drawing only when it meets the current contract` });
      continue;
    }
    if (/\.(ya?ml|json)$/i.test(p)) {
      const doc = readDoc(p);
      if (doc && typeof doc === 'object' && doc.schema !== UI_SCHEMA && (doc.draws || doc.selectedMatrix || doc.assertions || doc.proofs)) findings.push(...judgeEvidence(p, doc, repo));
    }
  }
  if (!drawn) findings.push({ code: DRAW_NOT_REDRAWN, path: null, detail: 'the pass binds no token-rendered drawing (draw-render receipt) and no recipe-rendered record: adopting or reusing prior evidence without drawing under the current contract does not satisfy interface.draw' });
  const seen = new Set();
  const deduped = findings.filter((f) => { const k = `${f.code}|${f.path}|${f.detail}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok: deduped.length === 0, findings: deduped, records: judged.map((r) => slash(path.relative(repo, path.join(r.dir, 'index.yaml')))), drawn };
}

/** The files a settled or settling job binds: its report files and its owned paths (read-only on `db`). */
export function jobBoundFiles(db, jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) return null;
  let payload = {};
  try { payload = JSON.parse(job.payload_json ?? '{}') ?? {}; } catch { payload = {}; }
  const files = [...list(payload.owned_paths)];
  const reports = db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? ORDER BY report_id DESC').all(job.workflow_id, job.op_id, job.attempt);
  for (const r of reports) {
    try { files.push(...list(JSON.parse(r.report_json)?.files)); } catch { /* unreadable report */ }
  }
  return { job, payload, files: [...new Set(files.filter((f) => typeof f === 'string' && f.trim()))] };
}

async function main(argv) {
  const get = (name) => { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
  const repo = get('--repo'), jobId = get('--job'), filesArg = get('--files'), json = argv.includes('--json');
  if (!repo || (!jobId && !filesArg)) {
    process.stderr.write('use: node scripts/checks/draw-acceptance.mjs --repo <repo> (--job <jobId> | --files <a,b,...>) [--json]\n');
    return 2;
  }
  let files = filesArg ? filesArg.split(',').map((s) => s.trim()).filter(Boolean) : [];
  let job = null;
  if (jobId) {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(path.join(repo, '.starciwork', 'runtime.sqlite'), { readOnly: true });
    try {
      const bound = jobBoundFiles(db, jobId);
      if (!bound) { process.stderr.write(`unknown job ${jobId}\n`); return 2; }
      job = { jobId, op: bound.job.op_id, status: bound.job.status, commitOnly: bound.payload.commitOnly ?? null };
      files = bound.files;
    } finally { db.close(); }
  }
  const out = { ...drawAcceptanceFindings({ repo: path.resolve(repo), files }), ...(job ? { job } : {}) };
  if (json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  else process.stdout.write(`${out.ok ? 'accepted' : 'REFUSED'}${job ? ` ${job.jobId}` : ''}: ${out.findings.length} finding(s)\n${out.findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}\n`);
  return out.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => { process.stderr.write(`${error?.stack ?? error}\n`); process.exit(2); });
}
