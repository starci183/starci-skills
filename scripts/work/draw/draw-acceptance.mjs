#!/usr/bin/env node
// draw-acceptance.mjs — what an interface.draw pass is judged by: EVERY asset its accepted record binds, the files it
// wrote and the ones it adopted, inherited or found already there alike (a product's wf-<product>-app-auth-mujek72s
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
//   DATA_STATUS_DRAWN              a bound record draws or lists a data status (scripts/work/ui/ui-shapes.mjs), or a
//                                  draws / selected-matrix entry names one as its state;
//   DRAW_NOT_SHAPES                a bound record declares no ui.shapes (and is not rendered by recipe), draws a state
//                                  that is none of its shapes, or a draws / selected-matrix entry names a screen with
//                                  no shape (XBase#state);
//   DRAW_NOT_REDRAWN               the pass binds no token-rendered drawing and no recipe-rendered record: it adopted
//                                  or reused prior evidence without drawing under the current contract.
// Adopting a prior drawing is allowed only when that drawing itself meets all of the above. Each bound record is also
// judged by scripts/work/draw/draw-quality.mjs (SHAPE_DUPLICATE, DRAW_SCOPE_FULL_PAGE, DRAW_ACTION_MISSING,
// DRAW_COPY_INTERNAL, DRAW_BADGE_UNTONED, DRAW_SCORE_BELOW, DRAW_NOT_OWNER_ACCEPTED; the DNA gate DRAW_OFF_GRAMMAR_COMPONENT,
// DRAW_NOTICE_NOT_ALERT, DRAW_RATIO_NOT_METER; the taste metrics DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BANDS,
// DRAW_TOO_MANY_BADGES; DRAW_LOOP_MISSING). starci kernel settle then re-renders and re-measures every live part itself
// (scripts/work/draw-loop-settle.mjs, draw-metrics-failed).
//
// Scope: a file belongs to the ui record whose directory is
// its longest path-segment prefix (a nested child record owns its own files). An evidence document the pass names
// itself is always judged; an evidence document or image reached only by walking an owned directory is judged when
// the live owning record binds its path - kept historical image-gen evidence (earlier rounds, baselines, redlines)
// is kept proof, never re-judged.
// An entry marked retired, a retired asset and a rejected-* candidate are kept proof.
//
//   starci work draw-acceptance --repo <repo> (--job <jobId> | --files <a,b,...>) [--json]
// --job reads the ledger read-only for the job's report files and owned paths. Exit 0 accepted, 1 refused, 2 usage.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../../lib/is-main.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { sha256File } from '../../../engine/digest.mjs';
import { isFile, isDir } from '../../lib/fs-kind.mjs';
import { assetsOf, list, slash } from '../work-io.mjs';
import { DATA_STATUS_DRAWN, DRAWING_ROLES, DRAW_TOOL, RASTER_TOOL, assetStateOf, dataStatusOf, drawingsOf, recipeRenderedOf, uiShapeFindings } from '../ui/ui-shapes.mjs';
import { DRAW_SCOPE_FULL_PAGE, drawQualityFindings } from './draw-quality.mjs';

export const DRAW_ASSET_NOT_TOKEN_RENDERED = 'DRAW_ASSET_NOT_TOKEN_RENDERED';
export const DRAW_NOT_SHAPES = 'DRAW_NOT_SHAPES';
export const DRAW_NOT_REDRAWN = 'DRAW_NOT_REDRAWN';
export { DATA_STATUS_DRAWN };
export const RENDER_RECORD_SCHEMA = 'starci/draw-render@1';
const IMAGEGEN_ASSERTION = 'imagegen-provenance';
/** The `retired` reason of a drawing image_gen.imagegen painted before token rendering (work-ui-screen.schema.yaml). */
const RETIRED_IMAGE_GEN = 'image-gen';

const IMAGE = /\.(png|jpe?g|webp)$/i;
/** Asset roles draw-loop finish binds beside a drawing that are not drawings themselves. */
const EVIDENCE_ROLES = new Set(['direction-redline', 'render-asset']);
const UI_SCHEMA = 'work/ui-screen@1';
const readDoc = (file) => {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return /\.json$/i.test(file) ? JSON.parse(text) : parseYaml(text);
  } catch { return null; }
};

const shaOf = (file) => { try { return sha256File(file); } catch { return null; } };
const inAssets = (rel) => /(^|\/)assets\//.test(rel);

