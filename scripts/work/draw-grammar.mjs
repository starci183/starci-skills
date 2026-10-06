#!/usr/bin/env node
// draw-grammar.mjs — which @starci/grammar a drawing renders against (owner ruling 2026-09-27: the draw must render
// against the grammar version the product will SHIP).
//
// Candidates, in order:
//   product      the grammar the product has installed (resolved from the product app dir, as its bundler would)
//   claude-dist  the runtime-built package (.claude/packages/grammar/dist, the grammar main carries - possibly
//                newer than the product's install, e.g. Meter segments 0.5.2 against an installed 0.5.0)
// The product's install wins when it SATISFIES what the draw needs, and "satisfies" is decided by TypeScript: the
// draw file type-checks against that candidate's types (scripts/work/draw/draw-source.mjs typecheckDraw). When only
// claude-dist satisfies, the drawing renders against it through an alias in the draw bundle ONLY (draw-render.mjs
// --grammar-root), the provenance says so (grammarSource claude-dist@<v>) and an upgrade of the product is OWED
// (upgradeOwed {status: owed, from, to, range, inRange}) - interface.implement bumps the product's dependency; the
// draw never touches the product's package.json. When neither satisfies: DRAW_TYPECHECK_FAILED.
//
//   starci work draw-grammar --product <app dir> [--file <X.draw.tsx>] [--grammar auto|product|claude-dist]
//        [--grammar-dist <package root>]   (default .claude/packages/grammar; env STARCI_GRAMMAR_DIST; a lane checkout
//        without a built dist points it at the live checkout's)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { findPackage } from '../lib/package-at.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { GRAMMAR_PACKAGE, typecheckDraw } from './draw/draw-source.mjs';
import { grammarDistStatus } from '../gates/grammar-dist.mjs';
import { isFile } from './work-io.mjs';
import { isMain } from '../lib/is-main.mjs';

const GRAMMAR_SOURCES = Object.freeze(['product', 'claude-dist']);
export const PREFERENCES = Object.freeze(['auto', ...GRAMMAR_SOURCES]);
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The product's declared range for the grammar (dependencies/devDependencies/peerDependencies), or null. */
function productRangeOf(productDir) {
  const pkg = readJsonFile(path.join(productDir, 'package.json'));
  return pkg?.dependencies?.[GRAMMAR_PACKAGE] ?? pkg?.devDependencies?.[GRAMMAR_PACKAGE] ?? pkg?.peerDependencies?.[GRAMMAR_PACKAGE] ?? null;
}

/** A built grammar package root: its package.json plus dist/<family>/index.d.ts and .js. */
const builtGrammar = (root) => isFile(path.join(root, 'package.json')) && isFile(path.join(root, 'dist', 'core', 'index.d.ts')) && isFile(path.join(root, 'dist', 'core', 'index.js'));

/**
 * The main worktree of the git checkout `dir` lives in (a lane worktree's live runtime), or null: a lane checkout never
 * builds packages/grammar/dist (dist/ is untracked), so its drawings resolve the live runtime's build.
 */
function mainWorktreeOf(dir) {
  try {
    const r = revParseQuery(['--path-format=absolute', '--git-common-dir'], { dir, timeout: 10_000 });
    const common = r.status === 0 ? r.stdout.trim() : '';
    if (!common || path.basename(common) !== '.git') return null;
    const main = path.dirname(common);
    return path.resolve(main) === path.resolve(dir) ? null : main;
  } catch { return null; }
}

/**
 * The claude-dist roots, best first: --grammar-dist / STARCI_GRAMMAR_DIST when given (used as is), else the runtime's
 * packages/grammar when its build is FRESH (grammar-dist.mjs: stamped from the current source), else the live main
 * worktree's fresh build (a lane checkout), else the runtime's built but stale dist - named stale, never silently.
 */
export function claudeDistRoots({ skillRoot = SKILL_ROOT, grammarDist = null, env = process.env, status = grammarDistStatus, mainOf = mainWorktreeOf } = {}) {
  const pinned = grammarDist ?? env.STARCI_GRAMMAR_DIST ?? null;
  if (pinned) return [{ root: path.resolve(pinned), status: null, via: grammarDist ? '--grammar-dist' : 'STARCI_GRAMMAR_DIST' }];
  const own = path.join(skillRoot, 'packages', 'grammar');
  const main = mainOf(skillRoot);
  const tried = [{ root: own, via: 'runtime' }, ...(main ? [{ root: path.join(main, 'packages', 'grammar'), via: 'main-worktree' }] : [])]
    .filter((c) => builtGrammar(c.root)).map((c) => ({ ...c, status: status(c.root) }));
  const fresh = tried.filter((c) => c.status?.ok);
  return fresh.length ? [fresh[0]] : tried.slice(0, 1);
}

function grammarCandidates({ productDir, skillRoot = SKILL_ROOT, grammarDist = null, claudeRoots = null }) {
  const out = [];
  const installed = productDir ? findPackage([productDir], [GRAMMAR_PACKAGE]) : null;
  if (installed && builtGrammar(installed.root)) out.push({ source: 'product', root: installed.root, version: installed.version });
  for (const c of claudeRoots ?? claudeDistRoots({ skillRoot, grammarDist })) {
    if (!builtGrammar(c.root)) continue;
    out.push({ source: 'claude-dist', root: c.root, version: readJsonFile(path.join(c.root, 'package.json'))?.version ?? null, via: c.via,
      ...(c.status ? { dist: { state: c.status.state, ok: c.status.ok, detail: c.status.detail } } : {}) });
  }
  return out;
}

