#!/usr/bin/env node
// telegram-media.mjs — sends the owner what a design or UAT op produced, over
// the same Telegram bot as the ask notices (scripts/connectors/telegram.mjs,
// docs/connectors.md):
//
//   interface.draw / interface.asset settled pass
//       the drawn screens as an album (sendMediaGroup, <= 10 per album) with one
//       caption: what was drawn, how many screens / variants / states, the
//       report summary and that the owner reviews it at handover
//   uat.verify / uat.assisted.* / e2e.verify
//       every recorded video (sendVideo, <= 50 MB; bigger ones become a note
//       with the local path) captioned with the flow's steps and the verdict,
//       whatever the verdict; a pass with no video sends its screenshots as an
//       album instead
//
// The one send point is the KERNEL's settle: scripts/kernel/api.mjs cmdSettle
// calls queueSettleMedia(), which launches this file detached (`settle` verb),
// so an upload never slows or fails the settle. The sender's stderr goes to
// <state>/connectors/telegram-media.log. One send per workflow|job|attempt
// (deduped in <state>/connectors/telegram-media-sent.json). The ledger is read
// read-only, the bot token is never printed and is scrubbed from every error.
// STARCI_TELEGRAM_API_BASE replaces https://api.telegram.org for tests.
//
//   node scripts/connectors/telegram-media.mjs settle --ledger <runtime.sqlite> --repo <repo>
//       --workflow <id> --job <id> --attempt <n> --op <op> --verdict pass|fail|blocked [--dispatch <id>]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectLedger } from '../../engine/ledger-db.mjs';
import { configRoot } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { DEFAULT_API_BASE, botCall, redact, telegramSettings, TEXT_MAX } from './telegram.mjs';
import { clip, clipLine } from '../lib/clip.mjs';
import { argsOf, ownerConfig, readJson, stateFile, writeJson } from './lib.mjs';
import { drawImageRefs, partOf } from '../work/direction-part.mjs';

const SELF = fileURLToPath(import.meta.url);
const DRAW_OPS = new Set(['interface.draw', 'interface.asset']);
const UAT_OPS = new Set(['uat.verify', 'uat.assisted.prepare', 'uat.assisted.verify', 'e2e.verify']);
export const LIMITS = {
  photoBytes: 10 * 1024 * 1024, videoBytes: 50 * 1024 * 1024, album: 10, caption: 1024, text: TEXT_MAX,
  screenshots: 20, walkFiles: 2000, walkDepth: 6,
};
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO = new Set(['.webm', '.mp4']);
// Working copies interface.draw keeps beside the final direction (edit sources, pre-final passes).
const INTERMEDIATE = /\.(source|clean-source|pre-final|initial|draft)\.[a-z0-9]+$/i;

const extOf = (file) => path.extname(file).toLowerCase();
const isImage = (file) => IMAGE.has(extOf(file));
const isVideo = (file) => VIDEO.has(extOf(file));
const posix = (file) => String(file).replace(/\\/g, '/');
const keyOf = (file) => (process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file));
const arr = (value) => (Array.isArray(value) ? value : []);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };
const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const isDir = (file) => { try { return fs.statSync(file).isDirectory(); } catch { return false; } };
const sizeOf = (file) => { try { return fs.statSync(file).size; } catch { return -1; } };
const firstFile = (candidates) => candidates.find((c) => c && isFile(c)) ?? null;

/** Which media an op's settle sends: 'draw', 'uat' or null. */
export const mediaKindOf = (op) => (DRAW_OPS.has(op) ? 'draw' : (UAT_OPS.has(op) || /^uat\.assisted\./.test(String(op ?? ''))) ? 'uat' : null);

/* ------------------------------------------------------------ texts */

