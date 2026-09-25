// git-policy.mjs — which git commands an op worker may run in a checkout it
// shares with other workflows. Pure: argv in, verdict out; scripts/guards/shim.mjs
// applies it in front of the real git, scripts/guards/history-hook.mjs backs it
// with a reference-transaction hook git itself runs.
//
// Several workflows of one product ledger build in ONE checkout on ONE branch
// (nivo: Login, workspace provision, modules and collab on nivo-backend main).
// Their workers damaged each other with commands that are harmless alone:
//  - a Collab worker ran `git reset --soft HEAD~1` over a peer's landed commit
//    and re-committed it under its own message (nivo inc-40fed684fff8,
//    inc-cb721b99fdd1);
//  - a commit swept a foreign file a hook had re-staged (inc-5d7ce049e810);
//  - `git stash`, `git clean -fd`, `git checkout -- <path>` and `git restore`
//    discard every peer's uncommitted work under the paths they name.
// The rule (modules/ops/_common.yaml "Evidence, completion and commits",
// modules/kernel/api.yaml conventions.sharedCheckout): the shared branch is
// append-only, a worker discards and stages only its own paths, and a commit
// names its owned paths explicitly. A wrong commit is undone with `git revert`.
import fs from 'node:fs';
import path from 'node:path';
import { isAppRouterSegment } from '../../engine/admission.mjs';

// git's global options that consume the next argument.
const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix', '--config-env', '--attr-source']);
const CONFIG_BYPASS = /^core\.hookspath=/i;
const HARNESS_HOOKS_OFF = /^core\.hookspath=(nul|\/dev\/null)$/i;
// Commands that run repository hooks: switching hooks off for them skips the guard and the secrets hooks.
const HOOKED_WRITES = new Set(['commit', 'merge', 'push', 'am', 'rebase', 'cherry-pick', 'revert', 'pull', 'checkout', 'switch', 'reset', 'update-ref', 'branch', 'stash']);
const PRIVATE_INDEX_SAFE = new Set(['add', 'rm', 'read-tree', 'write-tree', 'update-index', 'ls-files', 'diff']);

const refusal = (code, reason, remedy) => ({ allow: false, code, reason, remedy });
const ALLOW = Object.freeze({ allow: true });

// Split `git [global options] <sub> <args...>` into its parts; -C dirs are
// applied to cwd in order, like git does.
export function parseGitArgv(argv, cwd = process.cwd()) {
  const args = [...argv].map(String);
  let dir = cwd, i = 0;
  const config = [];
  while (i < args.length) {
    const a = args[i];
    if (a === '-C' && i + 1 < args.length) { dir = path.resolve(dir, args[i + 1]); i += 2; continue; }
    if (a === '-c' && i + 1 < args.length) { config.push(args[i + 1]); i += 2; continue; }
    if (a.startsWith('--config-env=')) { i += 1; continue; }
    if (GLOBAL_WITH_VALUE.has(a) && i + 1 < args.length) { i += 2; continue; }
    if (a.startsWith('-')) { i += 1; continue; }
    break;
  }
  return { cwd: dir, config, sub: args[i] ?? null, rest: args.slice(i + 1) };
}

// Options and pathspecs of a subcommand. Everything after a bare `--` is a
// pathspec; before it, non-option words are revisions or pathspecs (git
// itself disambiguates; the policy treats them as both where it matters).
const splitRest = (rest) => {
  const dd = rest.indexOf('--');
  const before = dd === -1 ? rest : rest.slice(0, dd);
  const after = dd === -1 ? [] : rest.slice(dd + 1);
  return {
    dashDash: dd !== -1,
    options: before.filter((a) => a.startsWith('-')),
    words: before.filter((a) => !a.startsWith('-')),
    paths: after,
  };
};
const has = (options, ...names) => options.some((o) => names.some((n) => o === n || o.startsWith(`${n}=`)));
// A combined short-flag cluster (-fd, -fdx) carries every letter it names.
const hasShort = (options, letter) => options.some((o) => /^-[A-Za-z]+$/.test(o) && o.slice(1).includes(letter));

