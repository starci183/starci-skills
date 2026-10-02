// display-names.mjs — the names a person reads for a workflow, an operation and an op job.
//
// Owner request 2026-09-27: kernels, workflows and op workers need easy-to-understand names.
// The ids stay the keys everywhere (workflow_id, op_id, job_id); these are labels only:
//   workflow  workflows.display_name (api rename; derived at define-goal), else the goal slug in
//             workflows.title, else the workflow id. Vietnamese, `<Product> · <what it does>`.
//   operation modules/ops/_labels.yaml (vi/en), else the op id.
//   op job    `<op label> · <what> · <workflow name>`: `what` is the job's target — an explicit
//             enqueue --what, the work-graph node it covers, the Work record it owns, the slice
//             its title names, its feature path, its cut — at most JOB_WHAT_MAX characters.
// Every human-facing surface reads these helpers: the [Kernel]/[Op] Orca titles, api status,
// the supervisor digest and progress report, Telegram notices and the harness UI.
import fs from 'node:fs';
import path from 'node:path';
import { clipLine, squash } from './clip.mjs';
import { ownerLanguage, translator } from './i18n.mjs';
import { list } from './list.mjs';
import { parseJson } from './json.mjs';
import { readYamlFile } from './read-yaml.mjs';
import { normRel, pathsOverlap } from './path-key.mjs';
import { PRODUCT_NAME_SEGMENT } from './example-refs.mjs';

export const WORKFLOW_NAME_MAX = 48;
const DISPLAY_NAME_LIMIT = 80;
export const JOB_WHAT_MAX = 40;
const NAME_SEPARATOR = ' · ';

const LABELS_FILE = new URL('../../modules/ops/_labels.yaml', import.meta.url);
let labelsCache = null;
/** {op: {vi, en}} from modules/ops/_labels.yaml; {} when the file is unreadable. */
export function opLabelMap() {
  if (labelsCache) return labelsCache;
  labelsCache = Object.freeze({ ...(readYamlFile(LABELS_FILE)?.labels ?? {}) });
  return labelsCache;
}
/** The human label of an op (a `op#instance` leg label reads as its op), else the op id itself. */
export function opLabel(op, language = ownerLanguage()) {
  const id = String(op ?? '').trim();
  if (!id) return '';
  const entry = opLabelMap()[id] ?? opLabelMap()[id.split('#')[0]];
  const label = entry?.[language] ?? entry?.vi;
  return typeof label === 'string' && label.trim() ? label.trim() : id;
}

/** One line, whitespace collapsed; '' for nothing. */
/** `text` cut at a word boundary to at most `max` characters, ending in an ellipsis when cut. */
function clipWords(text, max) {
  const s = squash(text);
  if (s.length <= max) return s;
  const room = s.slice(0, max - 1);
  const at = room.lastIndexOf(' ');
  return `${(at >= max / 2 ? room.slice(0, at) : room).replace(/[\s,;:.·–—-]+$/, '')}…`;
}

/**
 * A display name as the api stores it: one line, trimmed, 1..DISPLAY_NAME_LIMIT characters. Throws
 * {code: 'rename-bad-title'} otherwise.
 */
export function normalizeDisplayName(name) {
  const s = squash(name);
  if (!s) throw Object.assign(new Error('the display name is empty'), { code: 'rename-bad-title' });
  if (s.length > DISPLAY_NAME_LIMIT) throw Object.assign(new Error(`the display name is ${s.length} characters; at most ${DISPLAY_NAME_LIMIT}`), { code: 'rename-bad-title' });
  return s;
}