const parse = (v) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? '').trim()); return m ? m.slice(1, 4).map(Number) : null; };
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
/** Minimal semver range test: exact, ^, ~, >=, * (enough for a dependency line); null when unreadable. */
export function satisfiesRange(version, range) {
  const v = parse(version);
  if (!v || range == null) return null;
  const r = String(range).trim();
  if (r === '*' || r === 'latest' || r === '') return true;
  const m = /^(\^|~|>=|=)?\s*v?(\d+\.\d+\.\d+)/.exec(r);
  if (!m) return null;
  const base = parse(m[2]);
  if (cmp(v, base) < 0) return false;
  if (m[1] === '>=') return true;
  if (!m[1] || m[1] === '=') return cmp(v, base) === 0;
  if (m[1] === '~') return v[0] === base[0] && v[1] === base[1];
  // caret: the left-most non-zero part is fixed
  if (base[0] > 0) return v[0] === base[0];
  if (base[1] > 0) return v[0] === 0 && v[1] === base[1];
  return v[0] === 0 && v[1] === 0 && v[2] === base[2];
}

/**
 * Resolve the grammar a draw file renders against. `typecheck` is injectable (tests). Without `file` the first
 * candidate of the preference wins untested. Returns {ok, pick, grammarSource, productVersion, productRange,
 * upgradeOwed, attempts:[{source, version, root, ok, errors}], error?}.
 */
export function resolveDrawGrammar({ file = null, productDir, skillRoot = SKILL_ROOT, grammarDist = null, prefer = 'auto', typecheck = typecheckDraw, claudeRoots = null }) {
  if (!PREFERENCES.includes(prefer)) throw new Error(`--grammar must be one of ${PREFERENCES.join('|')}`);
  const all = grammarCandidates({ productDir, skillRoot, grammarDist, claudeRoots });
  const product = all.find((c) => c.source === 'product') ?? null;
  const productRange = productRangeOf(productDir);
  const candidates = prefer === 'auto' ? all : all.filter((c) => c.source === prefer);
  const attempts = [];
  let pick = null;
  for (const c of candidates) {
    if (!file) { pick = c; break; }
    const r = typecheck({ file, productDir, grammarRoot: c.root });
    attempts.push({ source: c.source, version: c.version, root: c.root, ok: r.ok, errors: r.errors.slice(0, 20), typescript: r.typescript ?? null, ...(c.dist ? { dist: c.dist } : {}) });
    if (r.ok) { pick = c; break; }
  }
  const upgradeOwed = pick?.source === 'claude-dist' ? { status: 'owed', package: GRAMMAR_PACKAGE, from: product?.version ?? null, to: pick.version, range: productRange,
    inRange: satisfiesRange(pick.version, productRange), why: product ? `the product's installed ${GRAMMAR_PACKAGE}@${product.version} does not satisfy the drawing (it fails to type-check); ${pick.version} does` : `the product has no built ${GRAMMAR_PACKAGE} install` } : null;
  return {
    ok: Boolean(pick), pick, grammarSource: pick ? `${pick.source}@${pick.version}` : null, productVersion: product?.version ?? null, productRange, upgradeOwed, attempts,
    ...(pick ? {} : { error: candidates.length ? `no grammar candidate type-checks the drawing (${candidates.map((c) => `${c.source}@${c.version}${c.dist && !c.dist.ok ? ` - its dist is ${c.dist.state}: ${c.dist.detail}; run npm run build in packages/grammar` : ''}`).join(', ')})` : `no built ${GRAMMAR_PACKAGE} (product install, ${path.join(skillRoot, 'packages', 'grammar', 'dist')} or the main worktree's; run npm run build in packages/grammar, or pass --grammar-dist)` }),
  };
}

/** The file a grammar subpath import resolves to inside a grammar root (package exports; `import` for JS). */
export function grammarEntry(root, subpath = '') {
  const pkg = readJsonFile(path.join(root, 'package.json'));
  const key = subpath ? `./${subpath.replace(/^\//, '')}` : '.';
  const mapped = pkg?.exports?.[key];
  const target = typeof mapped === 'string' ? mapped : mapped?.import ?? mapped?.default ?? mapped?.style ?? null;
  if (target) return path.join(root, target);
  if (!subpath) return path.join(root, 'dist', 'core', 'index.js');
  return path.join(root, subpath);
}

async function main(argv) {
  const val = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const productDir = val('--product');
  if (!productDir) { process.stderr.write('use: starci work draw-grammar --product <app dir> [--file <X.draw.tsx>] [--grammar auto|product|claude-dist] [--json]\n'); return 2; }
  const r = resolveDrawGrammar({ file: val('--file') ? path.resolve(val('--file')) : null, productDir: path.resolve(productDir), prefer: val('--grammar') ?? 'auto', grammarDist: val('--grammar-dist') });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  else process.stdout.write(`${r.ok ? `grammar ${r.grammarSource}` : `UNRESOLVED: ${r.error}`}${r.upgradeOwed ? `; product upgrade owed ${r.upgradeOwed.from} -> ${r.upgradeOwed.to} (range ${r.upgradeOwed.range}, in range ${r.upgradeOwed.inRange})` : ''}\n${r.attempts.map((a) => `  ${a.source}@${a.version}: ${a.ok ? 'type-checks' : `${a.errors.length} error(s): ${a.errors.slice(0, 3).map((e) => `${e.code} ${e.message}`).join(' | ')}`}`).join('\n')}\n`);
  return r.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (e) { process.stderr.write(`draw-grammar: ${e?.stack ?? e}\n`); process.exitCode = 2; }
}
