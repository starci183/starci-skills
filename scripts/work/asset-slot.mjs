#!/usr/bin/env node
// asset-slot.mjs — artwork a drawing owes to interface.asset (owner ruling 2026-09-27: "mascot/illustration comes from
// interface.asset, never reused ad hoc").
//
// A drawing that needs artwork (a mascot, an illustration, a hero image) never reuses a file it found: it marks the
// place data-asset-slot="<id>" on the MediaFrame / Image / img (a placeholder src, or none, is fine) and requests it in
// asset-request.md beside its render source (or in the ui record directory) - one heading per slot naming its id, the
// section its purpose, placement, pixel size and format, and the brand master it references. The DNA gate refuses
// artwork without a slot and a slot without a request (DRAW_ASSET_SLOT_UNDECLARED, scripts/work/draw/draw-dna.mjs), and
// the draw records each slot in ui.artworkSlots[] (status owed).
//
// interface.asset owes every open slot: it generates the artwork under the brand record's imagery.promptRules (and
// masters), then replaces the placeholder in the render source - src the produced file, data-asset-sha256 its bytes'
// sha256, data-asset-prompt the prompt.txt it was generated from - and records ui.artworkSlots[].file/sha256/status.
// The brand masters (brand/assets/**, the unicorn masters) are the LANDING's art and the style reference only (owner
// ruling 2026-09-27): every product slot is owed a NEW generation - a new pose/composition per surface in the same
// brand style - so a master may stand in only as the placeholder. A slot is FILLED only when data-asset-sha256 names
// the sha256 of the file its src resolves to, those bytes are not byte-identical to any brand master, and its prompt
// (data-asset-prompt, else <file>.prompt.txt beside it) exists; anything else is OWED. A done ui record with an owed
// slot is refused (ASSET_SLOT_UNFILLED, scripts/work/validate/check-example-work.mjs).
//
// The ledger: settling an interface.draw or interface.asset job records one `asset-slot-owed` event per owed slot of
// the files it binds and one `asset-slot-filled` per filled one; `starci kernel status` lists the open ones as assetSlotsOwed[]
// and its nextActions propose an interface.asset leg for them (scripts/kernel/cli.mjs).
//
//   starci work asset-slot list <file|dir>... [--json]    every slot, owed or filled, with its request
//   starci work asset-slot check <file|dir>... [--json]   exit 1 when a slot has no request
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { openEventItems } from '../lib/event-items.mjs';
import { ASSET_SLOT_ATTR, COMPONENT_ATTR, parseHtml, walkElements } from './draw/draw-dna.mjs';
import { isDir, isFile, slash } from './work-io.mjs';

export { ASSET_SLOT_ATTR };
const ASSET_SHA_ATTR = 'data-asset-sha256';
const ASSET_REQUEST_FILE = 'asset-request.md';
export const ASSET_SLOT_OWED = 'asset-slot-owed';
export const ASSET_SLOT_FILLED = 'asset-slot-filled';
const ASSET_PROMPT_ATTR = 'data-asset-prompt';
export const ASSET_OP = 'interface.asset';
export const ASSET_SLOT_UNFILLED = 'ASSET_SLOT_UNFILLED';
const SKIP_DIRS = new Set(['node_modules', '.git', 'draw-loop']);

