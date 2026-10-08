// land-specs.mjs - the land gate's `--specs direct` selection: the specs that can see the change, not every spec that
// merely mentions a changed file.
//
// Two selections live here. `direct` is the exact one; `touching` (the default) is `direct` plus a bounded smoke set.
//
// History: `touching` used to keep every spec whose text contains the last two path segments of a changed file (prose
// included) and every spec whose import graph reaches a changed file. For a hub module that is most of the suite: a change
// to scripts/reconciler/services.mjs, scripts/agent/trust.mjs or scripts/kernel/verbs/shared/check-evidence.mjs reaches 250-285
// of 696 specs through the graph alone, so a three-file fix ran 253-287 specs for 25-30 minutes (2026-10-07 audit, issue 3d).
//
// The `touching` rule (specsTouching): `direct`'s selection, the tree-wide invariant specs, the specs that read a changed file as data,
// and a smoke set - at most SMOKE_LIMIT of the specs that only reach the change through the import graph, one per spec directory per
// round with the directories named in a changed path first. The rest of the transitive set is the release run's (the full suite).
//
// `direct` keeps, per changed non-spec file:
//   1. the spec named after it (tests/<stem>.spec.mjs, tests/<stem>-*.spec.mjs) - always;
//   2. the specs that import or spawn it (a code line, never a comment) - when the file has at most HUB_IMPORTERS such
//      specs; for a hub, only the importers that also reference a changed file, or that name an export the change can
//      reach (changedExports: the top-level declarations the diff touches, closed over the declarations that use them);
//   3. the specs that spawn a CLI entry (scripts/kernel/cli.mjs, packages/cli/bin/starci.mjs) and name a verb whose handler reaches a changed file
//      through relative imports (land-cli-specs.mjs): they import nothing the change touched, and counted as graph-only specs they fell outside the
//      smoke bound while a change broke 13 of them;
//   4. every importer, whatever the size, when the change cannot be mapped to exports (an added, deleted or renamed file,
//      a non-JS file, a changed line outside every top-level declaration, an unreadable diff). Never fewer than
//      `touching` where the answer is not known; the report says which files were narrowed.
import path from 'node:path';
import { specsDependingOn, specsReadingData } from '../lib/spec-deps.mjs';
import { byCodeUnit } from '../../engine/by-code-unit.mjs';
import { cliSpecsOf } from './land-cli-specs.mjs';