/** The ui record directory a file belongs to: the nearest ancestor (or itself) holding a work/ui-screen@1 index.yaml under .starciwork. */
function uiRecordDirOf(abs) {
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
  if (!shapes.length) findings.push({ code: DRAW_NOT_SHAPES, path: rel, detail: `${rel} declares no ui.shapes: a drawing is one image per XBase#state of ui.shapes, never a whole screen` });
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
  findings.push(...drawQualityFindings(recordDir, record, repo));
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
    // An entry marked retired is kept proof of an earlier draw, never a drawing of this pass.
    if (!e || typeof e !== 'object' || e.retired) continue;
    const id = e.id ?? e.state ?? '?';
    const status = dataStatusOf(e.state);
    if (status && !e.nonDerivable) findings.push({ code: DATA_STATUS_DRAWN, path: rel, detail: `${rel} ${where} ${id} draws "${e.state}", the data status ${status.status}; data statuses render by recipe` });
    if (!e.shape && !e.base) findings.push({ code: DRAW_NOT_SHAPES, path: rel, detail: `${rel} ${where} ${id} names ${e.screen ? `screen ${e.screen}` : 'no shape'}: each drawing is one XBase#state shape` });
    const tool = e.provenance?.tool ?? e.generation?.tool ?? null;
    if (tool !== DRAW_TOOL) findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: rel, detail: `${rel} ${where} ${id} records ${tool ? `provenance.tool ${tool}` : 'no provenance.tool'}, not draw-render` });
  }
  return findings;
}

/**
 * Whether the live record binds an evidence file: some value of the record (outside a retired entry) names its
 * path, relative to the record or to the repo. Historical draw evidence kept beside a record (earlier rounds'
 * draws.yaml, rejected composites, baselines) is kept-never-deleted and artifact-indexed, so it stays in the owned
 * directory; it is judged only when the live record still points at it.
 */
function boundByRecord(record, recordDir, abs, repo) {
  const target = slash(path.resolve(abs)).toLowerCase();
  const names = (v) => typeof v === 'string' && !/\s/.test(v) && /\.(ya?ml|json|png|jpe?g|webp)$/i.test(v)
    && [recordDir, repo].some((base) => base && slash(path.resolve(base, v)).toLowerCase() === target);
  const walk = (v, depth) => {
    if (depth > 12) return false;
    if (typeof v === 'string') return names(v);
    if (Array.isArray(v)) return v.some((x) => walk(x, depth + 1));
    if (v && typeof v === 'object') return !v.retired && Object.values(v).some((x) => walk(x, depth + 1));
    return false;
  };
  return walk(record, 0);
}

