// starciwork-boundary.mjs — the executable form of the .starciwork boundary (ARCHITECTURE-DB §5.1,
// modules/schemas/work-layout.yaml shape.productPaths). A repository's .starciwork holds product content only:
// the explicit path list below. Every other path is agent data (reports, checks, captures, draw rounds, UAT runs,
// logs, caches, ledgers, worktrees), which lives in runtime.sqlite rows and content-addressed blobs outside
// every repository. STARCIWORK_GITIGNORE is the .starciwork/.gitignore content of a product repository.
//
// Paths are relative to the .starciwork root, '/'-separated.
import fs from 'node:fs';
import path from 'node:path';

// The one source of the .starciwork/.gitignore text: the app root template `hfs sync` renders (packages/hfs/templates).
const TEMPLATE = path.join(import.meta.dirname, '..', '..', 'packages', 'hfs', 'templates', 'app', 'starciwork.gitignore');

// The record families that hold nothing but index.yaml and evidence.yaml (ui, impl, uat and ac have their own rows).
export const PLAIN_FAMILIES = Object.freeze(['br', 'fr', 'nfr', 'data', 'journey', 'decision', 'sds', 'contract', 'integration', 'gap', 'event']);
const RECORD_FILE = /^(index|evidence)\.yaml$/;
const UAT_FILE = /^(index\.yaml|evidence\.yaml|accounts\.yaml|fixtures\.yaml|seed\.sql|cleanup\.sql)$/;
const PLAIN = new RegExp(`^(${PLAIN_FAMILIES.join('|')})$`);
const ANY = /^.+$/;
const REST = '**';
// One or more record-name folders: a record may nest by name segment where a group needs it (br/title/required,
// fr/cart/add, ui/<group>/<screen>, impl/<repo>/<group>/<name>). A nesting folder is never assets/ or an agent-data
// folder (DENY_SEGMENT), so a capture or run can never pass as a record.
const NEST = '+';
const NEST_SEGMENT = /^(?!assets$).+$/;

// Each pattern is a list of segment matchers: a string (exact), a RegExp (one segment), '+' (one or more record-name
// folders) or '**' (one or more segments of anything). Order follows §5.1.
export const PRODUCT_PATTERNS = Object.freeze([
  ['.gitignore'], ['.gitattributes'], ['workspace.yaml'], ['index.yaml'],
  ['brand', RECORD_FILE], ['brand', 'assets', REST],
  ['shell', RECORD_FILE],
  ['_resources', /^(environments|identities|fixtures|runtimes)$/, ANY, REST],
  ['_resources', 'grammar-captures', REST],
  ['_derived', /^(index\.yaml|frontier\.md|critique\.yaml|critique\.md)$/],
  ['features', 'index.yaml'],
  ['features', ANY, 'index.yaml'],
  ['features', ANY, /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)$/, 'index.yaml'],
  ['features', ANY, PLAIN, NEST, RECORD_FILE],
  ['features', ANY, 'br', NEST, 'ac', NEST, RECORD_FILE],
  ['features', ANY, 'ui', NEST, RECORD_FILE],
  ['features', ANY, 'ui', NEST, /^(flow|lifecycle-interface)\.yaml$/],
  ['features', ANY, 'ui', NEST, 'assets', REST],
  ['features', ANY, 'impl', ANY, 'index.yaml'],
  ['features', ANY, 'impl', ANY, NEST, RECORD_FILE],
  ['features', ANY, 'uat', NEST, UAT_FILE],
].map(Object.freeze));

// Agent output that is refused even where a pattern above would admit it: draw rounds inside a ui record's
// assets, stray report copies, evidence bundles, evidence/ captures and UAT runs anywhere, temp JSON.
const DENY_SEGMENT = /^(draw-loop|evidence|runs|kernel-evidence|kernel-strays|kernel-approvals)$/;
const DENY_FILE = /^(report.*\.json|.*\.tmp\.json)$/;

const segs = (rel) => String(rel ?? '').replace(/\\/g, '/').split('/').filter((s) => s && s !== '.');
const fits = (matcher, seg) => (typeof matcher === 'string' ? matcher === seg : matcher.test(seg));

function denied(parts, { dir = false } = {}) {
  // The last segment of a file path is a file name: `evidence.yaml` is a record file, never an evidence/ bundle.
  const dirs = dir ? parts : parts.slice(0, -1);
  if (dirs.some((s) => DENY_SEGMENT.test(s))) return true;
  return !dir && parts.length > 0 && DENY_FILE.test(parts.at(-1));
}

// Match parts[i..] against pattern[p..]. `prefix`: parts is a directory, true when some file under it could match.
function walk(pattern, p, parts, i, prefix) {
  if (i === parts.length) return prefix ? p < pattern.length : p === pattern.length;
  if (p === pattern.length) return false;
  const m = pattern[p];
  if (m === REST) return prefix || parts.length > i;
  if (m === NEST) {
    if (!NEST_SEGMENT.test(parts[i])) return false;
    // consume this folder, then either stop nesting or keep nesting
    return walk(pattern, p + 1, parts, i + 1, prefix) || walk(pattern, p, parts, i + 1, prefix);
  }
  return fits(m, parts[i]) && walk(pattern, p + 1, parts, i + 1, prefix);
}
const matchFile = (pattern, parts) => walk(pattern, 0, parts, 0, false);

