// starciwork-boundary.mjs — the executable form of the .starciwork boundary (ARCHITECTURE-DB §5.1,
// modules/schemas/work-layout.yaml shape.productPaths). A repository's .starciwork holds product content only:
// the explicit path list below. Every other path is agent data (reports, checks, captures, draw rounds, UAT runs,
// logs, caches, ledgers, worktrees), which lives in runtime.sqlite rows and content-addressed blobs outside
// every repository. scripts/supervisor/comeback.mjs archives and removes whatever sits outside the list, and
// STARCIWORK_GITIGNORE is the .starciwork/.gitignore the runtime installs in product repositories.
//
// Paths are relative to the .starciwork root, '/'-separated.

// The record families that hold nothing but index.yaml and evidence.yaml (ui, impl, uat and ac have their own rows).
export const PLAIN_FAMILIES = Object.freeze(['br', 'fr', 'nfr', 'data', 'journey', 'decision', 'sds', 'contract', 'integration', 'gap', 'event']);
const RECORD_FILE = /^(index|evidence)\.yaml$/;
const UAT_FILE = /^(index\.yaml|evidence\.yaml|accounts\.yaml|fixtures\.yaml|seed\.sql|cleanup\.sql)$/;
const PLAIN = new RegExp(`^(${PLAIN_FAMILIES.join('|')})$`);
const ANY = /^.+$/;
const REST = '**';

// Each pattern is a list of segment matchers: a string (exact), a RegExp (one segment) or '**' (one or more more
// segments). Order follows §5.1.
export const PRODUCT_PATTERNS = Object.freeze([
  ['.gitignore'], ['.gitattributes'], ['workspace.yaml'], ['index.yaml'],
  ['brand', 'index.yaml'], ['brand', 'assets', REST],
  ['shell', 'index.yaml'],
  ['_resources', /^(environments|identities|fixtures|runtimes)$/, ANY, REST],
  ['_resources', 'grammar-captures', REST],
  ['_derived', /^(index\.yaml|frontier\.md)$/],
  ['features', ANY, 'index.yaml'],
  ['features', ANY, PLAIN, ANY, RECORD_FILE],
  ['features', ANY, 'br', ANY, 'ac', ANY, RECORD_FILE],
  ['features', ANY, 'ui', ANY, RECORD_FILE],
  ['features', ANY, 'ui', ANY, 'assets', REST],
  ['features', ANY, 'impl', ANY, ANY, RECORD_FILE],
  ['features', ANY, 'uat', ANY, UAT_FILE],
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

function matchFile(pattern, parts) {
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] === REST) return parts.length > i;
    if (i >= parts.length || !fits(pattern[i], parts[i])) return false;
  }
  return parts.length === pattern.length;
}

function prefixOf(pattern, parts) {
  for (let i = 0; i < parts.length; i += 1) {
    if (i >= pattern.length) return false;
    if (pattern[i] === REST) return true;
    if (!fits(pattern[i], parts[i])) return false;
  }
  return parts.length < pattern.length;
}

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
 * The §5.2 category of a KNOWN agent-data path, or null when the path is not one. Known agent data is what the
 * comeback archives and removes: ledger, logs-db, worktrees, kernel-evidence, kernel-strays, evidence-bundle,
 * capture (E/ and impl captures), layout-capture (shell/assets), uat-run, draw-round, interface-audit
 * (features/<f>/operations/), stray-report, cache, legacy-import (root import-cv-*). A path that is neither known
 * agent data nor on the §5.1 list (isProductPath) is drift: product records in a legacy layout, kept and reported,
 * never removed by a script.
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
 * The .starciwork/.gitignore the runtime installs in a product repository: deny everything at the root, re-admit
 * the §5.1 roots, then deny agent output inside them. Tracked files are not affected by an ignore rule; the
 * comeback removes the tracked agent files it archived.
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
