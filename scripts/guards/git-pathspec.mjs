// git-pathspec.mjs — the git argv and pathspec machinery of the shared-checkout policy
// (git-policy.mjs): splitting `git [global options] <sub> <args...>`, reading pathspecs
// (including --pathspec-from-file lists) the way git does, and the literal reading of App
// Router segments (engine/admission.mjs isAppRouterSegment). Pure: argv and text in, parts out.
import fs from 'node:fs';
import path from 'node:path';
import { isAppRouterSegment } from '../../engine/admission.mjs';
import { pathKey } from '../lib/path-key.mjs';

// git's global options that consume the next argument.
const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix', '--config-env', '--attr-source']);

// The global options of `git [global options] <sub>`: -C dirs are applied to cwd
// in order, like git does; -c/--config-env collect their <name>=<value>.
const scanGlobalArgs = (args, dir) => {
  const config = [];
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '-C' && i + 1 < args.length) { dir = path.resolve(dir, args[i + 1]); i += 2; continue; }
    // --config-env <name>=<envvar>: the key is what matters, whatever the variable holds.
    if ((a === '-c' || a === '--config-env') && i + 1 < args.length) { config.push(args[i + 1]); i += 2; continue; }
    if (a.startsWith('--config-env=')) { config.push(a.slice('--config-env='.length)); i += 1; continue; }
    if (GLOBAL_WITH_VALUE.has(a) && i + 1 < args.length) { i += 2; continue; }
    if (a.startsWith('-')) { i += 1; continue; }
    break;
  }
  return { dir, config, i };
};

// Split `git [global options] <sub> <args...>` into its parts; -C dirs are
// applied to cwd in order, like git does.
export function parseGitArgv(argv, cwd = process.cwd()) {
  const args = [...argv].map(String);
  const { dir, config, i } = scanGlobalArgs(args, cwd);
  return { cwd: dir, config, sub: args[i] ?? null, rest: args.slice(i + 1) };
}

const norm = pathKey;
// git's glob characters. A Next.js App Router segment (`[locale]`, `[...slug]`, `[[...opt]]`, `(.)[id]`)
// carries `[` but is a literal directory name - the reading owned-path admission gives it
// (engine/admission.mjs isAppRouterSegment, ownedPathspec). Cutting every pathspec at its first `[`
// scoped `src/app/[locale]/x` to `src/app/`, outside the grant `src/app/[locale]`, and refused the op's
// own paths PATH_NOT_OWNED. Git, though, still reads a plain `[...slug]` as a
// character class (`src/app/[...slug]/page.tsx` also matches a peer's `src/app/l/page.tsx`), so a pathspec
// the guard reads literally must reach git literally too: the command guard (command-guard.mjs) refuses a
// command whose glob reading reaches a path the literal reading does not, naming the literalAppRouterArgv form. A pathspec that also carries a real glob, or `:(glob)` magic, keeps git's glob
// reading and is scoped from before its first glob character, App Router segment or not.
const GIT_GLOB = /[*?[]/;
const PATHSPEC_MAGIC = /^:(\([^)]*\)|[/!^]*)/;
const segmentsOf = (s) => s.split(/[/\\]/);
// {names, long, rest}: the magic words of a pathspec (short `:/`, `:!`, `:^` spelled as top/exclude) and its path.
function pathspecMagic(spec) {
  const s = String(spec);
  const magic = PATHSPEC_MAGIC.exec(s);
  if (!magic) return { names: [], long: null, rest: s };
  const m = magic[1];
  const names = m.startsWith('(')
    ? m.slice(1, -1).split(',').map((w) => w.trim().split(':')[0]).filter(Boolean)
    : [...new Set([...m].map((c) => (c === '/' ? 'top' : 'exclude')))];
  return { names, long: m.startsWith('(') ? m.slice(1, -1) : null, rest: s.slice(magic[0].length) };
}
// Whether git reads this pathspec path as a glob that the literal reading would not give.
const readsAsGlob = (rest, names) => segmentsOf(rest).some((seg) => GIT_GLOB.test(seg) && (names.includes('glob') || !isAppRouterSegment(seg)));
/**
 * The pathspec git must be given for the guard's literal reading to hold: one whose App Router segments are
 * its only glob characters gains `literal` magic (`src/app/[locale]/x` -> `:(literal)src/app/[locale]/x`,
 * `:/src/app/[id]` -> `:(top,literal)src/app/[id]`); every other pathspec is returned unchanged.
 */
