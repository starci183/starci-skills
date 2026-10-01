// land-specs.mjs - the land gate's `--specs direct` selection: the specs that can see the change, not every spec that
// merely mentions a changed file.
//
// `touching` (land.mjs specsTouching) keeps every spec whose text contains the last two path segments of a changed file,
// prose and comments included. For a hub module that is most of the suite: lane/token-meter changed engine/db/ledger.mjs,
// 113 specs import it, so `touching` ran 131 of 355 specs (2026-09-29, run 18, about an hour under load).
//
// `direct` keeps, per changed non-spec file:
//   1. the spec named after it (tests/<stem>.spec.mjs, tests/<stem>-*.spec.mjs) - always;
//   2. the specs that import or spawn it (a code line, never a comment) - when the file has at most HUB_IMPORTERS such
//      specs; for a hub, only the importers that also reference a changed file, or that name an export the change can
//      reach (changedExports: the top-level declarations the diff touches, closed over the declarations that use them);
//   3. every importer, whatever the size, when the change cannot be mapped to exports (an added, deleted or renamed file,
//      a non-JS file, a changed line outside every top-level declaration, an unreadable diff). Never fewer than
//      `touching` where the answer is not known; the report says which files were narrowed.
import path from 'node:path';

export const HUB_IMPORTERS = 40;
const DECL = /^(export\s+)?(default\s+)?(async\s+)?(function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;
const stemOf = (file) => path.posix.basename(file).replace(/\.[^.]+$/, '');
const needleOf = (file) => file.split('/').slice(-2).join('/');

/** The text of a spec without comment-only lines: a mention in prose is not a use. */
export function codeOf(text) {
  let inBlock = false;
  return String(text ?? '').split(/\r?\n/).filter((line) => {
    const s = line.trim();
    if (inBlock) { if (s.includes('*/')) inBlock = false; return false; }
    if (s.startsWith('//')) return false;
    if (s.startsWith('/*')) { if (!s.includes('*/')) inBlock = true; return false; }
    return true;
  }).join('\n');
}

/** The top-level declarations of a JS module: [{name, exported, start, end, text}] (1-based inclusive lines). */
export function topLevelBlocks(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  const heads = [];
  lines.forEach((line, i) => { const m = DECL.exec(line); if (m) heads.push({ name: m[5], exported: Boolean(m[1]), start: i + 1 }); });
  return heads.map((h, i) => { const end = i + 1 < heads.length ? heads[i + 1].start - 1 : lines.length; return { ...h, end, text: lines.slice(h.start - 1, end).join('\n') }; });
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const uses = (text, name) => new RegExp(`(^|[^\\w$.])${escapeRe(name)}(?![\\w$])`).test(text);

/**
 * The exports a change can reach: the declarations holding a changed line of the head file, then every declaration that
 * uses one of them (transitively). `ranges` = [[startLine, count]] of the head side of the diff. Returns
 * {symbols:[exported names]} or {symbols:null, why} when the change cannot be mapped (the caller keeps every importer).
 */
export function changedExports({ source, ranges }) {
  const blocks = topLevelBlocks(source);
  if (!blocks.length) return { symbols: null, why: 'no top-level declarations' };
  if (/^export\s+\*|^export\s+default\s+(?!(async\s+)?(function|class))/m.test(source)) return { symbols: null, why: 'indirect export form' };
  // `export { a, b as c }` (local names): a listed declaration is exported under its local name.
  const listed = new Set([...source.matchAll(/^export\s*\{([^}]*)\}(?!\s*from)/gm)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)));
  for (const b of blocks) if (listed.has(b.name)) b.exported = true;
  const hit = new Set();
  for (const [start, count] of ranges) {
    const last = start + Math.max(count, 1) - 1;
    for (let line = start; line <= last; line += 1) {
      const b = blocks.find((x) => line >= x.start && line <= x.end);
      if (!b) return { symbols: null, why: `line ${line} is outside every top-level declaration` };
      hit.add(b.name);
    }
  }
  if (!hit.size) return { symbols: null, why: 'no changed line on the head side' };
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of blocks) if (!hit.has(b.name) && [...hit].some((n) => n !== b.name && uses(b.text, n))) { hit.add(b.name); grew = true; }
  }
  return { symbols: blocks.filter((b) => b.exported && hit.has(b.name)).map((b) => b.name) };
}

/**
 * The `direct` selection. specs = [{file, text}] (tests/*.spec.mjs); changed = repo paths; `symbolsOf(file)` returns the
 * changedExports result for a hub file (or null to keep every importer). Returns {files, narrowed:[{file, importers,
 * kept, symbols}]}.
 */
export function specsDirect(changed, { specs, symbolsOf = () => null, hub = HUB_IMPORTERS }) {
  const norm = changed.map((f) => String(f).replace(/\\/g, '/'));
  const own = norm.filter((f) => /^tests\/[^/]+\.spec\.mjs$/.test(f));
  const source = norm.filter((f) => !f.startsWith('tests/'));
  const code = new Map(specs.map((s) => [s.file, codeOf(s.text)]));
  const files = new Set(own), narrowed = [];
  const named = (f) => { const stem = stemOf(f); return stem.length < 4 ? [] : specs.filter((s) => s.file === `tests/${stem}.spec.mjs` || s.file.startsWith(`tests/${stem}-`)).map((s) => s.file); };
  for (const f of source) {
    for (const s of named(f)) files.add(s);
    const needle = needleOf(f);
    const users = specs.filter((s) => code.get(s.file).includes(needle)).map((s) => s.file);
    if (users.length <= hub) { for (const s of users) files.add(s); continue; }
    const r = symbolsOf(f);
    if (!r || !Array.isArray(r.symbols)) { for (const s of users) files.add(s); narrowed.push({ file: f, importers: users.length, kept: users.length, symbols: null, why: r?.why ?? 'not mapped' }); continue; }
    const others = source.filter((g) => g !== f).map(needleOf);
    const keep = users.filter((s) => others.some((n) => code.get(s).includes(n)) || r.symbols.some((name) => uses(code.get(s), name)));
    for (const s of keep) files.add(s);
    narrowed.push({ file: f, importers: users.length, kept: keep.length, symbols: r.symbols });
  }
  return { files: [...files], narrowed };
}

/** The head-side changed line ranges of `git diff -U0` output for one file: [[start, count]]. */
export function headRanges(diffText) {
  const out = [];
  for (const m of String(diffText ?? '').matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) out.push([Number(m[1]), m[2] === undefined ? 1 : Number(m[2])]);
  return out;
}