const TEXT = {
  vi: {
    drawn: (title, names) => `🎨 [StarCi] ${title} đã vẽ xong giao diện ${names}`,
    screens: 'Màn hình', states: 'Trạng thái', variants: 'Biến thể', images: 'Ảnh gửi kèm', summary: 'Tóm tắt',
    band: { desktop: 'desktop', tablet: 'tablet', mobile: 'mobile' }, theme: { light: 'sáng', dark: 'tối' },
    review: 'Thầy xem kỹ khi bàn giao (handover), hoặc góp ý bất cứ lúc nào.',
    tooBigPhoto: (n) => `${n} ảnh lớn hơn 10 MB không gửi qua Telegram, xem trên máy:`,
    more: (n) => `và ${n} ảnh khác trên máy`,
    uat: (name, verdict) => `🎬 [StarCi] UAT ${name}: ${verdict}`,
    pass: 'ĐẠT', fail: 'KHÔNG ĐẠT', blocked: 'KHÔNG ĐẠT (bị chặn)',
    workflow: 'Workflow', steps: 'Các bước', flows: 'Các luồng', video: 'video',
    screenshotsOnly: (n) => `${n} ảnh chụp màn hình (không có video)`,
    tooBigVideo: 'Video lớn hơn 50 MB nên không gửi qua Telegram; xem trên máy:',
    cont: (i, n) => `(tiếp ${i}/${n})`,
    prepare: 'bước chuẩn bị, video thử trình duyệt',
  },
  en: {
    drawn: (title, names) => `🎨 [StarCi] ${title} finished drawing the interface for ${names}`,
    screens: 'Screens', states: 'States', variants: 'Variants', images: 'Attached', summary: 'Summary',
    band: { desktop: 'desktop', tablet: 'tablet', mobile: 'mobile' }, theme: { light: 'light', dark: 'dark' },
    review: 'Review it at handover, or send feedback any time.',
    tooBigPhoto: (n) => `${n} image(s) over 10 MB were not sent over Telegram; see them on the machine:`,
    more: (n) => `and ${n} more on the machine`,
    uat: (name, verdict) => `🎬 [StarCi] UAT ${name}: ${verdict}`,
    pass: 'PASSED', fail: 'FAILED', blocked: 'FAILED (blocked)',
    workflow: 'Workflow', steps: 'Steps', flows: 'Flows', video: 'video',
    screenshotsOnly: (n) => `${n} screenshot(s) (no video)`,
    tooBigVideo: 'The video is over 50 MB so it was not sent over Telegram; see it on the machine:',
    cont: (i, n) => `(continued ${i}/${n})`,
    prepare: 'preparation, browser probe video',
  },
};
const textFor = (language) => TEXT[language] ?? TEXT.en;
const verdictText = (t, verdict) => (verdict === 'pass' ? t.pass : verdict === 'blocked' ? t.blocked : t.fail);

/**
 * Join caption lines under `max`: the head and tail lines always stay, body lines are dropped from
 * the end (least important last) until it fits, and the result is hard-clipped as a last resort.
 */
export function fitCaption(head, body, tail, max = LIMITS.caption) {
  const lines = [...body];
  const join = () => [...head, ...lines, ...tail].filter((l) => l !== null && l !== undefined).join('\n');
  let out = join();
  while (out.length > max && lines.length) { lines.pop(); out = join(); }
  return clip(out, max);
}

/* ------------------------------------------------------------ finding the files */

/** A report path resolved against the repo roots; null when it names nothing on disk. */
const resolveIn = (p, roots) => {
  if (typeof p !== 'string' || !p.trim()) return null;
  if (path.isAbsolute(p)) return fs.existsSync(p) ? path.resolve(p) : null;
  for (const root of roots) { const abs = path.resolve(root, p); if (fs.existsSync(abs)) return abs; }
  return null;
};

/** Files named by `entries` (files or directories, walked to a bounded depth), deduplicated. */
function expand(entries, { seen = new Map(), max = LIMITS.walkFiles } = {}) {
  const walk = (dir, depth) => {
    if (depth > LIMITS.walkDepth || seen.size >= max) return;
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of list) {
      if (seen.size >= max) return;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && !seen.has(keyOf(full))) seen.set(keyOf(full), full);
    }
  };
  for (const entry of entries) {
    if (!entry) continue;
    if (isDir(entry)) walk(entry, 0);
    else if (isFile(entry) && !seen.has(keyOf(entry))) seen.set(keyOf(entry), path.resolve(entry));
  }
  return seen;
}

