// import-scan.mjs — which files import a path, and which imports resolve to nothing (DESIGN §16.7, FMEA #20).
//
// fe-canon 2026-09-28: slice 1 moved apps/app/src/i18n/request.ts to modules/i18n and 26 files still imported the
// old `@/i18n` paths; the breakage surfaced as another slice's checker being "unavailable". Two questions answer it:
//   importersOf(root, moved)   every tracked source file whose import specifier resolves to a moved path - the
//                              owned paths of the wave's ONE repoint (canon-wire) unit (cut-seam.mjs canonCutPlanOf);
//   brokenImports(root)        every relative or tsconfig-alias specifier that resolves to no file - the
//                              IMPORTS_BROKEN_AFTER_MOVE invariant over the workflow worktree
//                              (scripts/kernel/status/imports.mjs).
// Files are the repository's tracked sources (`git ls-files`, so sibling worktrees under .starciwork/worktrees and
// node_modules never count). Specifiers: static import/export ... from, side-effect import, dynamic import(),
// require(), vi.mock()/jest.mock(). Aliases: every tsconfig*.json's compilerOptions.paths (+ baseUrl) applies to the
// files under that tsconfig's directory; `extends` is followed for paths. Bare package specifiers are external and
// never broken here (the package manager owns them). Pure reads; no writes.
import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../api/git/ls-files.mjs';
import { isWorktreesPath } from '../lib/worktree-exclude.mjs';
import { byCodeUnit } from '../lib/list.mjs';

export const SOURCE_EXT = Object.freeze(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const RESOLVE_EXT = [...SOURCE_EXT, '.d.ts', '.json'];
const posix = (p) => String(p).replace(/\\/g, '/');
const SPEC_RE = [
  /\bimport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\b(?:vi|jest)\.(?:mock|doMock|importActual|requireActual)\s*\(\s*['"]([^'"]+)['"]/g,
];

/** Strip // and /* *\/ comments from JSON-with-comments, strings kept intact, then trailing commas. */
function parseJsonc(text) {
  let out = '', i = 0, inStr = false;
  const s = String(text ?? '');
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (inStr) { out += c; if (c === '\\') { out += n ?? ''; i += 2; continue; } if (c === '"') inStr = false; i += 1; continue; }
    if (c === '"') { inStr = true; out += c; i += 1; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i += 1; i += 2; continue; }
    out += c; i += 1;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/** Every import specifier in a source text, in order, deduped. */
export function specifiersOf(text) {
  const src = String(text ?? '');
  const found = new Set();
  for (const re of SPEC_RE) { re.lastIndex = 0; let m; while ((m = re.exec(src))) found.add(m[1]); }
  return [...found];
}

/** {ok, files, error}: every path the index of the repository at `dir` tracks (-z keeps any file name), or why git could not list them. */
const trackedList = (dir) => {
  const r = lsFiles(['-z', '--cached'], { dir, maxBuffer: 256 * 1024 * 1024 });
  const ok = !r.error && r.status === 0;
  return { ok, files: ok ? String(r.stdout).split('\0').filter(Boolean) : [], error: ok ? null : String(r.stderr ?? r.error?.message ?? '').trim() };
};

/** Tracked source files of `root` (posix, relative), never under the worktrees dir or node_modules. */
function trackedSources(root, { list = trackedList } = {}) {
  const r = list(root);
  if (!r.ok) throw Object.assign(Error(`git ls-files failed in ${root}: ${String(r.error ?? '').slice(0, 200)}`), { code: 'IMPORT_SCAN_UNAVAILABLE' });
  return r.files.map(posix)
    .filter((f) => !isWorktreesPath(f) && !f.includes('node_modules/') && SOURCE_EXT.some((e) => f.endsWith(e)) && !f.endsWith('.d.ts'));
}

/** tsconfig alias scopes: [{dir, baseUrl, paths: [{pattern, targets}]}] deepest dir first. */
function aliasScopes(root) {
  const scopes = [];
  for (const rel of listTsconfigs(root)) {
    const resolved = tsconfigPaths(root, rel, new Set());
    if (!resolved?.paths) continue;
    const dir = posix(path.dirname(rel)) === '.' ? '' : posix(path.dirname(rel));
    scopes.push({ dir, baseUrl: resolved.baseUrl, paths: Object.entries(resolved.paths).map(([pattern, targets]) => ({ pattern, targets: Array.isArray(targets) ? targets : [] })) });
  }
  return scopes.sort((a, b) => b.dir.length - a.dir.length);
}

function listTsconfigs(root, { maxDepth = 4 } = {}) {
  const out = [];
  const visit = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (depth >= maxDepth || e.name === 'node_modules' || e.name.startsWith('.') || isWorktreesPath(rel)) continue;
        visit(rel, depth + 1);
      } else if (e.isFile() && /^tsconfig(?:\.[\w-]+)?\.json$/.test(e.name)) out.push(rel);
    }
  };
  visit('', 0);
  return out;
}

