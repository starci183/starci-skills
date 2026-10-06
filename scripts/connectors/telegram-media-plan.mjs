// Planning and file discovery for Telegram media notices.
import fs from 'node:fs';
import path from 'node:path';
import { TEXT_MAX } from './telegram.mjs';
import { clip, clipLine } from '../lib/clip.mjs';
import { drawImageRefs, partOf } from '../work/direction-part.mjs';
import { parseJson, readJsonFile } from '../lib/json.mjs';
import { list as arr } from '../lib/list.mjs';
import { pathKey, slash } from '../lib/path-key.mjs';
import { isFile, isDir } from '../lib/fs-kind.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';
import { translator } from '../lib/i18n.mjs';
import { inspectLedger } from '../../engine/db/ledger.mjs';
const DRAW_OPS = new Set(['interface.draw', 'interface.asset']);
const UAT_OPS = new Set(['uat.verify', 'uat.assisted.prepare', 'uat.assisted.verify', 'e2e.verify']);

export const LIMITS = {
  photoBytes: 10 * 1024 * 1024, videoBytes: 50 * 1024 * 1024, album: 10, caption: 1024, text: TEXT_MAX,
  screenshots: 20, walkFiles: 2000, walkDepth: 6,
};
export const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO = new Set(['.webm', '.mp4']);
// Working copies interface.draw keeps beside the final direction (edit sources, pre-final passes).
const INTERMEDIATE = /\.(source|clean-source|pre-final|initial|draft)\.[a-z0-9]+$/i;

const extOf = (file) => path.extname(file).toLowerCase();
const isImage = (file) => IMAGE.has(extOf(file));
const isVideo = (file) => VIDEO.has(extOf(file));
const posix = slash;
const keyOf = pathKey;
const parse = parseJson;
const readYaml = readYamlFile;

const sizeOf = (file) => { try { return fs.statSync(file).size; } catch { return -1; } };
const firstFile = (candidates) => candidates.find((c) => c && isFile(c)) ?? null;

/** Which media an op's settle sends: 'draw', 'uat' or null. */
export const mediaKindOf = (op) => {
  if (DRAW_OPS.has(op)) return 'draw';
  if (UAT_OPS.has(op) || String(op ?? '').startsWith('uat.assisted.')) return 'uat';
  return null;
};

/* ------------------------------------------------------------ texts */

// The English sources translate through the i18n catalog (modules/i18n/messages, scripts/lib/i18n.mjs);
// the width-band names are the same in every language.
const textFor = (language) => {
  const tr = translator(language);
  return {
    drawn: (title, names) => tr('🎨 [StarCi] {title} finished drawing the interface for {names}', { title, names }),
    screens: tr('Screens'), states: tr('States'), variants: tr('Variants'), images: tr('Attached'), summary: tr('Summary'),
    band: { desktop: 'desktop', tablet: 'tablet', mobile: 'mobile' }, theme: { light: tr('light'), dark: tr('dark') },
    review: tr('Review it at handover, or send feedback any time.'),
    tooBigPhoto: (n) => tr('{n} image(s) over 10 MB were not sent over Telegram; see them on the machine:', { n }),
    more: (n) => tr('and {n} more on the machine', { n }),
    uat: (name, verdict) => tr('🎬 [StarCi] UAT {name}: {verdict}', { name, verdict }),
    pass: tr('PASSED'), fail: tr('FAILED'), blocked: tr('FAILED (blocked)'),
    workflow: tr('Workflow'), steps: tr('Steps'), flows: tr('Flows'), video: tr('video'),
    screenshotsOnly: (n) => tr('{n} screenshot(s) (no video)', { n }),
    tooBigVideo: tr('The video is over 50 MB so it was not sent over Telegram; see it on the machine:'),
    cont: (i, n) => tr('(continued {i}/{n})', { i, n }),
    prepare: tr('preparation, browser probe video'),
  };
};
const verdictText = (t, verdict) => {
  if (verdict === 'pass') return t.pass;
  return verdict === 'blocked' ? t.blocked : t.fail;
};

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
  const m = /\/features\/([^/]+)\/ui(?:\/(.+))?$/.exec(posix(dir));
  return m ? (m[2] ? `${m[1]}/${m[2]}` : m[1]) : path.basename(dir);
};