/** The ui record directory owning `file`: the nearest ancestor with an index.yaml inside a ui/ tree. */
function uiNodeDirOf(file) {
  let dir = path.dirname(file);
  for (let i = 0; i < 6; i++) {
    if (/\/ui(\/|$)/.test(posix(dir)) && isFile(path.join(dir, 'index.yaml'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/** "feature/name" for a ui record directory (".../features/<feature>/ui/<name>"), or its base name. */
const uiLabelOf = (dir) => {
  const m = posix(dir).match(/\/features\/([^/]+)\/ui(?:\/(.+))?$/);
  return m ? (m[2] ? `${m[1]}/${m[2]}` : m[1]) : path.basename(dir);
};

export const bandOf = (value) => {
  const v = String(value ?? '').toLowerCase();
  if (!v) return null;
  const n = Number(v.match(/\d{3,4}/)?.[0] ?? NaN);
  if (/mobile|phone|compact/.test(v) || n < 600) return 'mobile';
  if (/tablet|medium/.test(v) || n < 1024) return 'tablet';
  if (/desktop|wide|large|expanded/.test(v) || n >= 1024) return 'desktop';
  return null;
};
export const themeOf = (value) => { const v = String(value ?? '').toLowerCase(); return /dark/.test(v) ? 'dark' : /light/.test(v) ? 'light' : null; };

/**
 * The drawings one draw/asset report produced, in the order they were drawn:
 *  1. the draws[] of every draws.yaml the report names - each draw's `part`, else `content`, else `image`
 *     (paths resolve against the draws file, then its ui record, then the repo) - the op's own index of
 *     its representative directions;
 * and every pick is the drawn part, never its composite (scripts/work/direction-part.mjs).
 *  2. else the images the report names, without the working copies (.source/.clean-source/
 *     .pre-final/.initial) and without evidence/ copies when the ui record holds the same set;
 *  3. else the representativeScreens[].directionAsset of the ui records it wrote.
 * Returns {picks:[{file,screen,state,viewport,theme}], nodes:[{dir,label,doc}]}.
 */
export function collectDrawings({ files, repo }) {
  const all = [...expand(files).values()];
  const nodeDirs = new Map();
  for (const f of all) { if (!/\/ui\//.test(posix(f))) continue; const d = uiNodeDirOf(f); if (d && !nodeDirs.has(keyOf(d))) nodeDirs.set(keyOf(d), d); }
  const nodes = [...nodeDirs.values()].map((dir) => ({ dir, label: uiLabelOf(dir), doc: readYaml(path.join(dir, 'index.yaml')) }));
  const nodeOf = (file) => { const d = uiNodeDirOf(file); return d ? nodes.find((n) => keyOf(n.dir) === keyOf(d)) ?? null : null; };
  const picks = new Map();
  // The owner is sent the drawn PART (page content, overlay panel, layout drawing), never the composite
  // placed into the layout capture (owner ruling 2026-09-24, scripts/work/direction-part.mjs); a composite
  // named beside its own part collapses into one picture.
  const partCache = new Map();
  const add = (found, meta = {}) => {
    if (!found || !isImage(found)) return;
    const file = partOf(found, { cache: partCache }).file;
    if (picks.has(keyOf(file))) return;
    picks.set(keyOf(file), { file, screen: meta.screen ?? null, state: meta.state ?? null, viewport: meta.viewport ?? meta.breakpoint ?? null, theme: meta.theme ?? null });
  };
  for (const df of all.filter((f) => path.basename(f) === 'draws.yaml')) {
    const node = uiNodeDirOf(df);
    for (const d of arr(readYaml(df)?.draws)) {
      const file = drawImageRefs(d).map((rel) => firstFile([path.resolve(path.dirname(df), rel), node && path.resolve(node, rel), path.resolve(repo, rel)])).find(Boolean);
      add(file, d);
    }
  }
  // A ui record names its direction images on coverage.representativeScreens[] or coverage.map[] entries.
  const representative = (node) => {
    const coverage = node?.doc?.ui?.coverage ?? {};
    const seen = new Set();
    return [...arr(coverage.representativeScreens), ...arr(coverage.map)]
      .filter((r) => r && typeof r === 'object' && typeof r.directionAsset === 'string' && !seen.has(r.directionAsset) && seen.add(r.directionAsset));
  };
  const metaOf = (file) => {
    const node = nodeOf(file);
    const hit = representative(node).find((r) => keyOf(path.resolve(node.dir, r.directionAsset)) === keyOf(file));
    const name = path.basename(file);
    return hit ?? { viewport: bandOf(name.match(/mobile|tablet|desktop|\d{3,4}/i)?.[0]), theme: themeOf(name) };
  };
  if (!picks.size) {
    const images = all.filter((f) => isImage(f) && !INTERMEDIATE.test(f));
    const outside = images.filter((f) => !/\/evidence\//.test(posix(f)));
    for (const f of (outside.length ? outside : images)) add(f, metaOf(f));
  }
  if (!picks.size) {
    for (const node of nodes) for (const r of representative(node)) add(firstFile([path.resolve(node.dir, r.directionAsset)]), r);
  }
  return { picks: [...picks.values()], nodes };
}

/** Screens, states, width bands and themes the ui records (and the drawn picks) cover. */
export function drawingCounts(nodes, picks) {
  const screens = new Set(), states = new Set(), bands = new Set(), themes = new Set();
  const addBand = (v) => { const b = bandOf(v); if (b) bands.add(b); };
  const addTheme = (v) => { const t = themeOf(v); if (t) themes.add(t); };
  for (const { doc } of nodes) {
    const ui = doc?.ui ?? {};
    const coverage = ui.coverage ?? {};
    const map = arr(coverage.map);
    const surfaces = arr(ui.surfaces).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
    const mapped = map.map((m) => m?.screen).filter(Boolean);
    for (const s of (surfaces.length ? surfaces : mapped)) screens.add(String(s));
    const named = arr(ui.states).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
    const mappedStates = map.flatMap((m) => [m?.state, ...arr(m?.states)]).filter(Boolean);
    for (const s of (named.length ? named : mappedStates)) states.add(String(s));
    for (const v of [...arr(coverage.responsiveBands), ...arr(coverage.breakpoints), ...map.flatMap((m) => [m?.viewport, ...arr(m?.viewports), m?.breakpoint])]) addBand(v);
    for (const v of [...arr(coverage.themes), ...map.map((m) => m?.theme)]) addTheme(v);
  }
  for (const p of picks) {
    if (!nodes.length && p.screen) screens.add(String(p.screen));
    if (!nodes.length && p.state) states.add(String(p.state));
    addBand(p.viewport); addTheme(p.theme);
  }
  const order = (set, keys) => keys.filter((k) => set.has(k));
  return { screens: [...screens], states: states.size, bands: order(bands, ['desktop', 'tablet', 'mobile']), themes: order(themes, ['light', 'dark']) };
}

/** The album caption for a settled draw. */
export function drawCaption({ workflow, nodes, picks, counts, summary, oversize = [], language }) {
  const t = textFor(language);
  const title = workflow.title || workflow.id;
  const names = nodes.length ? nodes.map((n) => n.label).join(', ') : [...new Set(picks.map((p) => p.screen).filter(Boolean))].join(', ') || '?';
  const variants = [counts.bands.map((b) => t.band[b]).join(', '), counts.themes.map((th) => t.theme[th]).join(', ')].filter(Boolean).join(' · ');
  const body = [];
  if (counts.screens.length) body.push(`${t.screens}: ${counts.screens.length} (${clipLine(counts.screens.join(', '), 200)})`);
  if (variants) body.push(`${t.variants}: ${variants}`);
  if (counts.states) body.push(`${t.states}: ${counts.states}`);
  if (summary) body.push(`${t.summary}: ${clipLine(summary, 380)}`);
  if (oversize.length) body.push(`${t.tooBigPhoto(oversize.length)} ${oversize.map((o) => o.file).join('; ')}`);
  body.push(`${t.images} (${picks.length}):`);
  const labels = picks.map((p) => [p.screen, p.state === p.screen ? null : p.state, t.band[bandOf(p.viewport)] ?? p.viewport, t.theme[themeOf(p.theme)]].filter(Boolean).join(' · '));
  // Candidates of one screen (A/B directions) share a label: the file name tells them apart.
  labels.forEach((label, i) => body.push(`${i + 1}. ${!label ? path.basename(picks[i].file) : labels.indexOf(label) !== labels.lastIndexOf(label) ? `${label} (${path.basename(picks[i].file)})` : label}`));
  return fitCaption([clipLine(t.drawn(title, names), 300)], body, ['', t.review]);
}

/* ------------------------------------------------------------ UAT */

const stepText = (s) => (typeof s === 'string' ? s : s?.action ?? s?.title ?? s?.name ?? s?.label ?? s?.text ?? s?.id ?? '');
const stepsOf = (doc) => {
  const steps = arr(doc?.steps).length ? doc.steps : arr(doc?.journey?.steps).length ? doc.journey.steps : arr(doc?.journey);
  return steps.map(stepText).map((s) => String(s).trim()).filter(Boolean);
};
const flowFromRecord = (file, slug) => {
  const doc = readYaml(file);
  return doc ? { id: doc.id ?? slug, name: doc.title ?? slug ?? doc.id, slug: slug ?? doc.id, steps: stepsOf(doc) } : null;
};

/** The uat record a node id names (uat.<feature>.<flow>), under <repo>/.starciwork. */
const recordOfNodeId = (id, repo) => {
  const m = String(id ?? '').match(/^uat\.([^.]+)\.(.+)$/);
  return m ? firstFile([path.join(repo, '.starciwork', 'features', m[1], 'uat', m[2], 'index.yaml')]) : null;
};

/**
 * The flow one video (or screenshot) belongs to: the uat/<flow>/runs/ run it sits in, a video named
 * after its flow, the assisted request.yaml beside it, or the only uat record the report names.
 */
function flowOf(file, { records, repo }) {
  const p = posix(file);
  let m = p.match(/^(.*\/features\/[^/]+\/uat)\/([^/]+)\/runs\//);
  if (m && m[2] !== 'runs') { const f = flowFromRecord(`${m[1]}/${m[2]}/index.yaml`, m[2]); if (f) return f; }
  m = p.match(/^(.*\/features\/[^/]+\/uat)\//);
  const base = path.basename(file, path.extname(file));
  if (m && isFile(`${m[1]}/${base}/index.yaml`)) { const f = flowFromRecord(`${m[1]}/${base}/index.yaml`, base); if (f) return f; }
  let dir = path.dirname(file);
  for (let i = 0; i < 5; i++) {
    const request = readYaml(path.join(dir, 'request.yaml'));
    const flows = arr(request?.flows);
    if (flows.length) {
      const flow = flows.length === 1 ? flows[0]
        : flows.find((f) => arr(f?.steps).some((s) => JSON.stringify(s?.evidence ?? '').includes(path.basename(file))));
      if (flow) {
        const record = recordOfNodeId(flow.id, repo);
        const fromRecord = record ? flowFromRecord(record, flow.id) : null;
        const steps = fromRecord?.steps.length ? fromRecord.steps : arr(flow.steps).map(stepText).filter(Boolean);
        return { id: flow.id, name: fromRecord?.name ?? flow.title ?? flow.id, slug: flow.id, steps };
      }
      break;
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (records.length === 1) return flowFromRecord(records[0], path.basename(path.dirname(records[0])));
  return null;
}

/** The flows a multi-flow run recorded, in order (its flows.json order), for a video no flow claims. */
function runFlowsOf(file) {
  let dir = path.dirname(file);
  for (let i = 0; i < 3; i++) {
    const order = arr(readJson(path.join(dir, 'flows.json'))?.order);
    if (order.length) return order.map(String);
    dir = path.dirname(dir);
  }
  return [];
}

/**
 * The UAT media one report produced: its videos (with their flows) and, for the album, its
 * screenshots. The run folders of the uat records it names are searched too.
 */
export function collectUat({ files, repo }) {
  const seen = expand(files);
  const records = [...seen.values()].filter((f) => /\/uat\/[^/]+\/index\.yaml$/.test(posix(f)) && !/\/uat\/runs\//.test(posix(f)));
  const runDirs = records.map((r) => { const ev = readYaml(r)?.evidence; return typeof ev === 'string' ? path.resolve(path.dirname(r), ev) : null; }).filter((d) => d && isDir(d));
  const all = [...expand(runDirs, { seen }).values()];
  const videos = all.filter(isVideo).map((file) => ({ file, flow: flowOf(file, { records, repo }), runFlows: runFlowsOf(file) }));
  const screenshots = all.filter(isImage);
  const flow = records.length === 1 ? flowFromRecord(records[0], path.basename(path.dirname(records[0]))) : null;
  return { videos, screenshots, records, flow };
}

const featureOf = (file) => posix(file).match(/\/features\/([^/]+)\//)?.[1] ?? null;

/** The caption for one UAT video (or a screenshot album when `shots` is set). */
export function uatCaption({ workflow, flow, verdict, summary, language, index = 1, total = 1, runFlows = [], fallbackName = null, shots = 0, note = null, prepare = false }) {
  const t = textFor(language);
  const name = `${clipLine(flow?.name ?? fallbackName ?? workflow.title ?? workflow.id, 140)}${prepare ? ` (${t.prepare})` : ''}`;
  const head = [`${t.uat(name, verdictText(t, verdict))}${total > 1 ? ` (${t.video} ${index}/${total})` : ''}`, `${t.workflow}: ${workflow.title || workflow.id}`];
  if (shots) head.push(t.screenshotsOnly(shots));
  if (note) head.push(note);
  // The summary is clipped short so the steps keep most of the caption; a flow too long to fit
  // loses its last steps, never its first.
  const body = [];
  if (summary) body.push(`${t.summary}: ${clipLine(summary, 250)}`);
  if (flow?.steps?.length) { body.push(`${t.steps}:`); flow.steps.forEach((s, i) => body.push(`${i + 1}. ${clipLine(s, 160)}`)); }
  else if (runFlows.length) body.push(`${t.flows}: ${runFlows.join(' → ')}`);
  return fitCaption(head, body, []);
}

/* ------------------------------------------------------------ Bot API uploads */

const endpoint = (apiBase, token, method) => `${apiBase.replace(/\/+$/, '')}/bot${token}/${method}`;
const blobOf = async (file) => {
  const type = MIME[extOf(file)] ?? 'application/octet-stream';
  if (typeof fs.openAsBlob === 'function') return fs.openAsBlob(file, { type });
  return new Blob([fs.readFileSync(file)], { type });
};

/**
 * One multipart Bot API call (Node's fetch + FormData + Blob): `fields` are sent as strings (objects as
 * JSON), `files` as [{field, file}] uploads. The same polite retries as telegram.mjs botCall: 429 waits
 * retry_after (<= 60 s), 5xx and network errors back off, any other 4xx fails at once. The token is
 * scrubbed from every error.
 */
export async function botUpload({ token, method, fields = {}, files = [], apiBase = DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = sleep, attempts = 3, timeoutMs = 180000 }) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null) form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      for (const { field, file } of files) form.append(field, await blobOf(file), path.basename(file));
      const res = await fetchImpl(endpoint(apiBase, token, method), { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok !== false) return { ok: true, status: res.status, result: json?.result ?? null };
      last = { ok: false, status: res.status, error: redact(json?.description ?? `HTTP ${res.status}`, token) };
      if (res.status === 429) { await sleepImpl(Math.min(Number(json?.parameters?.retry_after ?? 1), 60) * 1000); continue; }
      if (res.status < 500) return last;
    } catch (error) {
      last = { ok: false, status: null, error: redact(error?.cause?.message ?? error?.message ?? error, token) };
    }
    if (attempt < attempts) await sleepImpl(1000 * 2 ** (attempt - 1));
  }
  return last;
}

/**
 * One album of <= 10 images: sendPhoto for one, sendMediaGroup for more, the caption on the first.
 * Telegram refuses a photo whose dimensions it will not compress; a 4xx retries the same files as a
 * document album, which keeps them at full size.
 */
async function sendAlbum(call, chatId, files, caption) {
  const single = async (type) => botUpload({ ...call, method: type === 'photo' ? 'sendPhoto' : 'sendDocument', fields: { chat_id: chatId, ...(caption ? { caption } : {}) }, files: [{ field: type, file: files[0] }] });
  const group = async (type) => botUpload({ ...call, method: 'sendMediaGroup',
    fields: { chat_id: chatId, media: files.map((f, i) => ({ type, media: `attach://f${i}`, ...(i === 0 && caption ? { caption } : {}) })) },
    files: files.map((file, i) => ({ field: `f${i}`, file })) });
  const send = files.length === 1 ? single : group;
  const photo = await send('photo');
  if (photo.ok || (photo.status ?? 500) >= 500 || photo.status === 429 || photo.status === 401 || photo.status === 403) return photo;
  return send('document');
}

/** One video with its caption; a 4xx sendVideo (a format Telegram will not stream) retries as a document. */
async function sendVideoFile(call, chatId, file, caption) {
  const video = await botUpload({ ...call, method: 'sendVideo', fields: { chat_id: chatId, caption, supports_streaming: 'true' }, files: [{ field: 'video', file }] });
  if (video.ok || (video.status ?? 500) >= 500 || [401, 403, 429].includes(video.status)) return video;
  return botUpload({ ...call, method: 'sendDocument', fields: { chat_id: chatId, caption }, files: [{ field: 'document', file }] });
}

const sendNote = (call, chatId, text) => botCall({ ...call, method: 'sendMessage',
  payload: { chat_id: chatId, text: clip(text, LIMITS.text), link_preview_options: { is_disabled: true } } });

const chunk = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

/* ------------------------------------------------------------ dedupe store */

export const mediaSentFile = (env = process.env) => stateFile('telegram-media-sent.json', env);

async function withStore(file, fn, { waitMs = 5000 } = {}) {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const end = Date.now() + waitMs;
  let fd = null;
  while (fd === null) {
    try { fd = fs.openSync(lock, 'wx'); } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 60000) fs.rmSync(lock, { force: true }); } catch { /* gone */ }
      if (Date.now() > end) throw new Error('media dedupe store is locked');
      await sleep(100);
    }
  }
  try {
    const store = readJson(file, null) ?? { schema: 'starci/telegram-media-sent@1', jobs: {} };
    store.jobs ??= {};
    const result = await fn(store);
    writeJson(file, store);
    return result;
  } finally { try { fs.closeSync(fd); fs.rmSync(lock, { force: true }); } catch { /* best effort */ } }
}

/* ------------------------------------------------------------ the settle */

function readSettle(ledgerFile, { workflowId, op, attempt, dispatchId }) {
  const handle = inspectLedger({ file: ledgerFile });
  try {
    const db = handle.db;
    const row = (dispatchId && db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=? ORDER BY report_id DESC LIMIT 1').get(workflowId, dispatchId))
      || db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? ORDER BY report_id DESC LIMIT 1').get(workflowId, op, Number(attempt));
    const title = db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId)?.title ?? null;
    return { report: parse(row?.report_json, null), workflow: { id: workflowId, title } };
  } finally { try { handle.close(); } catch { /* closed */ } }
}

/** What a settle has to send: {kind, sends:[{type, files|file, caption|text}]} or {skip}. */
export function planSettleMedia({ op, verdict, report, workflow, repo, language }) {
  const kind = mediaKindOf(op);
  if (!kind) return { skip: 'not a media op' };
  if (!report) return { skip: 'no report filed' };
  const roots = [repo];
  const files = arr(report.files).map((f) => resolveIn(f, roots)).filter(Boolean);
  const summary = String(report.summary ?? '').trim();
  const t = textFor(language);
  if (kind === 'draw') {
    if (verdict !== 'pass') return { skip: 'a draw is sent when it settles pass' };
    const { picks, nodes } = collectDrawings({ files, repo });
    const fit = picks.filter((p) => sizeOf(p.file) <= LIMITS.photoBytes);
    const oversize = picks.filter((p) => sizeOf(p.file) > LIMITS.photoBytes);
    if (!picks.length) return { skip: 'no drawings found' };
    const caption = drawCaption({ workflow, nodes, picks, counts: drawingCounts(nodes, picks), summary, oversize, language });
    if (!fit.length) return { kind, sends: [{ type: 'note', text: caption }] };
    const albums = chunk(fit.map((p) => p.file), LIMITS.album);
    const headline = caption.split('\n')[0];
    return { kind, sends: albums.map((album, i) => ({ type: 'album', files: album, caption: i === 0 ? caption : `${headline} ${t.cont(i + 1, albums.length)}` })) };
  }
  const { videos, screenshots, flow } = collectUat({ files, repo });
  if (videos.length) {
    const byFlow = new Map();
    for (const v of videos) { const k = v.flow?.id ?? ''; byFlow.set(k, (byFlow.get(k) ?? 0) + 1); }
    const index = new Map();
    const sends = videos.map((v) => {
      const k = v.flow?.id ?? '';
      const i = (index.get(k) ?? 0) + 1; index.set(k, i);
      const base = { workflow, flow: v.flow, verdict, summary, language, index: i, total: byFlow.get(k), runFlows: v.runFlows, fallbackName: featureOf(v.file), prepare: op === 'uat.assisted.prepare' };
      if (sizeOf(v.file) > LIMITS.videoBytes) return { type: 'note', text: uatCaption({ ...base, note: `${t.tooBigVideo} ${v.file}` }) };
      return { type: 'video', file: v.file, caption: uatCaption(base) };
    });
    return { kind, sends };
  }
  if (verdict !== 'pass') return { skip: 'no UAT video; screenshots are sent only for a pass' };
  const shots = screenshots.filter((f) => sizeOf(f) <= LIMITS.photoBytes);
  if (!shots.length) return { skip: 'no UAT media found' };
  const sent = shots.slice(0, LIMITS.screenshots);
  const extra = shots.length - sent.length;
  const caption = uatCaption({ workflow, flow, verdict, summary, language, shots: sent.length, fallbackName: featureOf(sent[0]), note: extra > 0 ? t.more(extra) : null });
  const albums = chunk(sent, LIMITS.album);
  return { kind, sends: albums.map((album, i) => ({ type: 'album', files: album, caption: i === 0 ? caption : `${caption.split('\n')[0]} ${t.cont(i + 1, albums.length)}` })) };
}

/**
 * Send the media one settled op produced. Never throws: every failure is one stderr line (through
 * `warn`) and an {ok:false} result. Deduped per workflow|job|attempt; a send that delivered nothing
 * releases its claim so a later run can try again. Everything external is injectable.
 */
export async function sendSettleMedia({ ledgerFile, repo, workflowId, jobId, attempt, op, verdict, dispatchId = null }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(),
} = {}) {
  try {
    if (env.STARCI_CONNECTORS_OFF === '1') return { ok: true, skipped: 'STARCI_CONNECTORS_OFF' };
    if (env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch) return { ok: true, skipped: 'test context' };
    if (!mediaKindOf(op)) return { ok: true, skipped: 'not a media op' };
    const settings = telegramSettings({ config, env, root });
    if (!settings.ready) { if (settings.warning) warn(settings.warning); return { ok: true, skipped: settings.warning ?? 'telegram off' }; }
    let read;
    try { read = readSettle(ledgerFile, { workflowId, op, attempt, dispatchId }); } catch (error) { warn(`telegram-media: ledger unreadable (${error.message})`); return { ok: false, error: 'ledger unreadable' }; }
    const plan = planSettleMedia({ op, verdict, report: read.report, workflow: read.workflow, repo: path.resolve(repo ?? path.dirname(path.dirname(ledgerFile))), language: settings.language });
    if (plan.skip) return { ok: true, skipped: plan.skip };
    const file = mediaSentFile(env), key = `${workflowId}|${jobId}|${attempt}`;
    const claimed = await withStore(file, (store) => {
      for (const [k, v] of Object.entries(store.jobs)) if (now - (v?.at ?? 0) > KEEP_MS) delete store.jobs[k];
      if (store.jobs[key]) return false;
      store.jobs[key] = { at: now, op, verdict, state: 'sending' };
      return true;
    });
    if (!claimed) return { ok: true, skipped: 'already sent', key };
    const call = { token: settings.token, apiBase, fetchImpl, sleepImpl };
    let sent = 0, failed = 0;
    for (const item of plan.sends) {
      const r = item.type === 'album' ? await sendAlbum(call, settings.chatId, item.files, item.caption)
        : item.type === 'video' ? await sendVideoFile(call, settings.chatId, item.file, item.caption)
          : await sendNote(call, settings.chatId, item.text);
      if (r?.ok) sent++; else { failed++; warn(`telegram-media: ${op} ${jobId} ${item.type} not sent: ${redact(r?.error ?? 'unknown error', settings.token)}`); }
    }
    await withStore(file, (store) => {
      if (!sent) delete store.jobs[key];
      else store.jobs[key] = { at: now, op, verdict, state: failed ? 'partial' : 'sent', sent, failed };
    });
    return { ok: failed === 0, kind: plan.kind, sent, failed, key };
  } catch (error) {
    const line = `telegram-media: send failed: ${redact(error?.message ?? error)}`;
    try { warn(line); } catch { /* nothing left */ }
    return { ok: false, error: line };
  }
}

/**
 * The settle's hook (scripts/kernel/api.mjs cmdSettle): launch the sender detached when this op has
 * media to send and Telegram is on, and return at once. Synchronous and never throws, so the settle
 * is never slowed or failed by Telegram; a launch failure is one stderr line.
 */
export function queueSettleMedia(job, { env = process.env, config = undefined, spawnImpl = spawn, script = SELF } = {}) {
  try {
    const kind = mediaKindOf(job?.op);
    if (!kind) return { queued: false, skipped: 'not a media op' };
    if (kind === 'draw' && job.verdict !== 'pass') return { queued: false, skipped: 'a draw is sent when it settles pass' };
    if (env.STARCI_CONNECTORS_OFF === '1') return { queued: false, skipped: 'STARCI_CONNECTORS_OFF' };
    // A spec run (node --test sets NODE_TEST_CONTEXT, which a spawned api.mjs inherits) never
    // reaches the real Bot API: only a spec that points STARCI_TELEGRAM_API_BASE at a fake queues.
    if (env.NODE_TEST_CONTEXT && !env.STARCI_TELEGRAM_API_BASE) return { queued: false, skipped: 'test context' };
    const settings = telegramSettings({ config: config === undefined ? ownerConfig() : config, env });
    if (!settings.ready) return { queued: false, skipped: 'telegram off' };
    const args = [script, 'settle', '--ledger', job.ledgerFile, '--repo', job.repo, '--workflow', job.workflowId, '--job', job.jobId,
      '--attempt', String(job.attempt), '--op', job.op, '--verdict', job.verdict, ...(job.dispatchId ? ['--dispatch', String(job.dispatchId)] : [])];
    let log = 'ignore';
    try {
      const logFile = stateFile('telegram-media.log', env);
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      if (sizeOf(logFile) > 1024 * 1024) fs.renameSync(logFile, `${logFile}.1`);
      log = fs.openSync(logFile, 'a');
    } catch { log = 'ignore'; }
    let child;
    try { child = spawnImpl(process.execPath, args, { detached: true, stdio: ['ignore', 'ignore', log], windowsHide: true, env }); }
    finally { if (typeof log === 'number') try { fs.closeSync(log); } catch { /* closed */ } }
    child?.on?.('error', (error) => { try { process.stderr.write(`telegram-media: sender not started: ${redact(error?.message ?? error)}\n`); } catch { /* nothing */ } });
    child?.unref?.();
    return { queued: true, pid: child?.pid ?? null };
  } catch (error) {
    try { process.stderr.write(`telegram-media: not queued: ${redact(error?.message ?? error)}\n`); } catch { /* nothing left */ }
    return { queued: false, error: 'not queued' };
  }
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const out = (value) => console.log(JSON.stringify(value));
  if (args._[0] !== 'settle') {
    console.error('usage: telegram-media.mjs settle --ledger <file> --repo <repo> --workflow <id> --job <id> --attempt <n> --op <op> --verdict pass|fail|blocked [--dispatch <id>]');
    process.exit(2);
  }
  for (const k of ['ledger', 'workflow', 'job', 'op', 'verdict']) if (typeof args[k] !== 'string') { out({ ok: false, error: `settle needs --${k}` }); process.exit(2); }
  const warn = (line) => process.stderr.write(`${new Date().toISOString()} ${line}\n`);
  const result = await sendSettleMedia({ ledgerFile: args.ledger, repo: typeof args.repo === 'string' ? args.repo : null, workflowId: args.workflow, jobId: args.job,
    attempt: args.attempt ?? '1', op: args.op, verdict: args.verdict, dispatchId: typeof args.dispatch === 'string' ? args.dispatch : null }, { warn });
  if (!result.ok || result.sent) warn(`telegram-media: ${args.op} ${args.job} ${JSON.stringify(result)}`);
  out(result);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main();