const HUB_IMPORTERS = 40;
const DECL = /^(export\s+)?(default\s+)?(async\s+)?(function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;
const posix = (file) => String(file).replaceAll('\\', '/');
const stemOf = (file) => path.posix.basename(file).replace(/\.[^.]+$/, '');
const needleOf = (file) => file.split('/').slice(-2).join('/');

/** The text of a spec without comment-only lines: a mention in prose is not a use. */
export function codeOf(text) {
  let inBlock = false;
  return String(text ?? '').split(/\r?\n/).filter((line) => {
    const s = line.trim();
    if (inBlock) { if (s.includes('*/')) { inBlock = false; } return false; }
    if (s.startsWith('//')) return false;
    if (s.startsWith('/*')) { if (!s.includes('*/')) { inBlock = true; } return false; }
    return true;
  }).join('\n');
}

/** The top-level declarations of a JS module: [{name, exported, start, end, text}] (1-based inclusive lines). */
function topLevelBlocks(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  const heads = [];
  lines.forEach((line, i) => { const m = DECL.exec(line); if (m) heads.push({ name: m[5], exported: Boolean(m[1]), start: i + 1 }); });
  return heads.map((h, i) => { const end = i + 1 < heads.length ? heads[i + 1].start - 1 : lines.length; return { ...h, end, text: lines.slice(h.start - 1, end).join('\n') }; });
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const uses = (text, name) => new RegExp(String.raw`(^|[^\w$.])${escapeRe(name)}(?![\w$])`).test(text);
const hasIndirectExport = (source) => /^export\s+\*|^export\s+default\s+(?!(async\s+)?(function|class))/m.test(source);
const AS_KEYWORD = new RegExp([String.raw`\s+`, 'as', String.raw`\s+`].join(''));
const listedExports = (source) => new Set([...source.matchAll(/^export\s*\{([^}]*)\}(?!\s*from)/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(AS_KEYWORD)[0]).filter(Boolean)));

function changedBlocks(blocks, ranges) {
  const hit = new Set();
  for (const [start, count] of ranges) {
    const last = start + Math.max(count, 1) - 1;
    for (let line = start; line <= last; line += 1) {
      const block = blocks.find((entry) => line >= entry.start && line <= entry.end);
      if (!block) return { hit, why: `line ${line} is outside every top-level declaration` };
      hit.add(block.name);
    }
  }
  return { hit, why: null };
}

function closeChangedDependencies(blocks, hit) {
  let grew = true;
  while (grew) {
    grew = false;
    for (const block of blocks) {
      if (!hit.has(block.name) && [...hit].some((name) => name !== block.name && uses(block.text, name))) { hit.add(block.name); grew = true; }
    }
  }
}

function addNamedSpecs(file, specs, files) {
  const stem = stemOf(file);
  if (stem.length < 4) return;
  for (const spec of specs) {
    if (spec.file === `tests/${stem}.spec.mjs` || spec.file.startsWith(`tests/${stem}-`)) files.add(spec.file);
  }
}

function changedImporterSpecs(users, others, symbols, code) {
  return users.filter((spec) => others.some((needle) => code.get(spec).includes(needle)) || symbols.some((name) => uses(code.get(spec), name)));
}

function addImporterSpecs(file, { source, specs, symbolsOf, hub, code, files, narrowed }) {
  const needle = needleOf(file);
  const users = specs.filter((spec) => code.get(spec.file).includes(needle)).map((spec) => spec.file);
  if (users.length <= hub) {
    for (const spec of users) files.add(spec);
    return;
  }
  const result = symbolsOf(file);
  if (!result || !Array.isArray(result.symbols)) {
    for (const spec of users) files.add(spec);
    narrowed.push({ file, importers: users.length, kept: users.length, symbols: null, why: result?.why ?? 'not mapped' });
    return;
  }
  const others = source.filter((other) => other !== file).map(needleOf);
  const keep = changedImporterSpecs(users, others, result.symbols, code);
  for (const spec of keep) files.add(spec);
  narrowed.push({ file, importers: users.length, kept: keep.length, symbols: result.symbols });
}

/**
 * The exports a change can reach: the declarations holding a changed line of the head file, then every declaration that
 * uses one of them (transitively). `ranges` = [[startLine, count]] of the head side of the diff. Returns
 * {symbols:[exported names]} or {symbols:null, why} when the change cannot be mapped (the caller keeps every importer).
 */
export function changedExports({ source, ranges }) {
  const blocks = topLevelBlocks(source);
  if (!blocks.length) return { symbols: null, why: 'no top-level declarations' };
  if (hasIndirectExport(source)) return { symbols: null, why: 'indirect export form' };
  // `export { a, b as c }` (local names): a listed declaration is exported under its local name.
  const listed = listedExports(source);
  for (const b of blocks) if (listed.has(b.name)) b.exported = true;
  const changed = changedBlocks(blocks, ranges);
  if (changed.why) return { symbols: null, why: changed.why };
  const hit = changed.hit;
  if (!hit.size) return { symbols: null, why: 'no changed line on the head side' };
  closeChangedDependencies(blocks, hit);
  return { symbols: blocks.filter((b) => b.exported && hit.has(b.name)).map((b) => b.name) };
}

/**
 * The `direct` selection. specs = [{file, text}] (tests/*.spec.mjs); changed = repo paths; `symbolsOf(file)` returns the
 * changedExports result for a hub file (or null to keep every importer). Returns {files, narrowed:[{file, importers,
 * kept, symbols}]}.
 */
export function specsDirect(changed, { specs, symbolsOf = () => null, hub = HUB_IMPORTERS, root = null }) {
  const norm = changed.map((f) => String(f).replaceAll('\\', '/'));
  const own = norm.filter((f) => /^tests\/[^/]+\.spec\.mjs$/.test(f));
  const source = norm.filter((f) => !f.startsWith('tests/'));
  const code = new Map(specs.map((s) => [s.file, codeOf(s.text)]));
  const files = new Set(own), narrowed = [];
  for (const f of source) {
    addNamedSpecs(f, specs, files);
    addImporterSpecs(f, { source, specs, symbolsOf, hub, code, files, narrowed });
  }
  if (root) for (const spec of cliSpecsOf({ root, changed: norm, code })) files.add(spec);
  return { files: [...files], narrowed };
}

/** The head-side changed line ranges of `git diff -U0` output for one file: [[start, count]]. */
export function headRanges(diffText) {
  const out = [];
  for (const m of String(diffText ?? '').matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) out.push([Number(m[1]), m[2] === undefined ? 1 : Number(m[2])]);
  return out;
}

/** The roots a tree-wide invariant spec scans, as it declares them ONCE: `export const INVARIANT_ROOTS = ['scripts', ...]`. Such a spec never names the file it catches, so naming alone would skip it. */
export const invariantRootsOf = (text) => {
  const m = /^export const INVARIANT_ROOTS = \[([^\]]*)\]/m.exec(String(text ?? ''));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => posix(x[1])) : [];
};
/** Invariant specs (invariantRootsOf) scanning a root that holds a changed file. */
export const specsInvariant = (changed, { specs }) => {
  const files = changed.map(posix);
  return specs.filter(({ file, text }) => file && invariantRootsOf(text).some((r) => files.some((f) => f.startsWith(`${r}/`)))).map((s) => s.file);
};

