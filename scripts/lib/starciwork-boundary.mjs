// starciwork-boundary.mjs — the executable form of the .starciwork boundary (ARCHITECTURE-DB §5.1,
// modules/schemas/work-layout.yaml shape.productPaths). A repository's .starciwork holds product content only:
// the explicit path list below. Every other path is agent data (reports, checks, captures, draw rounds, UAT runs,
// logs, caches, ledgers, worktrees), which lives in runtime.sqlite rows and content-addressed blobs outside
// every repository. STARCIWORK_GITIGNORE is the .starciwork/.gitignore content of a product repository (the
// example trees write it through scripts/example/work-example.mjs).
//
// Paths are relative to the .starciwork root, '/'-separated.

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
  ['brand', 'index.yaml'], ['brand', 'assets', REST],
  ['shell', 'index.yaml'],
  ['_resources', /^(environments|identities|fixtures|runtimes)$/, ANY, REST],
  ['_resources', 'grammar-captures', REST],
  ['_derived', /^(index\.yaml|frontier\.md)$/],
  ['features', ANY, 'index.yaml'],
  ['features', ANY, PLAIN, NEST, RECORD_FILE],
  ['features', ANY, 'br', NEST, 'ac', NEST, RECORD_FILE],
  ['features', ANY, 'ui', NEST, RECORD_FILE],
  ['features', ANY, 'ui', NEST, 'assets', REST],
  ['features', ANY, 'impl', ANY, NEST, RECORD_FILE],
  ['features', ANY, 'uat', NEST, UAT_FILE],
].map(Object.freeze));

// Agent output that is refused even where a pattern above would admit it: draw rounds inside a ui record's
// assets, stray report copies, evidence bundles, E/ captures and UAT runs anywhere, temp JSON.
const DENY_SEGMENT = /^(draw-loop|E|evidence|runs|kernel-evidence|kernel-strays|kernel-approvals)$/;
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
const prefixOf = (pattern, parts) => walk(pattern, 0, parts, 0, true);

/** True when the FILE at `rel` (relative to .starciwork) is product content §5.1 admits. */
export function isProductPath(rel) {
  const parts = segs(rel);
  if (!parts.length || denied(parts)) return false;
  return PRODUCT_PATTERNS.some((p) => matchFile(p, parts));
}

/** True when the DIRECTORY at `rel` may hold product content; false means the whole tree is agent data. */
export function mayHoldProduct(rel) {
  const parts = segs(rel);
  if (!parts.length) return true;
  if (denied(parts, { dir: true })) return false;
  return PRODUCT_PATTERNS.some((p) => prefixOf(p, parts));
}

const ROOT_CACHE_DIRS = new Set(['settle-parity', 'settle-tail', 'runtime', 'canon-seams']);
const ROOT_CACHE_FILE = /^(.*\.tmp\.json|tmp-.*\.json|scan-i18n.*\.json|runtime-budget\.json|ledger-anchor\.json|supervisor-precheck\.mjs)$/;

/**
 * The §5.2 category of a KNOWN agent-data path, or null when the path is not one. Known agent data — the
 * categories scripts/checks/check-example-work.mjs refuses in a .starciwork tree [STARCIWORK_AGENT_DATA]:
 * ledger, logs-db, worktrees, kernel-evidence, kernel-strays, evidence-bundle, capture (E/ and impl captures),
 * layout-capture (shell/assets), uat-run, draw-round, interface-audit (features/<f>/operations/), stray-report,
 * cache, legacy-import (root import-cv-*). A path that is neither known agent data nor on the §5.1 list
 * (isProductPath) is drift: product records in a legacy layout, kept and reported, never removed by a script.
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
  if (/^import-cv-/.test(top)) return 'legacy-import';
  if (dirs.includes('draw-loop')) return 'draw-round';
  if (dirs.includes('runs') && dirs[0] === 'features' && dirs.includes('uat')) return 'uat-run';
  if (dirs.includes('E')) return 'capture';
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
 */
export const STARCIWORK_GITIGNORE = Object.freeze([
  '# StarCi .starciwork: product content only (ARCHITECTURE-DB §5.1, work-layout.yaml shape.productPaths).',
  '# Agent output (reports, checks, captures, draw rounds, UAT runs, logs, ledgers, worktrees) lives in',
  '# runtime.sqlite rows and blobs outside the repository.',
  '/*',
  '!/.gitignore', '!/.gitattributes', '!/workspace.yaml', '!/index.yaml',
  '!/brand/', '!/shell/', '!/_resources/', '!/_derived/', '!/features/',
  '/brand/*', '!/brand/index.yaml', '!/brand/assets/',
  '/shell/*', '!/shell/index.yaml',
  '/_resources/*', '!/_resources/environments/', '!/_resources/identities/', '!/_resources/fixtures/',
  '!/_resources/runtimes/', '!/_resources/grammar-captures/',
  '/_derived/*', '!/_derived/index.yaml', '!/_derived/frontier.md',
  'E/', 'evidence/', 'runs/', 'draw-loop/', 'operations/', 'report*.json', '*.tmp.json',
  '/features/**/impl/**/assets/', '/shell/assets/',
]);
export const starciworkGitignoreText = () => `${STARCIWORK_GITIGNORE.join('\n')}\n`;