export function literalPathspec(spec) {
  const s = String(spec);
  const { names, long, rest } = pathspecMagic(s);
  if (names.includes('literal') || names.includes('glob') || readsAsGlob(rest, names)) return s;
  if (!segmentsOf(rest).some(isAppRouterSegment)) return s;
  if (!s.startsWith(':')) return `:(literal)${s}`;
  return `:(${[...(long != null ? [long] : names), 'literal'].filter(Boolean).join(',')})${rest}`;
}
// The literal directory a pathspec names: magic prefixes stripped, the segments
// before the first glob segment kept. `:/` and `:(top)` name the root.
const pathspecBase = (spec, cwd, top) => {
  const { names, rest } = pathspecMagic(spec);
  let s = rest;
  const base = names.includes('top') ? top ?? cwd : cwd;
  if (names.includes('exclude')) return null; // an exclusion narrows, never widens
  // :(literal)src/app/[id] names exactly that path; so does src/app/[id], whose glob reading the command guard checks
  if (!names.includes('literal') && readsAsGlob(rest, names)) {
    const segments = segmentsOf(s);
    s = segments.slice(0, segments.findIndex((seg) => GIT_GLOB.test(seg))).join('/');
  }
  return path.resolve(base, s || '.');
};

/** True when every pathspec names a place inside one owned path (absolute owned roots). */
export function pathspecsWithinOwned(specs, { cwd, owned, top = null }) {
  if (!Array.isArray(owned) || !owned.length) return { ok: false, outside: [...specs] };
  const roots = owned.map((p) => norm(p));
  const outside = [];
  for (const spec of specs) {
    const base = pathspecBase(spec, cwd, top);
    if (base === null) continue;
    const n = norm(base);
    if (!roots.some((r) => n === r || n.startsWith(`${r}/`))) outside.push(spec);
  }
  return { ok: outside.length === 0, outside };
}

// --pathspec-from-file=<file> (or <file> as the next word; `-` is stdin) with --pathspec-file-nul:
// the pathspecs of add, commit, reset, restore, checkout and rm live in a file (inc-d1833bc89c1f). The
// guard reads the list the way git does and scopes every entry exactly like an explicit pathspec.
export const PATHSPEC_FILE = '--pathspec-from-file';
export const PATHSPEC_FILE_SUBS = new Set(['add', 'commit', 'reset', 'restore', 'checkout', 'rm', 'stash']);
export function takePathspecFile(rest) {
  const out = [];
  let file = null, nul = false;
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--') { out.push(...rest.slice(i)); break; }
    if (a === PATHSPEC_FILE && i + 1 < rest.length) { file = rest[i + 1]; i += 1; continue; }
    if (a.startsWith(`${PATHSPEC_FILE}=`)) { file = a.slice(PATHSPEC_FILE.length + 1); continue; }
    if (a === '--pathspec-file-nul') { nul = true; continue; }
    out.push(a);
  }
  return { rest: out, file, nul };
}
// git's C-style quoting of a pathspec line (core.quotePath); null when badly quoted.
const C_ESCAPES = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, '\\': 92, '"': 34 };
function unquoteC(line) {
  if (!line.startsWith('"')) return line;
  const bytes = [];
  for (let i = 1; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') return i === line.length - 1 ? Buffer.from(bytes).toString('utf8') : null;
    if (c !== '\\') { bytes.push(...Buffer.from(c, 'utf8')); continue; }
    const n = line[i + 1];
    if (n in C_ESCAPES) { bytes.push(C_ESCAPES[n]); i += 1; continue; }
    const oct = line.slice(i + 1, i + 4);
    if (/^[0-3][0-7]{2}$/.test(oct)) { bytes.push(Number.parseInt(oct, 8)); i += 3; continue; }
    return null;
  }
  return null;
}
/** The pathspecs of a --pathspec-from-file list, split like git's parse_pathspec_file. */
export function parsePathspecList(text, nul = false) {
  const items = String(text ?? '').split(nul ? '\0' : '\n');
  if (items.length && items.at(-1) === '') items.pop();
  if (nul) return items;
  // A badly quoted line stays raw: it names no owned path, so it is refused (git itself dies on it).
  return items.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l)).map((l) => unquoteC(l) ?? l);
}
// The file resolves against the command's directory (git's OPT_FILENAME); `-` is stdin (ctx.stdin), which the
// command guard never sees before the command runs, so a stdin list is refused with the list-file remedy.
export const readPathspecFile = (file, dir, stdin) => {
  if (file === '-') return stdin == null ? null : String(stdin);
  try { return fs.readFileSync(path.resolve(dir, file), 'utf8'); } catch { return null; }
};