const bandOf = (value) => {
  const v = String(value ?? '').toLowerCase();
  if (!v) return null;
  const n = Number(/\d{3,4}/.exec(v)?.[0] ?? Number.NaN);
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
const uiNodeDirectories = (all) => {
  const dirs = new Map();
  for (const file of all) {
    if (!/\/ui\//.test(posix(file))) continue;
    const dir = uiNodeDirOf(file);
    if (dir && !dirs.has(keyOf(dir))) dirs.set(keyOf(dir), dir);
  }
  return dirs;
};

const addDrawFiles = (all, repo, add) => {
  const drawFiles = all.filter((file) => path.basename(file) === 'draws.yaml');
  for (const drawFile of drawFiles) {
    const node = uiNodeDirOf(drawFile);
    for (const draw of arr(readYaml(drawFile)?.draws)) {
      const file = drawImageRefs(draw).map((rel) => firstFile([path.resolve(path.dirname(drawFile), rel), node && path.resolve(node, rel), path.resolve(repo, rel)])).find(Boolean);
      add(file, draw);
    }
  }
};

const representativeDrawings = (node) => {
  const coverage = node?.doc?.ui?.coverage ?? {};
  const seen = new Set();
  return [...arr(coverage.representativeScreens), ...arr(coverage.map)]
    .filter((row) => row && typeof row === 'object' && typeof row.directionAsset === 'string' && !seen.has(row.directionAsset) && seen.add(row.directionAsset));
};

const drawingMeta = (file, nodes) => {
  const dir = uiNodeDirOf(file);
  const node = dir ? nodes.find((row) => keyOf(row.dir) === keyOf(dir)) ?? null : null;
  const hit = node && representativeDrawings(node).find((row) => keyOf(path.resolve(node.dir, row.directionAsset)) === keyOf(file));
  const name = path.basename(file);
  return hit ?? { viewport: bandOf(/mobile|tablet|desktop|\d{3,4}/i.exec(name)?.[0]), theme: themeOf(name) };
};

const addImageFallback = (all, nodes, picks, add) => {
  if (picks.size) return;
  const images = all.filter((file) => isImage(file) && !INTERMEDIATE.test(file));
  const outside = images.filter((file) => !/\/evidence\//.test(posix(file)));
  for (const file of (outside.length ? outside : images)) add(file, drawingMeta(file, nodes));
};

const addRepresentativeFallback = (nodes, picks, add) => {
  if (picks.size) return;
  for (const node of nodes) {
    for (const row of representativeDrawings(node)) add(firstFile([path.resolve(node.dir, row.directionAsset)]), row);
  }
};

export function collectDrawings({ files, repo }) {
  const all = [...expand(files).values()];
  const nodeDirs = uiNodeDirectories(all);
  const nodes = [...nodeDirs.values()].map((dir) => ({ dir, label: uiLabelOf(dir), doc: readYaml(path.join(dir, 'index.yaml')) }));
  const picks = new Map();
  const partCache = new Map();
  const add = (found, meta = {}) => {
    if (!found || !isImage(found)) return;
    const file = partOf(found, { cache: partCache }).file;
    if (picks.has(keyOf(file))) return;
    picks.set(keyOf(file), { file, screen: meta.screen ?? null, state: meta.state ?? null, viewport: meta.viewport ?? meta.breakpoint ?? null, theme: meta.theme ?? null });
  };
  addDrawFiles(all, repo, add);
  addImageFallback(all, nodes, picks, add);
  addRepresentativeFallback(nodes, picks, add);
  return { picks: [...picks.values()], nodes };
}

/** Screens, states, width bands and themes the ui records (and the drawn picks) cover. */
const addCoverageCounts = (doc, screens, states, addBand, addTheme) => {
  const ui = doc?.ui ?? {};
  const coverage = ui.coverage ?? {};
  const map = arr(coverage.map);
  const surfaces = arr(ui.surfaces).map((surface) => (typeof surface === 'string' ? surface : surface?.name)).filter(Boolean);
  const mapped = map.map((row) => row?.screen).filter(Boolean);
  for (const screen of (surfaces.length ? surfaces : mapped)) screens.add(String(screen));
  const named = arr(ui.states).map((state) => (typeof state === 'string' ? state : state?.name)).filter(Boolean);
  const mappedStates = map.flatMap((row) => [row?.state, ...arr(row?.states)]).filter(Boolean);
  for (const state of (named.length ? named : mappedStates)) states.add(String(state));
  const responsiveBands = [...arr(coverage.responsiveBands), ...arr(coverage.breakpoints), ...map.flatMap((row) => [row?.viewport, ...arr(row?.viewports), row?.breakpoint])];
  for (const band of responsiveBands) addBand(band);
  const themes = [...arr(coverage.themes), ...map.map((row) => row?.theme)];
  for (const theme of themes) addTheme(theme);
};

const addPickCounts = (pick, nodes, screens, states, addBand, addTheme) => {
  if (!nodes.length && pick.screen) screens.add(String(pick.screen));
  if (!nodes.length && pick.state) states.add(String(pick.state));
  addBand(pick.viewport);
  addTheme(pick.theme);
};

function drawingCounts(nodes, picks) {
  const screens = new Set(), states = new Set(), bands = new Set(), themes = new Set();
  const addBand = (value) => { const band = bandOf(value); if (band) bands.add(band); };
  const addTheme = (value) => { const theme = themeOf(value); if (theme) themes.add(theme); };
  for (const { doc } of nodes) addCoverageCounts(doc, screens, states, addBand, addTheme);
  for (const pick of picks) addPickCounts(pick, nodes, screens, states, addBand, addTheme);
  const order = (set, keys) => keys.filter((key) => set.has(key));
  return { screens: [...screens], states: states.size, bands: order(bands, ['desktop', 'tablet', 'mobile']), themes: order(themes, ['light', 'dark']) };
}

/** The album caption for a settled draw. */
const drawingLabel = (label, pick, labels) => {
  const fileName = path.basename(pick.file);
  if (!label) return fileName;
  if (labels.indexOf(label) !== labels.lastIndexOf(label)) return `${label} (${fileName})`;
  return label;
};

function drawCaption({ workflow, nodes, picks, counts, summary, oversize = [], language }) {
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
  labels.forEach((label, i) => body.push(`${i + 1}. ${drawingLabel(label, picks[i], labels)}`));
  return fitCaption([clipLine(t.drawn(title, names), 300)], body, ['', t.review]);
}

/* ------------------------------------------------------------ UAT */

const stepText = (s) => (typeof s === 'string' ? s : s?.action ?? s?.title ?? s?.name ?? s?.label ?? s?.text ?? s?.id ?? '');
const stepsOf = (doc) => {
  let steps;
  if (arr(doc?.steps).length) steps = doc.steps;
  else if (arr(doc?.journey?.steps).length) steps = doc.journey.steps;
  else steps = arr(doc?.journey);
  return steps.map(stepText).map((s) => String(s).trim()).filter(Boolean);
};
const flowFromRecord = (file, slug) => {
  const doc = readYaml(file);
  return doc ? { id: doc.id ?? slug, name: doc.title ?? slug ?? doc.id, slug: slug ?? doc.id, steps: stepsOf(doc) } : null;
};

/** The uat record a node id names (uat.<feature>.<flow>), under <repo>/.starciwork. */
const recordOfNodeId = (id, repo) => {
  const m = /^uat\.([^.]+)\.(.+)$/.exec(String(id ?? ''));
  return m ? firstFile([path.join(repo, '.starciwork', 'features', m[1], 'uat', m[2], 'index.yaml')]) : null;
};

/**
 * The flow one video (or screenshot) belongs to: the uat/<flow>/runs/ run it sits in, a video named
 * after its flow, the assisted request.yaml beside it, or the only uat record the report names.
 */
const flowFromRunPath = (file) => {
  const match = /^(.*\/features\/[^/]+\/uat)\/([^/]+)\/runs\//.exec(posix(file));
  if (!match || match[2] === 'runs') return null;
  return flowFromRecord(`${match[1]}/${match[2]}/index.yaml`, match[2]);
};

const flowFromNamedRecord = (file) => {
  const match = /^(.*\/features\/[^/]+\/uat)\//.exec(posix(file));
  if (!match) return null;
  const base = path.basename(file, path.extname(file));
  const record = `${match[1]}/${base}/index.yaml`;
  return isFile(record) ? flowFromRecord(record, base) : null;
};

const flowFromRequest = (file, repo) => {
  let dir = path.dirname(file);
  for (let i = 0; i < 5; i++) {
    const request = readYaml(path.join(dir, 'request.yaml'));
    const flows = arr(request?.flows);
    if (flows.length) {
      const flow = flows.length === 1 ? flows[0]
        : flows.find((row) => arr(row?.steps).some((step) => JSON.stringify(step?.evidence ?? '').includes(path.basename(file))));
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
  return null;
};

function flowOf(file, { records, repo }) {
  const fromRun = flowFromRunPath(file);
  if (fromRun) return fromRun;
  const fromName = flowFromNamedRecord(file);
  if (fromName) return fromName;
  const fromRequest = flowFromRequest(file, repo);
  if (fromRequest) return fromRequest;
  if (records.length === 1) return flowFromRecord(records[0], path.basename(path.dirname(records[0])));
  return null;
}

/** The flows a multi-flow run recorded, in order (its flows.json order), for a video no flow claims. */
function runFlowsOf(file) {
  let dir = path.dirname(file);
  for (let i = 0; i < 3; i++) {
    const order = arr(readJsonFile(path.join(dir, 'flows.json'))?.order);
    if (order.length) return order.map(String);
    dir = path.dirname(dir);
  }
  return [];
}

/**
 * The UAT media one report produced: its videos (with their flows) and, for the album, its
 * screenshots. The run folders of the uat records it names are searched too.
 */
function collectUat({ files, repo }) {
  const seen = expand(files);
  const records = [...seen.values()].filter((f) => /\/uat\/[^/]+\/index\.yaml$/.test(posix(f)) && !/\/uat\/runs\//.test(posix(f)));
  const runDirs = records.map((r) => { const ev = readYaml(r)?.evidence; return typeof ev === 'string' ? path.resolve(path.dirname(r), ev) : null; }).filter((d) => d && isDir(d));
  const all = [...expand(runDirs, { seen }).values()];
  const videos = all.filter(isVideo).map((file) => ({ file, flow: flowOf(file, { records, repo }), runFlows: runFlowsOf(file) }));
  const screenshots = all.filter(isImage);
  const flow = records.length === 1 ? flowFromRecord(records[0], path.basename(path.dirname(records[0]))) : null;
  return { videos, screenshots, records, flow };
}

const featureOf = (file) => /\/features\/([^/]+)\//.exec(posix(file))?.[1] ?? null;

/** The caption for one UAT video (or a screenshot album when `shots` is set). */
function uatCaption({ workflow, flow, verdict, summary, language, index = 1, total = 1, runFlows = [], fallbackName = null, shots = 0, note = null, prepare = false }) {
  const t = textFor(language);
  const prepareSuffix = prepare ? ` (${t.prepare})` : '';
  const name = `${clipLine(flow?.name ?? fallbackName ?? workflow.title ?? workflow.id, 140)}${prepareSuffix}`;
  const videoSuffix = total > 1 ? ` (${t.video} ${index}/${total})` : '';
  const heading = t.uat(name, verdictText(t, verdict));
  const head = [`${heading}${videoSuffix}`, `${t.workflow}: ${workflow.title || workflow.id}`];
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


const chunk = (list, n) => {
  const out = [];
  for (let i = 0; i < list.length; i += n) { out.push(list.slice(i, i + n)); }
  return out;
};

/* ------------------------------------------------------------ the settle */

export function readSettle(ledgerFile, { workflowId, op, attempt, dispatchId }) {
  const handle = inspectLedger({ file: ledgerFile });
  try {
    const db = handle.db;
    const row = (dispatchId && db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=? ORDER BY report_id DESC LIMIT 1').get(workflowId, dispatchId))
      || db.prepare('SELECT r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND a.op_id=? AND a.try_no=? ORDER BY r.report_id DESC LIMIT 1').get(workflowId, op, Number(attempt));
    const title = db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId)?.title ?? null;
    return { report: parse(row?.report_json, null), workflow: { id: workflowId, title } };
  } finally { try { handle.close(); } catch { /* closed */ } }
}

const planDrawMedia = ({ kind, verdict, workflow, files, repo, summary, language, t }) => {
  if (verdict !== 'pass') return { skip: 'a draw is sent when it settles pass' };
  const { picks, nodes } = collectDrawings({ files, repo });
  const fit = picks.filter((pick) => sizeOf(pick.file) <= LIMITS.photoBytes);
  const oversize = picks.filter((pick) => sizeOf(pick.file) > LIMITS.photoBytes);
  if (!picks.length) return { skip: 'no drawings found' };
  const caption = drawCaption({ workflow, nodes, picks, counts: drawingCounts(nodes, picks), summary, oversize, language });
  if (!fit.length) return { kind, sends: [{ type: 'note', text: caption }] };
  const albums = chunk(fit.map((pick) => pick.file), LIMITS.album);
  const headline = caption.split('\n')[0];
  return { kind, sends: albums.map((album, i) => ({ type: 'album', files: album, caption: i === 0 ? caption : `${headline} ${t.cont(i + 1, albums.length)}` })) };
};

const planUatMedia = ({ kind, op, verdict, workflow, files, repo, summary, language, t }) => {
  const { videos, screenshots, flow } = collectUat({ files, repo });
  if (videos.length) {
    const byFlow = new Map();
    for (const video of videos) { const key = video.flow?.id ?? ''; byFlow.set(key, (byFlow.get(key) ?? 0) + 1); }
    const index = new Map();
    const sends = videos.map((video) => {
      const key = video.flow?.id ?? '';
      const i = (index.get(key) ?? 0) + 1; index.set(key, i);
      const base = { workflow, flow: video.flow, verdict, summary, language, index: i, total: byFlow.get(key), runFlows: video.runFlows, fallbackName: featureOf(video.file), prepare: op === 'uat.assisted.prepare' };
      if (sizeOf(video.file) > LIMITS.videoBytes) return { type: 'note', text: uatCaption({ ...base, note: `${t.tooBigVideo} ${video.file}` }) };
      return { type: 'video', file: video.file, caption: uatCaption(base) };
    });
    return { kind, sends };
  }
  if (verdict !== 'pass') return { skip: 'no UAT video; screenshots are sent only for a pass' };
  const shots = screenshots.filter((file) => sizeOf(file) <= LIMITS.photoBytes);
  if (!shots.length) return { skip: 'no UAT media found' };
  const sent = shots.slice(0, LIMITS.screenshots);
  const extra = shots.length - sent.length;
  const caption = uatCaption({ workflow, flow, verdict, summary, language, shots: sent.length, fallbackName: featureOf(sent[0]), note: extra > 0 ? t.more(extra) : null });
  const albums = chunk(sent, LIMITS.album);
  return { kind, sends: albums.map((album, i) => ({ type: 'album', files: album, caption: i === 0 ? caption : `${caption.split('\n')[0]} ${t.cont(i + 1, albums.length)}` })) };
};

/** What a settle has to send: {kind, sends:[{type, files|file, caption|text}]} or {skip}. */
export function planSettleMedia({ op, verdict, report, workflow, repo, language }) {
  const kind = mediaKindOf(op);
  if (!kind) return { skip: 'not a media op' };
  if (!report) return { skip: 'no report filed' };
  const roots = [repo];
  const files = arr(report.files).map((file) => resolveIn(file, roots)).filter(Boolean);
  const summary = String(report.summary ?? '').trim();
  const t = textFor(language);
  if (kind === 'draw') return planDrawMedia({ kind, verdict, workflow, files, repo, summary, language, t });
  return planUatMedia({ kind, op, verdict, workflow, files, repo, summary, language, t });
}