const norm = (p) => {
  const n = path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};
// git's glob characters. A Next.js App Router segment (`[locale]`, `[...slug]`, `[[...opt]]`, `(.)[id]`)
// carries `[` but is a literal directory name - the reading owned-path admission gives it
// (engine/admission.mjs isAppRouterSegment, ownedPathspec). Cutting every pathspec at its first `[`
// scoped `src/app/[locale]/x` to `src/app/`, outside the grant `src/app/[locale]`, and refused the op's
// own paths PATH_NOT_OWNED (nivo-fe inc-21f76abb6d10). Git, though, still reads a plain `[...slug]` as a
// character class (`src/app/[...slug]/page.tsx` also matches a peer's `src/app/l/page.tsx`), so a pathspec
// the guard reads literally is handed to git literally too: literalPathspec, applied by the shim through
// literalAppRouterArgv. A pathspec that also carries a real glob, or `:(glob)` magic, keeps git's glob
// reading and is scoped from before its first glob character, App Router segment or not.
const GIT_GLOB = /[*?[]/;
const PATHSPEC_MAGIC = /^:(\([^)]*\)|[/!^]*)/;
const segmentsOf = (s) => s.split(/[/\\]/);
// {names, long, rest}: the magic words of a pathspec (short `:/`, `:!`, `:^` spelled as top/exclude) and its path.
function pathspecMagic(spec) {
  const s = String(spec);
  const magic = s.match(PATHSPEC_MAGIC);
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
  // :(literal)src/app/[id] names exactly that path; so does src/app/[id], which the shim hands git as :(literal)
  if (!names.includes('literal') && readsAsGlob(rest, names)) {
    const segments = segmentsOf(s);
    s = segments.slice(0, segments.findIndex((seg) => GIT_GLOB.test(seg))).join('/');
  }
  return path.resolve(base, s || '.');
};

/** True when every pathspec names a place inside one owned path (absolute owned roots). */
export function pathspecsWithinOwned(specs, { cwd, owned, top = null }) {
  if (!Array.isArray(owned) || !owned.length) return { ok: false, outside: [...specs] };
  const roots = owned.map(norm);
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
// the pathspecs of add, commit, reset, restore, checkout and rm live in a file. The commit-only
// (Work debt) packet commits a long owned list this way (nivo inc-d1833bc89c1f: the guard refused
// every `git commit --pathspec-from-file`, so the batched repair could never commit). The guard
// reads the list the way git does and scopes every entry exactly like an explicit pathspec.
const PATHSPEC_FILE = '--pathspec-from-file';
const PATHSPEC_FILE_SUBS = new Set(['add', 'commit', 'reset', 'restore', 'checkout', 'rm', 'stash']);
function takePathspecFile(rest) {
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
    if (/^[0-3][0-7]{2}$/.test(oct)) { bytes.push(parseInt(oct, 8)); i += 3; continue; }
    return null;
  }
  return null;
}
/** The pathspecs of a --pathspec-from-file list, split like git's parse_pathspec_file. */
export function parsePathspecList(text, nul = false) {
  const items = String(text ?? '').split(nul ? '\0' : '\n');
  if (items.length && items[items.length - 1] === '') items.pop();
  if (nul) return items;
  // A badly quoted line stays raw: it names no owned path, so it is refused (git itself dies on it).
  return items.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l)).map((l) => unquoteC(l) ?? l);
}
/** The commands the commit-only packet (scripts/kernel/api.mjs) gives for a long owned list; tests/shared-checkout-guard.spec.mjs proves this policy passes them. */
export const PATHSPEC_LIST_COMMIT = Object.freeze([`git add ${PATHSPEC_FILE}=<list>`, `git commit -m "<msg>" ${PATHSPEC_FILE}=<list>`]);
// The file resolves against the command's directory (git's OPT_FILENAME); `-` is the stdin the
// shim read and hands on to git (ctx.stdin), unreadable without it.
const readPathspecFile = (file, dir, stdin) => {
  if (file === '-') return stdin == null ? null : String(stdin);
  try { return fs.readFileSync(path.resolve(dir, file), 'utf8'); } catch { return null; }
};