/** A workflows row's name: display_name, else the goal slug (title), else the workflow id. */
export function workflowDisplayName(row) {
  if (!row) return null;
  return squash(row.display_name) || squash(row.title) || row.workflow_id || null;
}
/** The name of one workflow of `db` (its id when the row is missing). */
export function workflowNameOf(db, workflowId) {
  if (!workflowId) return null;
  try { return workflowDisplayName(db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId)) ?? workflowId; }
  catch { return workflowId; }
}
/** workflow_id -> name for every workflow of `db` (`displayOnly` keeps only rows with a display_name). */
export function workflowNames(db, { displayOnly = false } = {}) {
  try {
    const rows = db.prepare('SELECT * FROM workflows').all().filter((row) => !displayOnly || row.display_name);
    return new Map(rows.map((row) => [row.workflow_id, displayOnly ? row.display_name : workflowDisplayName(row)]));
  } catch { return new Map(); }
}
/** `Name (id)` for a line that must still carry the key, or the id alone when there is no other name. */
export const nameWithId = (name, id) => (name && name !== id ? `${name} (${id})` : String(id ?? name ?? ''));

/** The name of an attached file record ({name?, abs}): its declared name, else its basename, forward-slashed. */
export const attachedNameOf = (file) => String(file.name ?? path.basename(String(file.abs ?? ''))).replace(/\\/g, '/');