/** The ui record directory above `file` (the nearest dir holding index.yaml, at most 6 levels up), or null. */
export function uiDirOf(file) {
  let dir = isDir(file) ? file : path.dirname(file);
  for (let i = 0; i < 7; i++) {
    if (isFile(path.join(dir, 'index.yaml'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** The asset-request.md files that belong to a render source: beside it, up to its ui record dir, and in `dirs`. */
function requestFilesFor(htmlFile, dirs = []) {
  const out = [];
  const add = (dir) => { const f = path.join(dir, ASSET_REQUEST_FILE); if (isFile(f) && !out.includes(f)) out.push(f); };
  const stop = uiDirOf(htmlFile);
  let dir = path.dirname(htmlFile);
  for (let i = 0; i < 7; i++) {
    add(dir);
    if (!stop || dir === stop) break;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  for (const d of dirs) add(d);
  return out;
}

const SLUG = /^[a-z0-9][a-z0-9._-]*$/i;
const HEADING_PATTERN = new RegExp(['^#{1,6}', String.raw`\s+`, '(.*)$'].join(''));
const SLOT_LINE_PATTERN = new RegExp([String.raw`^\s*`, '[-*]?', String.raw`\s*(?:slot|id)\s*:\s*`, '`?', String.raw`([\w.-]+)`, '`?', String.raw`\s*$`].join(''), 'i');
/** The slot requests of asset-request.md files: [{id, file, brief}] - a heading per slot, or `slot: <id>` lines. */
export function readAssetRequests(files) {
  const out = [];
  for (const file of files ?? []) readFileRequests(file, out);
  return out;
}

function readFileRequests(file, out) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  const lines = text.split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    current = requestLine(line, current, file, out);
  }
}

function requestLine(line, current, file, out) {
  const heading = HEADING_PATTERN.exec(line);
  const slotLine = SLOT_LINE_PATTERN.exec(line);
  if (heading) {
    const id = requestedHeadingId(heading[1].trim());
    return id ? pushRequest(id.trim(), file, out) : null;
  }
  if (slotLine) return current?.id !== slotLine[1] ? pushRequest(slotLine[1], file, out) : current;
  if (current && line.trim()) current.brief = `${current.brief} ${line.trim()}`.trim().slice(0, 400);
  return current;
}

function requestedHeadingId(heading) {
  return new RegExp(String.raw`${ASSET_SLOT_ATTR}\s*=\s*["']([^"']+)["']`).exec(heading)?.[1] ?? /`([^`]+)`/.exec(heading)?.[1] ?? (SLUG.test(heading) ? heading : null);
}

function pushRequest(id, file, out) {
  const current = { id, file, brief: '' };
  out.push(current);
  return current;
}

/** The Set of slot ids the render source's asset-request.md files request. */
export const assetRequestIdsFor = (htmlFile, dirs = []) => new Set(readAssetRequests(requestFilesFor(htmlFile, dirs)).map((r) => r.id));

/** The .starciwork directory above `file`, or null. */
function workRootAbove(file) {
  let dir = path.dirname(path.resolve(file));
  for (let i = 0; i < 12; i++) {
    if (path.basename(dir) === '.starciwork') return dir;
    if (isDir(path.join(dir, '.starciwork')) && isFile(path.join(dir, '.starciwork', 'brand', 'index.yaml'))) return path.join(dir, '.starciwork');
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** Calls `onFile(fullPath, name)` for every file under `dir`, `depth` directory levels down; `enter(name)` admits a directory. */
function eachFileUnder(dir, depth, onFile, enter = () => true) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (!e.isDirectory()) onFile(full, e.name);
    else if (depth > 0 && enter(e.name)) eachFileUnder(full, depth - 1, onFile, enter);
  }
}

/** The sha256 of every brand master file (<work>/brand/assets/**): the landing's art, never a product slot's bytes. */
function brandMasterShas(workRoot) {
  if (!workRoot) return new Set();
  const out = new Set();
  eachFileUnder(path.join(workRoot, 'brand', 'assets'), 6, (full) => { try { out.add(sha256File(full)); } catch { /* unreadable */ } });
  return out;
}

/**
 * The slots of one render source: [{id, tag, component, src, sha256, file, master, prompt, filled}]; `htmlFile`
 * resolves the src and the prompt, `masters` is the Set of brand master sha256s a filled slot must not equal.
 */
export function slotsOfHtml(html, { htmlFile = null, masters = new Set() } = {}) {
  const out = [];
  for (const el of walkElements(parseHtml(html))) {
    const slot = slotOfElement(el, htmlFile, masters);
    if (slot) out.push(slot);
  }
  return out;
}

/** The prompt file a slot names (relative to its render source), else the `.prompt.txt` beside its filled asset. */
function promptFileOf(promptAttr, htmlFile, actual, file) {
  if (promptAttr && htmlFile) return path.resolve(path.dirname(htmlFile), promptAttr);
  return actual ? file.replace(/\.[^.\\/]+$/, '.prompt.txt') : null;
}

function slotOfElement(el, htmlFile, masters) {
  const id = (el.attrs[ASSET_SLOT_ATTR] ?? '').trim();
  if (!id) return null;
  const img = el.tag === 'img' ? el : walkElements(el).find((d) => d.tag === 'img') ?? el;
  const src = (img.attrs.src ?? el.attrs.src ?? '').trim() || null;
  const sha = (el.attrs[ASSET_SHA_ATTR] ?? img.attrs[ASSET_SHA_ATTR] ?? '').trim().toLowerCase() || null;
  const { file, actual } = actualAssetFile(src, htmlFile);
  const master = Boolean(actual && masters.has(actual));
  const promptFile = promptFileOf((el.attrs[ASSET_PROMPT_ATTR] ?? img.attrs[ASSET_PROMPT_ATTR] ?? '').trim(), htmlFile, actual, file);
  const prompt = promptFile && isFile(promptFile) ? promptFile : null;
  return { id, tag: el.tag, component: el.attrs[COMPONENT_ATTR] ?? null, src, sha256: sha, file: actual ? file : null, master, prompt,
    filled: slotIsFilled(sha, actual, master, prompt) };
}

// Filled: the declared sha256 is the asset's actual bytes, which are not a brand master, and a prompt file exists.
const slotIsFilled = (sha, actual, master, prompt) => Boolean(sha && actual && sha === actual && !master && prompt);

function actualAssetFile(src, htmlFile) {
  let file = null, actual = null;
  if (src && htmlFile && !/^(data:|https?:|\/\/)/i.test(src)) {
    file = path.resolve(path.dirname(htmlFile), decodeURI(src.split(/[?#]/)[0]));
    try { actual = isFile(file) ? sha256File(file) : null; } catch { actual = null; }
  }
  return { file, actual };
}

/** The render sources among `targets` (files, or directories walked without draw-loop rounds). */
function renderSourcesIn(targets, depth = 6) {
  const out = new Map();
  const add = (file) => { if (/\.html?$/i.test(file)) out.set(path.resolve(file).toLowerCase(), path.resolve(file)); };
  for (const t of targets ?? []) {
    if (isDir(t)) eachFileUnder(t, depth, add, (name) => !SKIP_DIRS.has(name));
    else if (isFile(t)) add(t);
  }
  return [...out.values()];
}

/**
 * Every slot of the render sources among `targets`: [{key, id, ui, html, requested, request, filled, src, sha256}].
 * `key` is `<ui record dir, repo-relative>#<slot id>` - one slot per ui record, however many parts show it.
 */
export function assetSlotsOf(targets, { repo = process.cwd() } = {}) {
  const bySlot = new Map();
  const mastersByRoot = new Map();
  for (const html of renderSourcesIn(targets)) addHtmlSlots(bySlot, mastersByRoot, html, repo);
  return [...bySlot.values()];
}

function addHtmlSlots(bySlot, mastersByRoot, html, repo) {
  let text = '';
  try { text = fs.readFileSync(html, 'utf8'); } catch { return; }
  if (!text.includes(ASSET_SLOT_ATTR)) return;
  const requests = readAssetRequests(requestFilesFor(html));
  const ui = slash(path.relative(repo, uiDirOf(html) ?? path.dirname(html)));
  const workRoot = workRootAbove(html);
  if (!mastersByRoot.has(workRoot)) mastersByRoot.set(workRoot, brandMasterShas(workRoot));
  const masters = mastersByRoot.get(workRoot);
  for (const s of slotsOfHtml(text, { htmlFile: html, masters })) {
    const key = `${ui}#${s.id}`;
    const request = requests.find((r) => r.id === s.id) ?? null;
    const slot = { key, id: s.id, ui, html: slash(path.relative(repo, html)), requested: Boolean(request), request: request ? { file: slash(path.relative(repo, request.file)), brief: request.brief } : null,
      filled: s.filled, src: s.src, sha256: s.sha256, master: s.master, prompt: s.prompt ? slash(path.relative(repo, s.prompt)) : null };
    const prior = bySlot.get(key);
    // A slot is filled only when every part that shows it carries the filled bytes.
    bySlot.set(key, prior ? { ...prior, filled: prior.filled && slot.filled } : slot);
  }
}

/**
 * Record one `asset-slot-owed` event per owed slot of the job's files and one `asset-slot-filled` per filled one
 * (once per slot key and sha). Returns {owed, filled} newly recorded. `ledger` is an open ledger (appendEvent).
 */
export function recordAssetSlots(ledger, { job, repo, files, now = Date.now() }) {
  const db = ledger.db;
  const recorded = { owed: [], filled: [] };
  for (const s of assetSlotsOf(files, { repo })) {
    const kind = s.filled ? ASSET_SLOT_FILLED : ASSET_SLOT_OWED;
    const seen = db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.key')=? AND json_extract(payload_json,'$.sha256') IS ? AND json_extract(payload_json,'$.jobId')=? LIMIT 1")
      .get(job.workflow_id, kind, s.key, s.sha256, job.job_id);
    if (seen) continue;
    const payload = { key: s.key, id: s.id, ui: s.ui, html: s.html, src: s.src, sha256: s.sha256, requested: s.requested, request: s.request?.file ?? null, jobId: job.job_id, opId: job.op_id, attempt: job.attempt };
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind, createdAt: now, payload });
    recorded[s.filled ? 'filled' : 'owed'].push(payload);
  }
  return recorded;
}

/** The workflow's open asset slots (owed, not filled since): [{key, id, ui, html, request, jobId, opId, owedAt}]. */
export function openAssetSlots(db, workflowId) {
  return openEventItems(db, workflowId, {
    owedKind: ASSET_SLOT_OWED, resolvedKind: ASSET_SLOT_FILLED, keyOf: (p) => p.key,
    item: (p, row) => ({ key: p.key, id: p.id ?? null, ui: p.ui ?? null, html: p.html ?? null, request: p.request ?? null, requested: p.requested !== false, jobId: p.jobId ?? null, opId: p.opId ?? null, owedAt: row.created_at }),
  });
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const json = rest.includes('--json');
  const targets = rest.filter((a) => !a.startsWith('--')).map((t) => path.resolve(t));
  if (!['list', 'check'].includes(cmd) || !targets.length) {
    process.stderr.write('use: starci work asset-slot list|check <file|dir>... [--json]\n');
    return 2;
  }
  const slots = assetSlotsOf(targets);
  const unrequested = slots.filter((s) => !s.requested);
  if (json) process.stdout.write(`${JSON.stringify({ ok: cmd === 'list' || !unrequested.length, slots }, null, 2)}\n`);
  else {
    const lines = slots.map((s) => `${s.filled ? 'filled' : 'OWED  '} ${s.key}${s.requested ? '' : ' (NO REQUEST in asset-request.md)'} ${s.html}`).join('\n');
    process.stdout.write(`${lines || 'no asset slots'}\n`);
  }
  return cmd === 'check' && unrequested.length ? 1 : 0;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