/** The ui record owning a file: the judged record whose directory is the LONGEST path-segment prefix of it (a child record nested under a parent record's directory owns its own files). */
export function ownerOf(judged, abs) {
  const p = slash(path.resolve(abs)).toLowerCase();
  let best = null;
  for (const r of judged) {
    const dir = slash(path.resolve(r.dir)).toLowerCase().replace(/\/+$/, '');
    if (p.startsWith(`${dir}/`) && (!best || dir.length > best.len)) best = { r, len: dir.length };
  }
  return best?.r ?? null;
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
  // Files the pass names itself (a report file, an explicit --files entry) are judged whatever they are; a file
  // reached only by walking an owned directory is judged as what the live records bind.
  const named = new Set();
  for (const f of list(files)) {
    const p = path.isAbsolute(f) ? f : path.resolve(repo, f);
    if (isDir(p)) walkImages(p, abs);
    else if (isFile(p)) { abs.push(p); named.add(slash(path.resolve(p)).toLowerCase()); }
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
  const recordFound = new Set(findings.filter((f) => f.code === DRAW_ASSET_NOT_TOKEN_RENDERED && f.path).map((f) => f.path.toLowerCase()));
  for (const p of unique) {
    const rel = slash(path.relative(repo, p));
    if (IMAGE.test(p)) {
      const owner = ownerOf(judged, p);
      if (!owner || !inAssets(slash(path.relative(owner.dir, p)))) continue;
      const assetRel = slash(path.relative(owner.dir, p));
      const asset = assetsOf(owner.record).find((a) => slash(a.path) === assetRel);
      // A retired asset or a rejected candidate (role rejected-*) is a kept proof, never a drawing.
      if (asset?.retired || String(asset?.role ?? '').startsWith('rejected-')) continue;
      if (!named.has(slash(path.resolve(p)).toLowerCase()) && !asset && !boundByRecord(owner.record, owner.dir, p, repo)) {
        // A loose draw-render capture still proves the pass drew; it is not a live asset to judge.
        const sha = shaOf(p);
        if (sha && receipts.has(sha)) drawn = true;
        continue;
      }
      const layoutRecord = [owner.record?.surface, ...Object.values(owner.record?.surface && typeof owner.record.surface === 'object' ? owner.record.surface : {})].includes('layout');
      if (!asset && !layoutRecord && /--page--/.test(path.basename(p)) && !/\.content\.[a-z]+$/i.test(p)) {
        findings.push({ code: DRAW_SCOPE_FULL_PAGE, path: rel, detail: `${rel} is a full-page composite bound by the draw: interface.draw draws only the XBase content (<XBase>#<state>--<breakpoint>--<theme>.png)` });
      }
      if (owner.tokenRendered.has(slash(p))) continue;
      const sha = shaOf(p);
      if (sha && receipts.has(sha)) { drawn = true; continue; }
      if (asset && !DRAWING_ROLES.has(asset.role) && asset.generation?.tool === RASTER_TOOL && owner.drawn) continue;
      // What draw-loop finish installs beside a token-rendered part is evidence, not a drawing: the annotated redline
      // and the art placeholder the draw source imports (reference draw <tmp>/draw-components was refused on both).
      if (asset && EVIDENCE_ROLES.has(asset.role) && owner.drawn) continue;
      if (asset && DRAWING_ROLES.has(asset.role)) continue; // judged with its record above
      if (recordFound.has(rel.toLowerCase())) continue; // its record already refused this file (coverage.map)
      const why = asset?.generation?.tool === RASTER_TOOL ? 'generation.tool image_gen.imagegen' : imageProvenanceOf(p) ?? 'no draw-render receipt';
      findings.push({ code: DRAW_ASSET_NOT_TOKEN_RENDERED, path: rel, detail: `${rel} is bound by the draw with ${why}: a drawing is a draw-render capture of one XBase#state, never an image-gen whole screen; adopt a prior drawing only when it meets the current contract` });
      continue;
    }
    if (/\.(ya?ml|json)$/i.test(p)) {
      const doc = readDoc(p);
      if (!doc || typeof doc !== 'object' || doc.schema === UI_SCHEMA || !(doc.draws || doc.selectedMatrix || doc.assertions || doc.proofs)) continue;
      if (!named.has(slash(path.resolve(p)).toLowerCase())) {
        // Walked from an owned directory: live only when the owning record binds it; kept historical evidence is not re-judged.
        const owner = ownerOf(judged, p);
        if (!owner || !boundByRecord(owner.record, owner.dir, p, repo)) continue;
      }
      findings.push(...judgeEvidence(p, doc, repo));
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
  const reports = db.prepare('SELECT report_json FROM reports WHERE job_id=? ORDER BY report_id DESC').all(jobId);
  for (const r of reports) {
    try { files.push(...list(JSON.parse(r.report_json)?.files)); } catch { /* unreadable report */ }
  }
  return { job, payload, files: [...new Set(files.filter((f) => typeof f === 'string' && f.trim()))] };
}

async function main(argv) {
  const get = (name) => { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };
  const repo = get('--repo'), jobId = get('--job'), filesArg = get('--files'), json = argv.includes('--json');
  if (!repo || (!jobId && !filesArg)) {
    process.stderr.write('use: starci work draw-acceptance --repo <repo> (--job <jobId> | --files <a,b,...>) [--json]\n');
    return 2;
  }
  let files = filesArg ? filesArg.split(',').map((s) => s.trim()).filter(Boolean) : [];
  let job = null;
  if (jobId) {
    const { openLedgerReader, ledgerFileFor } = await import('../../../engine/db/ledger.mjs');
    // The repo's runtime ledger is the one file ledgerFileFor resolves (machine.ledgers names it).
    const resolved = ledgerFileFor(path.resolve(repo));
    const file = fs.existsSync(resolved) ? resolved : null;
    if (!file) { process.stderr.write(`no runtime ledger for ${repo}\n`); return 2; }
    const db = openLedgerReader(file);
    try {
      const bound = jobBoundFiles(db, jobId);
      if (!bound) { process.stderr.write(`unknown job ${jobId}\n`); return 2; }
      job = { jobId, op: bound.job.op_id, status: bound.job.status };
      files = bound.files;
    } finally { db.close(); }
  }
  const out = { ...drawAcceptanceFindings({ repo: path.resolve(repo), files }), ...(job ? { job } : {}) };
  if (json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  else process.stdout.write(`${out.ok ? 'accepted' : 'REFUSED'}${job ? ` ${job.jobId}` : ''}: ${out.findings.length} finding(s)\n${out.findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}\n`);
  return out.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  try { process.exit(await main(process.argv.slice(2))); } catch (error) { process.stderr.write(`${error?.stack ?? error}\n`); process.exit(2); }
}