/** {baseUrl (posix, relative to root), paths} of one tsconfig, `extends` followed (relative extends only). */
function tsconfigPaths(root, rel, seen) {
  if (seen.has(rel)) return null;
  seen.add(rel);
  let doc;
  try { doc = parseJsonc(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; }
  const dir = path.dirname(rel);
  let inherited = null;
  for (const ext of [doc?.extends].flat().filter((e) => typeof e === 'string' && e.startsWith('.'))) {
    const target = posix(path.join(dir, ext.endsWith('.json') ? ext : `${ext}.json`));
    inherited = tsconfigPaths(root, target, seen) ?? inherited;
  }
  const co = doc?.compilerOptions ?? {};
  const baseUrl = co.baseUrl != null ? posix(path.join(dir, co.baseUrl)) : (co.paths ? posix(dir) : inherited?.baseUrl ?? null);
  const paths = co.paths ?? inherited?.paths ?? null;
  return paths ? { baseUrl: baseUrl === '.' ? '' : baseUrl, paths } : null;
}

const within = (file, dir) => !dir || file === dir || file.startsWith(`${dir}/`);

/**
 * Resolve one specifier from `fromFile` (posix, relative to root): {kind: 'external'} | {kind: 'file', file} |
 * {kind: 'broken', candidates}. `exists(rel)` answers whether a repository-relative path is a file (and `isDir`).
 */
function resolveSpecifier(fromFile, spec, { scopes, exists, isDir }) {
  const bases = [];
  if (spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..') {
    bases.push(posix(path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec))));
  } else {
    const scope = scopes.find((s) => within(fromFile, s.dir) && s.paths.some((p) => matchAlias(p.pattern, spec) != null));
    if (!scope) return { kind: 'external' };
    const alias = scope.paths.find((p) => matchAlias(p.pattern, spec) != null);
    const star = matchAlias(alias.pattern, spec);
    for (const t of alias.targets) bases.push(posix(path.posix.normalize(path.posix.join(scope.baseUrl ?? scope.dir, t.replace('*', star)))));
  }
  const candidates = [];
  for (const base of bases) {
    const b = base.replace(/^\.\//, '');
    for (const c of [b, ...RESOLVE_EXT.map((e) => `${b}${e}`), ...RESOLVE_EXT.map((e) => `${b}/index${e}`)]) {
      candidates.push(c);
      if (exists(c)) return { kind: 'file', file: c };
    }
    // `./foo.js` written for a TS source (NodeNext style): the .ts sibling.
    const m = /^(.*)\.(?:m|c)?js$/.exec(b);
    if (m) for (const e of ['.ts', '.tsx', '.mts', '.cts']) if (exists(`${m[1]}${e}`)) return { kind: 'file', file: `${m[1]}${e}` };
    if (isDir(b)) candidates.push(`${b}/`);
  }
  return { kind: 'broken', candidates: candidates.slice(0, 6) };
}

/** The `*` capture of a tsconfig paths pattern against a specifier, '' for an exact pattern, null for no match. */
export function matchAlias(pattern, spec) {
  const star = pattern.indexOf('*');
  if (star < 0) return pattern === spec ? '' : null;
  const pre = pattern.slice(0, star), post = pattern.slice(star + 1);
  return spec.length >= pre.length + post.length && spec.startsWith(pre) && spec.endsWith(post) ? spec.slice(pre.length, spec.length - post.length) : null;
}

/**
 * One pass over a repository working tree: {files, edges: [{from, spec, kind, file?}]}. `only` limits the files
 * READ (their imports) to that set; resolution still sees every file on disk. `readFile(rel)` is a seam.
 */
function scanImports(root, { only = null, list = trackedList, readFile = null } = {}) {
  const files = trackedSources(root, { list });
  const onDisk = (rel) => { try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; } };
  const isDir = (rel) => { try { return fs.statSync(path.join(root, rel)).isDirectory(); } catch { return false; } };
  const scopes = aliasScopes(root);
  const read = readFile ?? ((rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; } });
  const want = only ? new Set([...only].map(posix)) : null;
  const edges = [];
  for (const from of files) {
    if (want && !want.has(from)) continue;
    if (!onDisk(from)) continue;
    const text = read(from);
    if (text == null) continue;
    for (const spec of specifiersOf(text)) {
      const r = resolveSpecifier(from, spec, { scopes, exists: onDisk, isDir });
      if (r.kind !== 'external') edges.push({ from, spec, kind: r.kind, ...(r.file ? { file: r.file } : {}) });
    }
  }
  return { files, edges };
}

/**
 * Every tracked file importing any of `moved` (files or directories, posix relative), resolved against `root`
 * as it is NOW (before the move lands: the importers still resolve to the old location). Sorted, deduped,
 * the moved paths themselves excluded.
 */
export function importersOf(root, moved, opts = {}) {
  const targets = [...new Set(moved.map((p) => posix(p).replace(/\/\*\*$/, '').replace(/\/+$/, '')).filter(Boolean))];
  if (!targets.length) return [];
  const hit = (file) => targets.some((t) => within(file, t) || file.replace(/\.[^./]+$/, '') === t);
  const { edges } = scanImports(root, opts);
  return [...new Set(edges.filter((e) => e.kind === 'file' && hit(e.file) && !hit(e.from)).map((e) => e.from))].sort(byCodeUnit);
}

/** Every broken relative/alias import: [{from, spec}] (capped by `limit`), plus the total. */
export function brokenImports(root, { only = null, limit = 200, ...opts } = {}) {
  const { edges } = scanImports(root, { only, ...opts });
  const broken = edges.filter((e) => e.kind === 'broken').map((e) => ({ from: e.from, spec: e.spec }));
  return { count: broken.length, files: new Set(broken.map((b) => b.from)).size, broken: broken.slice(0, limit) };
}