// ---------------------------------------------------------------------------------- workflow names
const BRAND_CASE = { starci: 'StarCi' };
const REPO_ROLE_SUFFIX = /[-_](backend|be|frontend|fe|api|server|web|app)$/i;
/** The product's display word(s) from a project or repository name: `shop-be` -> `Shop`. */
export function productName(raw) {
  const base = squash(raw).replace(REPO_ROLE_SUFFIX, '');
  if (!base) return '';
  return base.split(/[-_\s]+/).filter(Boolean)
    .map((w) => BRAND_CASE[w.toLowerCase()] ?? (w.length <= 3 && /^[a-z]+$/i.test(w) && w === w.toUpperCase() ? w : `${w[0].toUpperCase()}${w.slice(1)}`)).join(' ');
}
/** The first clause of the owner's goal text: up to the first sentence end, line break, colon or dash aside. */
function firstClause(text) {
  const s = String(text ?? '').split(/\r?\n/).map(squash).find(Boolean) ?? '';
  const clause = s.split(/(?<=[.!?;:])\s|\s[—–-]\s|\s\(/)[0] ?? '';
  return clause.replace(/[\s.!?;:,]+$/, '').trim();
}
/**
 * A readable name for a new goal (define-goal): `<Product> · <first clause of the goal text>`, at
 * most WORKFLOW_NAME_MAX characters; `fallback` (the goal slug) when the text yields nothing usable.
 */
export function deriveWorkflowDisplayName({ text, product = null, fallback = null, max = WORKFLOW_NAME_MAX } = {}) {
  const prod = productName(product);
  // The product leads the name already: a goal text that opens with it ("<product>: …") starts after it.
  let body = squash(text);
  if (prod && body.toLowerCase().startsWith(prod.toLowerCase())) body = body.slice(prod.length).replace(/^[\s:·,–—-]+/, '');
  const clause = firstClause(body);
  const head = prod ? `${prod}${NAME_SEPARATOR}` : '';
  const room = max - head.length;
  if (!clause || !/[\p{L}\p{N}]/u.test(clause) || room < 8) return fallback ? clipWords(fallback, max) : (prod || null);
  return `${head}${clipWords(`${clause[0].toUpperCase()}${clause.slice(1)}`, room)}`;
}

// ------------------------------------------------------------------------------------ op job names
const keyOf = (p) => normRel(p, { fold: true });
// A path this broad names no target in particular (the whole Work tree, every feature).
const BROAD = /^(\.starciwork|\.starciwork\/index\.yaml|\.starciwork\/features|\.starciwork\/features\/index\.yaml|src|apps|packages)?$/;
const meets = pathsOverlap;

/** The work-graph node the job covers most specifically (its longest owned path that meets the job's). */
function coveredNode(nodes, paths) {
  const keys = paths.map(keyOf).filter((k) => k && !BROAD.test(k));
  let best = null, bestLen = -1;
  for (const node of list(nodes)) {
    for (const owned of list(node?.ownedPaths).map(keyOf).filter((k) => k && !BROAD.test(k))) {
      if (keys.some((k) => meets(k, owned)) && owned.length > bestLen) { best = node; bestLen = owned.length; }
    }
  }
  return best;
}

const titleCache = new Map();
/** The `title:` of the Work record at `<repo>/<p>` (a record folder or its index.yaml), else null. */
function recordTitle(repo, p) {
  if (!repo || !p) return null;
  const rel = String(p).replaceAll('\\', '/').replace(/\/+$/, '');
  if (!rel.startsWith('.starciwork/') || BROAD.test(rel.toLowerCase())) return null;
  const file = path.join(repo, rel.endsWith('.yaml') ? rel : `${rel}/index.yaml`);
  if (!file.endsWith('index.yaml')) return null;
  let mtime = null;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return null; }
  const hit = titleCache.get(file);
  if (hit && hit.mtime === mtime) return hit.title;
  let title = null;
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 4096);
    const m = /^title:[ \t]*(.*)$/m.exec(head);
    let value = m ? m[1] : '';
    // A folded or literal block scalar (title: >-) continues on the indented lines right below it.
    if (m && /^[>|][-+]?\s*$/.test(value)) {
      const below = head.slice(m.index + m[0].length).split(/\r?\n/).slice(1);
      const end = below.findIndex((l) => !/^\s+\S/.test(l));
      value = (end < 0 ? below : below.slice(0, end)).join(' ');
    }
    title = squash(value.replace(/^(['"])(.*)\1$/, '$2')) || null;
  } catch { title = null; }
  if (titleCache.size > 2000) titleCache.clear();
  titleCache.set(file, { mtime, title });
  return title;
}

// Folder names that say what kind of record sits there, not which one.
const FAMILY = new Set(['ui', 'fr', 'br', 'nfr', 'uat', 'sds', 'contract', 'data', 'journey', 'decision', 'scope', 'business', 'integration',
  'impl', 'operations', 'evidence', 'e', 'assets', 'tools', 'src', 'apps', 'features', 'provision', 'shell', 'brand', 'lib', 'components', 'pages']);
const words = (s) => s.replace(/[-_]+/g, ' ').trim();
/** A short label from an owned path: `features/collab/ui/office` -> `collab / office`. */
export function pathLabel(p) {
  const segs = String(p ?? '').replaceAll('\\', '/').split('/').filter(Boolean).filter((s) => s !== '.starciwork');
  const at = segs.indexOf('features');
  if (at >= 0 && segs[at + 1]) {
    const feature = segs[at + 1];
    const rest = segs.slice(at + 2).filter((s) => !s.includes('.') && !FAMILY.has(s.toLowerCase()) && !PRODUCT_NAME_SEGMENT.test(s));
    const leaf = rest.at(-1);
    return leaf && leaf !== feature ? `${words(feature)} / ${words(leaf)}` : words(feature);
  }
  const plain = segs.filter((s) => !FAMILY.has(s.toLowerCase()) && !/^wf-/i.test(s));
  const last = plain.at(-1);
  return last ? words(last.replace(/\.[a-z0-9]+$/i, '')) : null;
}

/** A work-graph node's short label from its id: `login.sign-in` -> `login / sign in`. */
export function nodeLabel(node) {
  const id = String(node?.id ?? '');
  const domain = String(node?.domain ?? '');
  const leaf = domain && id.startsWith(`${domain}.`) ? id.slice(domain.length + 1) : id;
  return domain && leaf && leaf !== domain ? `${words(domain)} / ${words(leaf.replaceAll('.', ' '))}` : words(id.replaceAll('.', ' '));
}

/**
 * What an op job works on, for a human: at most JOB_WHAT_MAX characters, or null when nothing names it.
 * `payload` is the job payload, `op` its op id, `nodes` the workflow's latest work-graph nodes, `repo`
 * the ledger owner (to read Work record titles).
 */
export function jobWhat({ payload, op = null, nodes = null, repo = null, max = JOB_WHAT_MAX, language = ownerLanguage() } = {}) {
  const p = payload ?? {};
  const owned = list(p.owned_paths ?? p.ownedPaths).map((x) => (typeof x === 'string' ? x : x?.path)).filter(Boolean);
  const records = list(p.records).filter((x) => typeof x === 'string');
  const cut = p.cut && typeof p.cut === 'object' ? p.cut : null;
  const title = squash(p.title);
  const opId = String(op ?? p.opId ?? '');
  const rest = opId && title.toLowerCase().startsWith(opId.toLowerCase()) ? title.slice(opId.length).replace(/^[\s:#·–—-]+/, '') : null;
  const specific = [...owned, ...records].filter((x) => !BROAD.test(keyOf(x)));
  // A title that already fits is the target's own name; a sentence-long one gives way to the short id.
  const fits = (t) => (t && squash(t).length <= max ? t : null);
  const node = coveredNode(nodes, owned);
  const candidates = [
    () => squash(p.displayWhat),
    () => { for (const x of specific) { const t = fits(recordTitle(repo, x)); if (t) return t; } return null; },
    () => fits(node?.title),
    () => (node?.id ? nodeLabel(node) : null),
    () => rest,
    () => (specific[0] ? pathLabel(specific[0]) : null),
    () => (rest === null && title && title !== opId ? firstClause(title) : null),
    () => (cut?.id ? words(String(cut.id)) : null),
  ];
  let what = null;
  for (const pick of candidates) { const v = squash(pick()); if (v) { what = v; break; } }
  const tail = cut && Number(cut.total) > 1 && Number.isInteger(Number(cut.ordinal)) ? ` ${cut.ordinal}/${cut.total}` : '';
  if (!what) return tail ? translator(language)('part{tail}', { tail }) : null;
  return `${clipWords(what, Math.max(8, max - tail.length))}${tail}`;
}

/** `<op label> · <what> · <workflow name>`, skipping a missing part. */
export function jobDisplayName({ op, what = null, workflowName = null, language = ownerLanguage() } = {}) {
  return [opLabel(op, language), squash(what), squash(workflowName)].filter(Boolean).join(NAME_SEPARATOR);
}

/**
 * The display name of one jobs row of `db`: reads its workflow's name and latest work-graph nodes unless
 * given. `cache` (a Map) shares the workflow reads across many jobs.
 */
export function jobDisplayNameOf(db, job, { repo = null, workflowName = null, nodes = undefined, cache = null, language = ownerLanguage() } = {}) {
  if (!job) return null;
  const payload = typeof job.payload_json === 'string' ? parseJson(job.payload_json, {}) : (job.payload ?? {});
  const op = job.op_id ?? job.opId ?? payload.opId ?? null;
  const wf = job.workflow_id ?? job.workflowId ?? null;
  const memo = cache ?? new Map();
  const wfInfo = memo.get(wf) ?? (() => {
    const info = { name: workflowNameOf(db, wf), nodes: null, repo: null };
    // The ledger owner's root (to read Work record titles) when the caller names none: the workflow's first source root.
    try { info.repo = parseJson(db.prepare('SELECT source_roots_json FROM workflows WHERE workflow_id=?').get(wf)?.source_roots_json)?.[0] ?? null; } catch { info.repo = null; }
    try {
      const row = db.prepare("SELECT graph_json FROM work_graph_versions WHERE workflow_id=? ORDER BY version DESC LIMIT 1").get(wf);
      info.nodes = row ? parseJson(row.graph_json)?.nodes ?? null : null;
    } catch { info.nodes = null; }
    memo.set(wf, info);
    return info;
  })();
  const what = jobWhat({ payload, op, nodes: nodes === undefined ? wfInfo.nodes : nodes, repo: repo ?? wfInfo.repo, language });
  return jobDisplayName({ op, what, workflowName: workflowName ?? wfInfo.name, language });
}