// The pathspec positions of the path-scoped subcommands: everything after `--` and a pathspec list; before
// `--`, the words of the commands whose words are pathspecs (reset and checkout words are revisions),
// skipping the values of their options.
const LITERAL_SUBS = new Set(['add', 'commit', 'reset', 'restore', 'checkout', 'rm', 'clean']);
const WORD_PATHSPEC_SUBS = new Set(['add', 'commit', 'restore', 'rm', 'clean']);
const SUB_VALUE_OPTIONS = { restore: new Set(['-s', '--source']), clean: new Set(['-e', '--exclude']) };
/**
 * literalAppRouterArgv(argv, {cwd, stdin, listFile}) -> {argv, list, changed}: the argv the shim hands the real
 * git so that git reads every pathspec the way the guard scoped it (literalPathspec on each pathspec
 * position). A --pathspec-from-file list with such a pathspec comes back as `list` (NUL-separated text) for
 * the shim to write to `listFile`, which the argv then names with --pathspec-file-nul. Anything else passes
 * byte for byte.
 */
export function literalAppRouterArgv(argv, { cwd = process.cwd(), stdin = null, listFile = null } = {}) {
  const args = [...argv].map(String);
  const { cwd: dir, sub, rest } = parseGitArgv(args, cwd);
  if (!LITERAL_SUBS.has(sub)) return { argv: args, list: null, changed: false };
  const head = args.slice(0, args.length - rest.length);
  const values = sub === 'commit' ? VALUE_OPTIONS : SUB_VALUE_OPTIONS[sub] ?? new Set();
  let changed = false;
  const lit = (a) => { const l = literalPathspec(a); if (l !== a) changed = true; return l; };
  const out = [];
  const LIST = Symbol('pathspec list');
  let file = null, nul = false, dashDash = false;
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (dashDash) { out.push(lit(a)); continue; }
    if (a === '--') { dashDash = true; out.push(a); continue; }
    if (a === PATHSPEC_FILE && i + 1 < rest.length) { file = rest[i + 1]; out.push({ [LIST]: [a, rest[i + 1]] }); i += 1; continue; }
    if (a.startsWith(`${PATHSPEC_FILE}=`)) { file = a.slice(PATHSPEC_FILE.length + 1); out.push({ [LIST]: [a] }); continue; }
    if (a === '--pathspec-file-nul') { nul = true; out.push({ [LIST]: [a] }); continue; }
    if (a.startsWith('-')) { out.push(a); if (values.has(a) && i + 1 < rest.length) { out.push(rest[i + 1]); i += 1; } continue; }
    out.push(WORD_PATHSPEC_SUBS.has(sub) ? lit(a) : a);
  }
  let list = null;
  if (file != null && listFile && PATHSPEC_FILE_SUBS.has(sub)) {
    const text = readPathspecFile(file, dir, stdin);
    const specs = text == null ? [] : parsePathspecList(text, nul);
    const literal = specs.map(literalPathspec);
    if (literal.some((l, k) => l !== specs[k])) { list = literal.map((l) => `${l}\0`).join(''); changed = true; }
  }
  let named = false;
  const flat = out.flatMap((a) => {
    if (typeof a === 'string') return [a];
    if (list == null) return a[LIST];
    if (named) return [];
    named = true;
    return [`${PATHSPEC_FILE}=${listFile}`, '--pathspec-file-nul'];
  });
  return { argv: [...head, ...flat], list, changed };
}

const REVERT = 'undo a wrong commit with `git revert <sha>` (a new commit); never move the shared branch back';
const OWNED_DISCARD = 'discard only your own files: `git restore --source=HEAD --staged --worktree -- <owned paths>`';

/**
 * classifyGit(argv, {cwd, owned, top}) -> {allow} | {allow:false, code, reason, remedy}
 * `owned` is the op's owned paths as absolute paths (the job guard file); when
 * it is null the path-scoped rules refuse what they cannot prove owned.
 */
