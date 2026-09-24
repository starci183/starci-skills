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
import path from 'node:path';

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
// The literal directory a pathspec names: magic prefixes stripped, the part
// before the first glob character kept. `:/` and `:(top)` name the root.
const pathspecBase = (spec, cwd, top) => {
  let s = String(spec);
  let base = cwd;
  const magic = s.match(/^:(\([^)]*\)|[/!^]*)/);
  if (magic) {
    const m = magic[1];
    if (m.startsWith('(') ? /\btop\b/.test(m) : m.includes('/')) base = top ?? cwd;
    if (m.startsWith('(') ? /\bexclude\b/.test(m) : /[!^]/.test(m)) return null; // an exclusion narrows, never widens
    s = s.slice(magic[0].length);
  }
  const glob = s.search(/[*?[]/);
  if (glob !== -1) s = s.slice(0, glob).replace(/[^/\\]*$/, '');
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

const REVERT = 'undo a wrong commit with `git revert <sha>` (a new commit); never move the shared branch back';
const OWNED_DISCARD = 'discard only your own files: `git restore --source=HEAD --staged --worktree -- <owned paths>`';

/**
 * classifyGit(argv, {cwd, owned, top}) -> {allow} | {allow:false, code, reason, remedy}
 * `owned` is the op's owned paths as absolute paths (the job guard file); when
 * it is null the path-scoped rules refuse what they cannot prove owned.
 */
export function classifyGit(argv, { cwd = process.cwd(), owned = null, top = null, env = process.env } = {}) {
  const { cwd: dir, config, sub, rest } = parseGitArgv(argv, cwd);
  // The agent harness's own git plumbing (Codex CLI: `-c core.hooksPath=NUL -c core.fsmonitor=false ...`
  // for its status probes and worktree snapshots) is the harness, not the worker: it passes untouched.
  if (config.some((c) => HARNESS_HOOKS_OFF.test(c))) return ALLOW;
  if (config.some((c) => CONFIG_BYPASS.test(c)) && HOOKED_WRITES.has(sub))
    return refusal('HOOKS_BYPASS', 'git -c core.hooksPath=... switches off the repository hooks and the history guard', 'run git without overriding core.hooksPath');
  if (!sub) return ALLOW;
  // A private index (GIT_INDEX_FILE) is not the shared one: staging into it touches nobody.
  if (env?.GIT_INDEX_FILE && PRIVATE_INDEX_SAFE.has(sub)) return ALLOW;
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
      if (!dashDash || words.some((w) => w !== 'HEAD'))
        return refusal('HISTORY_REWRITE', 'git reset without `-- <paths>` resets the whole shared index (or moves the branch)', 'unstage your own files with `git restore --staged -- <owned paths>`');
      return scoped(paths, 'git reset');
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
      const specs = [...paths, ...(dashDash ? [] : words.filter((w, i) => !optionValue(rest, w, i)))];
      if (!specs.length)
        return refusal('COMMIT_NOT_SCOPED', 'git commit without pathspecs commits the whole shared index, including files other workflows staged',
          'commit with explicit owned pathspecs: `git commit -m "<msg>" -- <owned paths>`');
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
      if (dashDash) {
        if (!paths.length) return ALLOW;
        return owned ? scoped(paths, 'git checkout -- <paths>') : refusal('PATH_NOT_OWNED', 'git checkout -- <paths> discards changes and your owned paths are unknown', OWNED_DISCARD);
      }
      if (has(options, '--help')) return ALLOW;
      return refusal('SHARED_HEAD_MOVE', 'git checkout <branch|commit|path> without `--` switches the shared checkout for every workflow or discards files',
        `stay on the branch; ${OWNED_DISCARD}`);
    }
    case 'switch':
      if (has(options, '--help')) return ALLOW;
      return refusal('SHARED_HEAD_MOVE', 'git switch moves HEAD of the checkout every workflow shares', 'stay on the current branch');
    case 'restore': {
      const specs = [...paths, ...words];
      if (!specs.length) return ALLOW;
      // --staged alone rewrites only the shared index, the worktree form discards
      // files: either way it touches only the paths it names, which must be yours.
      return owned ? scoped(specs, 'git restore') : refusal('PATH_NOT_OWNED', 'git restore discards changes and your owned paths are unknown', OWNED_DISCARD);
    }
    case 'add': {
      if (has(options, '--all', '-A', '--update', '-u') || hasShort(options.filter((o) => !o.startsWith('--')), 'A') || hasShort(options.filter((o) => !o.startsWith('--')), 'u'))
        return refusal('COMMIT_NOT_SCOPED', 'git add -A/-u stages every workflow\'s changes', 'stage only your owned paths: `git add -- <owned paths>`');
      const specs = [...paths, ...words];
      return owned && specs.length ? scoped(specs, 'git add') : ALLOW;
    }
    case 'rm':
    case 'mv': {
      const specs = [...paths, ...words];
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
const VALUE_OPTIONS = new Set(['-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message', '--author', '--date', '-t', '--template', '--cleanup', '--fixup', '--squash', '--trailer', '-S', '--gpg-sign', '--pathspec-from-file']);
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