// The pathspec positions of the path-scoped subcommands: everything after `--` and a pathspec list; before
// `--`, the words of the commands whose words are pathspecs (reset and checkout words are revisions),
// skipping the values of their options.
const LITERAL_SUBS = new Set(['add', 'commit', 'reset', 'restore', 'checkout', 'rm', 'clean']);
const WORD_PATHSPEC_SUBS = new Set(['add', 'commit', 'restore', 'rm', 'clean']);
const SUB_VALUE_OPTIONS = { restore: new Set(['-s', '--source']), clean: new Set(['-e', '--exclude']) };
// `git commit -m msg path`: the word after -m/-F/-C/-c/--author... is a value, not a pathspec.
export const VALUE_OPTIONS = new Set(['-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message', '--author', '--date', '-t', '--template', '--cleanup', '--fixup', '--squash', '--trailer', '-S', '--gpg-sign']);

const LIST = Symbol('pathspec list');
// One rest token of literalAppRouterArgv: pathspecs are literal-ized, option values skipped, and the
// --pathspec-from-file markers kept as LIST placeholders for the rewritten list file. Returns how many
// extra tokens the token consumed (an option value or the list file name).
const takeLiteralArg = (st, a, i, rest) => {
  if (st.dashDash) { st.out.push(st.lit(a)); return 0; }
  if (a === '--') { st.dashDash = true; st.out.push(a); return 0; }
  if (a === PATHSPEC_FILE && i + 1 < rest.length) { st.file = rest[i + 1]; st.out.push({ [LIST]: [a, rest[i + 1]] }); return 1; }
  if (a.startsWith(`${PATHSPEC_FILE}=`)) { st.file = a.slice(PATHSPEC_FILE.length + 1); st.out.push({ [LIST]: [a] }); return 0; }
  if (a === '--pathspec-file-nul') { st.nul = true; st.out.push({ [LIST]: [a] }); return 0; }
  if (a.startsWith('-')) {
    st.out.push(a);
    if (st.values.has(a) && i + 1 < rest.length) { st.out.push(rest[i + 1]); return 1; }
    return 0;
  }
  st.out.push(WORD_PATHSPEC_SUBS.has(st.sub) ? st.lit(a) : a);
  return 0;
};
/**
 * literalAppRouterArgv(argv, {cwd, stdin, listFile}) -> {argv, list, changed}: the argv with which git reads every
 * pathspec the way the guard scoped it (literalPathspec on each pathspec position). A --pathspec-from-file list
 * with such a pathspec comes back as `list` (NUL-separated text) for the caller to write to `listFile`, which the argv then names with --pathspec-file-nul. Anything else passes
 * byte for byte.
 */
export function literalAppRouterArgv(argv, { cwd = process.cwd(), stdin = null, listFile = null } = {}) {
  const args = [...argv].map(String);
  const { cwd: dir, sub, rest } = parseGitArgv(args, cwd);
  if (!LITERAL_SUBS.has(sub)) return { argv: args, list: null, changed: false };
  const head = args.slice(0, args.length - rest.length);
  const values = sub === 'commit' ? VALUE_OPTIONS : SUB_VALUE_OPTIONS[sub] ?? new Set();
  let changed = false;
  const lit = (a) => { const l = literalPathspec(a); if (l !== a) { changed = true; } return l; };
  const st = { out: [], file: null, nul: false, dashDash: false, values, sub, lit };
  for (let i = 0; i < rest.length; i += 1) i += takeLiteralArg(st, rest[i], i, rest);
  let list = null;
  if (st.file != null && listFile && PATHSPEC_FILE_SUBS.has(sub)) {
    const text = readPathspecFile(st.file, dir, stdin);
    const specs = text == null ? [] : parsePathspecList(text, st.nul);
    const literal = specs.map(literalPathspec);
    if (literal.some((l, k) => l !== specs[k])) { list = literal.map((l) => `${l}\0`).join(''); changed = true; }
  }
  let named = false;
  const flat = st.out.flatMap((a) => {
    if (typeof a === 'string') return [a];
    if (list == null) return a[LIST];
    if (named) return [];
    named = true;
    return [`${PATHSPEC_FILE}=${listFile}`, '--pathspec-file-nul'];
  });
  return { argv: [...head, ...flat], list, changed };
}

// `--pathspec-from-file=-` (or `--pathspec-from-file -`) before a bare `--`: the list is on stdin.
export function pathspecListOnStdin(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--') return false;
    if (args[i] === '--pathspec-from-file=-' || (args[i] === '--pathspec-from-file' && args[i + 1] === '-')) return true;
  }
  return false;
}