export const SMOKE_LIMIT = 24;
const specAreaNamed = (spec, changed) => changed.some((file) => file.split('/').slice(0, -1).includes(path.posix.basename(path.posix.dirname(spec))));

/**
 * The smoke set: at most `limit` of `dependents` (specs reaching the change through the import graph) not already in `chosen`, spread
 * across spec directories - one per directory per round, directories named in a changed path first, each directory in name order.
 */
export function smokeSpecs({ dependents, chosen, changed, limit = SMOKE_LIMIT }) {
  const byDir = new Map();
  for (const spec of [...new Set(dependents)].filter((file) => !chosen.has(file)).sort(byCodeUnit)) {
    const dir = path.posix.dirname(spec);
    byDir.set(dir, [...(byDir.get(dir) ?? []), spec]);
  }
  const dirs = [...byDir.keys()].sort((a, b) => Number(specAreaNamed(byDir.get(b)[0], changed)) - Number(specAreaNamed(byDir.get(a)[0], changed)) || byCodeUnit(a, b));
  const out = [];
  for (let round = 0; out.length < limit && dirs.some((dir) => byDir.get(dir)[round]); round += 1) {
    for (const dir of dirs) if (out.length < limit && byDir.get(dir)[round]) out.push(byDir.get(dir)[round]);
  }
  return out;
}

/**
 * The `touching` selection: {files, narrowed, smoke}. `direct`'s files and hub narrowing, the invariant specs, the specs reading a
 * changed file as data, plus the smoke set of the specs that reach the change only through imports (needs `root`, the tree the specs live in).
 */
export function touchingSelection(changed, { specs, root = null, symbolsOf = () => null, smokeLimit = SMOKE_LIMIT }) {
  const files = changed.map(posix);
  const direct = specsDirect(files, { specs, symbolsOf, root });
  const names = specs.map((s) => s.file).filter(Boolean);
  const reading = root ? specsReadingData(root, files, names) : [];
  const chosen = new Set([...direct.files, ...specsInvariant(files, { specs }), ...reading]);
  const smoke = root ? smokeSpecs({ dependents: specsDependingOn(root, files, names), chosen, changed: files, limit: smokeLimit }) : [];
  return { files: [...chosen, ...smoke], narrowed: direct.narrowed, smoke };
}

/** The spec files the `touching` selection keeps (touchingSelection(...).files). */
export const specsTouching = (changed, options) => touchingSelection(changed, options).files;