/** True when the FILE at `rel` (relative to .starciwork) is product content §5.1 admits. */
export function isProductPath(rel) {
  const parts = segs(rel);
  if (!parts.length || denied(parts)) return false;
  return PRODUCT_PATTERNS.some((p) => matchFile(p, parts));
}

const ROOT_CACHE_DIRS = new Set(['settle-parity', 'settle-tail', 'runtime', 'canon-seams']);
const ROOT_CACHE_FILE = /^(.*\.tmp\.json|tmp-.*\.json|scan-i18n.*\.json|runtime-budget\.json|ledger-anchor\.json|supervisor-precheck\.mjs)$/;

/**
 * The §5.2 category of a KNOWN agent-data path, or null when the path is not one. Known agent data — the
 * categories scripts/work/validate/check-example-work.mjs refuses in a .starciwork tree [HFS_AGENT_DATA_TRACKED]:
 * ledger, logs-db, worktrees, kernel-evidence, kernel-strays, evidence-bundle, capture (impl captures),
 * layout-capture (shell/assets), uat-run, draw-round, interface-audit (features/<f>/operations/), stray-report,
 * cache. A path that is neither known agent data nor on the §5.1 list
 * (isProductPath) is drift: product records in a retired layout, kept and reported, never removed by a script.
 */
export function agentDataCategory(rel, { dir = false } = {}) {
  const parts = segs(rel);
  if (!parts.length) return null;
  const top = parts[0];
  const dirs = dir ? parts : parts.slice(0, -1);
  const name = dir ? null : parts.at(-1);
  if (parts.length === 1 && !dir && /^runtime\.sqlite/.test(top)) return 'ledger';
  if (parts.length === 1 && !dir && /^logs\.sqlite/.test(top)) return 'logs-db';
  if (top === 'worktrees') return 'worktrees';
  if (top === 'kernel-evidence') return 'kernel-evidence';
  if (top === 'kernel-strays' || top === 'kernel-approvals') return 'kernel-strays';
  if (ROOT_CACHE_DIRS.has(top) && (dir || parts.length > 1)) return 'cache';
  if (parts.length === 1 && !dir && ROOT_CACHE_FILE.test(top)) return 'cache';
  if (dirs.includes('draw-loop')) return 'draw-round';
  if (dirs.includes('runs') && dirs[0] === 'features' && dirs.includes('uat')) return 'uat-run';
  if (dirs.includes('evidence')) return 'evidence-bundle';
  if (dirs[0] === 'features' && dirs.includes('operations')) return 'interface-audit';
  if (dirs[0] === 'features' && dirs.includes('impl') && dirs.includes('assets')) return 'capture';
  if (dirs[0] === 'shell' && dirs[1] === 'assets') return 'layout-capture';
  if (name && /^report.*\.json$/.test(name)) return 'stray-report';
  if (name && /\.tmp\.json$/.test(name)) return 'cache';
  return null;
}

/**
 * The .starciwork/.gitignore of a product repository: deny everything at the root, re-admit
 * the §5.1 roots, then deny agent output inside them. Tracked files are not affected by an ignore rule; a tracked
 * agent file is removed by the change that drops it, not by this ignore.
 *
 * The template is read on first use, never at import: a caller that only needs the boundary predicates
 * (cli.mjs reaches this module through check-example-work.mjs) must keep loading on a tree that carries no
 * packages/hfs/templates copy; the read still fails loudly the moment the text itself is asked for.
 */
let cachedLines;
const gitignoreLines = () => (cachedLines ??= Object.freeze(fs.readFileSync(TEMPLATE, 'utf8').trimEnd().split(/\r?\n/)));
const frozenWrite = () => { throw new TypeError('STARCIWORK_GITIGNORE is a frozen view of the hfs template'); };
export const STARCIWORK_GITIGNORE = new Proxy([], {
  get: (_t, p) => Reflect.get(gitignoreLines(), p),
  has: (_t, p) => Reflect.has(gitignoreLines(), p),
  ownKeys: () => Reflect.ownKeys(gitignoreLines()),
  getOwnPropertyDescriptor: (_t, p) => {
    const d = Reflect.getOwnPropertyDescriptor(gitignoreLines(), p);
    // The proxy target holds none of these slots: every index must report configurable, and 'length' must keep
    // the writable shape of its non-configurable target slot.
    if (!d) return d;
    return p === 'length' ? { ...d, writable: true } : { ...d, configurable: true };
  },
  set: frozenWrite,
  deleteProperty: frozenWrite,
  defineProperty: frozenWrite,
  setPrototypeOf: frozenWrite,
});
export const starciworkGitignoreText = () => `${gitignoreLines().join('\n')}\n`;