export function classifyGit(argv, { cwd = process.cwd(), owned = null, top = null, env = process.env, stdin = null } = {}) {
  const { cwd: dir, config, sub, rest: argRest } = parseGitArgv(argv, cwd);
  // The agent harness's own git plumbing (Codex CLI: `-c core.hooksPath=NUL -c core.fsmonitor=false ...`
  // for its status probes and worktree snapshots) is the harness, not the worker: it passes untouched.
  if (config.some((c) => HARNESS_HOOKS_OFF.test(c))) return ALLOW;
  if (config.some((c) => CONFIG_BYPASS.test(c)) && HOOKED_WRITES.has(sub))
    return refusal('HOOKS_BYPASS', 'git -c core.hooksPath=... switches off the repository hooks and the history guard', 'run git without overriding core.hooksPath');
  if (!sub) return ALLOW;
  // A private index (GIT_INDEX_FILE) is not the shared one: staging into it touches nobody.
  if (env?.GIT_INDEX_FILE && PRIVATE_INDEX_SAFE.has(sub)) return ALLOW;
  // A pathspec file's entries are pathspecs like the ones named after `--`; a list the guard
  // cannot read is refused, since nothing proves its paths owned.
  const pathspecFile = PATHSPEC_FILE_SUBS.has(sub) ? takePathspecFile(argRest) : { rest: argRest, file: null, nul: false };
  const rest = pathspecFile.rest;
  let fileSpecs = null;
  if (pathspecFile.file != null) {
    const text = readPathspecFile(pathspecFile.file, dir, stdin);
    if (text == null)
      return refusal('PATHSPEC_FILE_UNREADABLE', `git ${sub} ${PATHSPEC_FILE}=${pathspecFile.file}: the guard cannot read that list, so nothing proves its paths are yours`,
        `write the list (one owned path per line, relative to where you run git) to a readable file and pass ${PATHSPEC_FILE}=<file>, or name the paths after \`--\``);
    fileSpecs = parsePathspecList(text, pathspecFile.nul);
  }
  const { dashDash, options, words, paths } = splitRest(rest);
  const scoped = (specs, what) => {
    const within = pathspecsWithinOwned(specs, { cwd: dir, owned, top });
    return within.ok ? ALLOW : refusal('PATH_NOT_OWNED', `${what} names paths outside your owned_paths: ${within.outside.join(', ')}`,
      'name only your owned paths after `--`; files other workflows changed are theirs');
  };
  switch (sub) {
    case 'reset': {
      if (has(options, '--soft', '--hard', '--mixed', '--keep', '--merge'))
        return refusal('HISTORY_REWRITE', `git reset ${options.join(' ')} moves or discards the shared branch other workflows commit on`, REVERT);
      if ((!dashDash && fileSpecs === null) || words.some((w) => w !== 'HEAD'))
        return refusal('HISTORY_REWRITE', 'git reset without `-- <paths>` resets the whole shared index (or moves the branch)', 'unstage your own files with `git restore --staged -- <owned paths>`');
      return scoped([...paths, ...(fileSpecs ?? [])], 'git reset');
    }
    case 'rebase':
      if (has(options, '--abort', '--quit', '--show-current-patch')) return ALLOW;
      return refusal('HISTORY_REWRITE', 'git rebase rewrites commits of the shared branch', REVERT);
    case 'pull':
      if (has(options, '--rebase', '-r') && !has(options, '--rebase=false', '--no-rebase'))
        return refusal('HISTORY_REWRITE', 'git pull --rebase rewrites local commits, including other workflows\' unpushed commits', 'use `git pull --ff-only` (or a merge); never rebase the shared branch');
      return ALLOW;
    case 'commit': {
      if (has(options, '--amend') || options.some((o) => /^--fixup=(amend|reword):/.test(o)))
        return refusal('HISTORY_REWRITE', 'git commit --amend replaces HEAD, which may be another workflow\'s commit', 'make a new commit; a wrong one is undone with `git revert`');
      if (has(options, '--no-verify') || hasShort(options.filter((o) => !o.startsWith('--')), 'n'))
        return refusal('HOOKS_BYPASS', 'git commit --no-verify skips the repository hooks', 'fix what the hook reports and commit again');
      if (has(options, '--all', '--include', '--interactive', '--patch') || hasShort(options.filter((o) => !o.startsWith('--')), 'a') || hasShort(options.filter((o) => !o.startsWith('--')), 'i'))
        return refusal('COMMIT_NOT_SCOPED', 'git commit -a/--include commits whatever is staged or modified, including other workflows\' files',
          'commit with explicit owned pathspecs: `git commit -m "<msg>" -- <owned paths>`');
      const specs = [...paths, ...(dashDash ? [] : words.filter((w, i) => !optionValue(rest, w, i))), ...(fileSpecs ?? [])];
      if (!specs.length)
        return refusal('COMMIT_NOT_SCOPED', `git commit without pathspecs${fileSpecs ? ` (its ${PATHSPEC_FILE} list is empty)` : ''} commits the whole shared index, including files other workflows staged`,
          `commit with explicit owned pathspecs: \`git commit -m "<msg>" -- <owned paths>\` (a long list: \`git commit -m "<msg>" ${PATHSPEC_FILE}=<list>\`)`);
      return owned ? scoped(specs, 'git commit') : ALLOW;
    }
    case 'stash':
      // lint-staged's pre-commit backup (mia, starci-next) is `stash create` + `stash store`, dropped
      // after a clean run: it copies, it never sweeps the worktree. push/save/pop/apply/clear do.
      if (['list', 'show', 'create', 'store', 'drop'].includes(words[0])) return ALLOW;
      return refusal('SHARED_WORKTREE_DISCARD', 'git stash sweeps every workflow\'s uncommitted changes out of the shared checkout', 'leave other files alone; commit or restore only your owned paths');
    case 'clean':
      if (has(options, '--dry-run') || hasShort(options.filter((o) => !o.startsWith('--')), 'n')) return ALLOW;
      if (has(options, '--force') || hasShort(options.filter((o) => !o.startsWith('--')), 'f')) {
        if (!paths.length && !words.length) return refusal('SHARED_WORKTREE_DISCARD', 'git clean -f deletes every workflow\'s untracked files', 'delete only files you created under your owned paths');
        return scoped([...paths, ...words], 'git clean');
      }
      return ALLOW;
    case 'checkout': {
      if (dashDash || fileSpecs) {
        const specs = [...paths, ...(fileSpecs ?? [])];
        if (!specs.length) return ALLOW;
        return owned ? scoped(specs, 'git checkout -- <paths>') : refusal('PATH_NOT_OWNED', 'git checkout -- <paths> discards changes and your owned paths are unknown', OWNED_DISCARD);
      }
      if (has(options, '--help')) return ALLOW;
      return refusal('SHARED_HEAD_MOVE', 'git checkout <branch|commit|path> without `--` switches the shared checkout for every workflow or discards files',
        `stay on the branch; ${OWNED_DISCARD}`);
    }
    case 'switch':
      if (has(options, '--help')) return ALLOW;
      return refusal('SHARED_HEAD_MOVE', 'git switch moves HEAD of the checkout every workflow shares', 'stay on the current branch');
    case 'restore': {
      const specs = [...paths, ...words, ...(fileSpecs ?? [])];
      if (!specs.length) return ALLOW;
      // --staged alone rewrites only the shared index, the worktree form discards
      // files: either way it touches only the paths it names, which must be yours.
      return owned ? scoped(specs, 'git restore') : refusal('PATH_NOT_OWNED', 'git restore discards changes and your owned paths are unknown', OWNED_DISCARD);
    }
    case 'add': {
      if (has(options, '--all', '-A', '--update', '-u') || hasShort(options.filter((o) => !o.startsWith('--')), 'A') || hasShort(options.filter((o) => !o.startsWith('--')), 'u'))
        return refusal('COMMIT_NOT_SCOPED', 'git add -A/-u stages every workflow\'s changes', 'stage only your owned paths: `git add -- <owned paths>`');
      const specs = [...paths, ...words, ...(fileSpecs ?? [])];
      return owned && specs.length ? scoped(specs, 'git add') : ALLOW;
    }
    case 'rm':
    case 'mv': {
      const specs = [...paths, ...words, ...(fileSpecs ?? [])];
      return owned && specs.length ? scoped(specs, `git ${sub}`) : ALLOW;
    }
    case 'branch':
      if (has(options, '-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force', '--set-upstream-to', '-u', '--unset-upstream'))
        return refusal('HISTORY_REWRITE', `git branch ${options.join(' ')} rewrites or deletes branches of the shared repository`, 'leave branches alone; the kernel lands work on the current branch');
      return words.length ? refusal('SHARED_HEAD_MOVE', 'creating branches in the shared repository is not an op effect', 'commit on the current branch') : ALLOW;
    case 'push':
      if (has(options, '--force', '-f', '--force-with-lease', '--force-if-includes', '--mirror', '--delete', '-d', '--prune') || words.some((w) => w.startsWith('+') || w.startsWith(':')))
        return refusal('HISTORY_REWRITE', 'a forced or deleting push rewrites the shared remote branch', 'push fast-forward only; integrate with a merge, never a force');
      if (has(options, '--no-verify')) return refusal('HOOKS_BYPASS', 'git push --no-verify skips the pre-push gate', 'fix what the gate reports and push again');
      return ALLOW;
    case 'update-ref':
    case 'symbolic-ref':
      if (sub === 'symbolic-ref' && words.length <= 1 && !has(options, '-d', '--delete')) return ALLOW;
      if (sub === 'update-ref' && has(options, '--help')) return ALLOW;
      return refusal('HISTORY_REWRITE', `git ${sub} writes refs directly`, REVERT);
    case 'filter-branch':
    case 'filter-repo':
    case 'replace':
      return refusal('HISTORY_REWRITE', `git ${sub} rewrites history`, REVERT);
    case 'reflog':
      if (['expire', 'delete'].includes(words[0])) return refusal('HISTORY_REWRITE', 'git reflog expire/delete destroys the recovery record', 'leave the reflog alone');
      return ALLOW;
    case 'worktree':
      // nivo-fe inc-c8fbf76aa499: a Devin op worker added its own worktree beside nivo-fe, junctioned the live
      // node_modules into it, and `git worktree remove --force` followed the junctions and deleted 674 live files.
      // An op works in the checkout it was dispatched to; it never creates, moves or removes a worktree.
      if (['add', 'move', 'remove'].includes(words[0]))
        return refusal('WORKTREE_NOT_OPS', `git worktree ${words[0]}: an op worker never creates, moves or removes a git worktree - it works in the checkout it was dispatched to (a private worktree with links into the live repository deleted live files, nivo-fe inc-c8fbf76aa499)`,
          'work in your dispatched checkout; a build or measurement that needs another revision is reported as a need (report blocked environment), never done in a worktree of your own, and never with a junction or symlink');
      if (['remove', 'prune', 'move'].includes(words[0]) && has(options, '--force', '-f'))
        return refusal('SHARED_WORKTREE_DISCARD', 'git worktree remove --force discards a checkout\'s uncommitted work', 'leave worktrees to the kernel');
      return ALLOW;
    case 'merge':
    case 'cherry-pick':
    case 'revert':
      if (has(options, '--no-verify')) return refusal('HOOKS_BYPASS', `git ${sub} --no-verify skips the repository hooks`, 'run it without --no-verify');
      return ALLOW;
    default:
      return ALLOW;
  }
}

// `git commit -m msg path`: the word after -m/-F/-C/-c/--author... is a value, not a pathspec.
const VALUE_OPTIONS = new Set(['-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message', '--author', '--date', '-t', '--template', '--cleanup', '--fixup', '--squash', '--trailer', '-S', '--gpg-sign']);
function optionValue(rest, word, index) {
  // index is the position within `words`; find the word's real position in rest
  let seen = -1;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--') break;
    if (!rest[i].startsWith('-')) seen += 1;
    if (seen === index && rest[i] === word) return i > 0 && VALUE_OPTIONS.has(rest[i - 1]);
  }
  return false;
}
