// git-policy.mjs — which git commands an op worker may run in a checkout it
// shares with other workflows. Pure: argv in, verdict out; scripts/guards/command-guard.mjs
// (a PreToolUse hook) applies it to the agent's shell command before it runs, and the
// reference-transaction hook git itself runs backs it (scripts/guards/hook-install.mjs).
//
// Several workflows of one product ledger build in ONE checkout on ONE branch.
// Their workers damaged each other with commands that are harmless alone:
//  - a worker ran `git reset --soft HEAD~1` over a peer's landed commit
//    and re-committed it under its own message;
//  - a commit swept a foreign file a hook had re-staged;
//  - `git stash`, `git clean -fd`, `git checkout -- <path>` and `git restore`
//    discard every peer's uncommitted work under the paths they name.
// The rule (modules/ops/_common.yaml "Evidence, completion and commits",
// modules/kernel/api.yaml conventions.sharedCheckout): the shared branch is
// append-only, a worker discards and stages only its own paths, and a commit
// names its owned paths explicitly. A wrong commit is undone with `git revert`.
//
// The argv/pathspec machinery (parseGitArgv, literalPathspec, pathspecsWithinOwned,
// --pathspec-from-file handling, literalAppRouterArgv) lives in ./git-pathspec.mjs;
// it is re-exported here so existing importers keep working.
import {
  parseGitArgv, pathspecsWithinOwned, parsePathspecList, takePathspecFile,
  readPathspecFile, PATHSPEC_FILE, PATHSPEC_FILE_SUBS, VALUE_OPTIONS,
} from './git-pathspec.mjs';
export {
  parseGitArgv, literalPathspec, pathspecsWithinOwned, parsePathspecList,
  literalAppRouterArgv, pathspecListOnStdin,
} from './git-pathspec.mjs';

const CONFIG_BYPASS = /^core\.hookspath=/i;
// Commands whose allowed forms run repository hooks: switching hooks off for them skips the guard and the secrets
// hooks. (Every `branch` form the policy allows only reads; an allowed `stash` writes only refs/stash, which the
// history hook leaves alone.) Any other command may carry `-c core.hooksPath=...` - the Codex CLI harness does on
// every status probe.
const HOOKED_WRITES = new Set(['commit', 'merge', 'push', 'am', 'rebase', 'cherry-pick', 'revert', 'pull', 'checkout', 'switch', 'reset', 'update-ref']);
const PRIVATE_INDEX_SAFE = new Set(['add', 'rm', 'read-tree', 'write-tree', 'update-index', 'ls-files', 'diff']);

const refusal = (code, reason, remedy) => ({ allow: false, code, reason, remedy });
const ALLOW = Object.freeze({ allow: true });

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
const shortFlags = (options) => options.filter((o) => !o.startsWith('--'));

// Config git reads from the environment, as `key=value` entries: GIT_CONFIG_PARAMETERS (how git hands `-c` to its
// children, sq-quoted: `'k'='v'` or `'k=v'`) and GIT_CONFIG_COUNT with GIT_CONFIG_KEY_<n>/GIT_CONFIG_VALUE_<n>.
export function envConfig(env) {
  const out = [];
  const params = String(env?.GIT_CONFIG_PARAMETERS ?? '');
  let i = 0;
  const quoted = () => {
    if (params[i] !== "'") return null;
    let s = '';
    for (i += 1; i < params.length; i += 1) {
      if (params[i] !== "'") { s += params[i]; continue; }
      if (params.startsWith(String.raw`'\''`, i)) { s += "'"; i += 3; continue; }
      i += 1;
      return s;
    }
    return s;
  };
  while (i < params.length) {
    if (/\s/.test(params[i])) { i += 1; continue; }
    const key = quoted();
    if (key == null) break;
    if (params[i] === '=') { i += 1; out.push(`${key}=${quoted() ?? ''}`); } else out.push(key);
  }
  const count = Number.parseInt(env?.GIT_CONFIG_COUNT ?? '', 10);
  for (let n = 0; Number.isInteger(count) && n < count && n < 1000; n += 1) {
    const key = env[`GIT_CONFIG_KEY_${n}`], value = env[`GIT_CONFIG_VALUE_${n}`] ?? '';
    if (key) out.push(`${key}=${value}`);
  }
  return out;
}

// A push names its remote, never a URL or a path, and no command-line config redirects that remote.
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const REMOTE_KEY = new RegExp([
  String.raw`^(remote\.`,
  String.raw`.+\.(url|pushurl|receivepack)|url\.`,
  String.raw`.+\.(insteadof|pushinsteadof))$`,
].join(''), 'i');
const redirectsRemote = (entry) => REMOTE_KEY.test(String(entry).split('=')[0]);
const PUSH_VALUE_OPTIONS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);
function pushTarget(rest) {
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--') return rest[i + 1] ?? null;
    if (a === '--repo' && i + 1 < rest.length) return rest[i + 1];
    if (a.startsWith('--repo=')) return a.slice('--repo='.length);
    if (PUSH_VALUE_OPTIONS.has(a)) { i += 1; continue; }
    if (!a.startsWith('-')) return a;
  }
  return null;
}

// `git config` writes that switch off the hooks or redirect a remote for every workflow of the checkout. Setting
// core.hooksPath to the value it already has passes: husky's install (`prepare`) does exactly that on every npm install.
const CONFIG_VALUE_OPTIONS = new Set(['-f', '--file', '--blob', '--type', '--default', '--comment', '--value']);
const CONFIG_READS = new Set(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--get-color', '--get-colorbool', '--list', '-l']);
const GUARDED_SECTION = /^(core|remote|url)(\.|$)/i;
const hooksPathOf = (v) => (v == null ? null : String(v).trim().replaceAll('\\', '/').replace(/\/+$/, ''));
// The write a `git config` argv performs: {key, value?} | {section} | {edit}, or null for a read.
const configWriteOf = (sub, words, options) => {
  if (['set', 'unset', 'edit', 'rename-section', 'remove-section'].includes(sub)) {
    if (sub === 'set') return { key: words[1], value: words[2] };
    if (sub === 'unset') return { key: words[1] };
    if (sub === 'edit') return { edit: true };
    return { section: words[1] };
  }
  if (['get', 'list'].includes(sub)) return null;
  if (has(options, '--edit') || hasShort(options, 'e')) return { edit: true };
  if (has(options, '--rename-section', '--remove-section')) return { section: words[0] };
  if (has(options, '--unset', '--unset-all')) return { key: words[0] };
  if (has(options, '--add', '--replace-all') || (words.length >= 2 && !options.some((o) => CONFIG_READS.has(o.split('=')[0])))) return { key: words[0], value: words[1] };
  return null;
};
function classifyConfig(rest, currentConfig) {
  const { words, options } = configWordsAndOptions(rest);
  const write = configWriteOf(words[0], words, options);
  return configWriteVerdict(write, currentConfig);
}
const configWordsAndOptions = (rest) => {
  const words = [], options = [];
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--') { words.push(...rest.slice(i + 1)); break; }
    if (a.startsWith('-')) { options.push(a); if (CONFIG_VALUE_OPTIONS.has(a)) { i += 1; } continue; }
    words.push(a);
  }
  return { words, options };
};
const configWriteVerdict = (write, currentConfig) => {
  if (!write) return ALLOW;
  const refused = (what) => refusal('CONFIG_GUARDED', `git config ${what} changes the hooks or the remotes of the checkout every workflow shares`,
    'leave git config alone; report a need for a different hook or remote');
  if (write.edit) return refused('--edit');
  if (write.section != null) return GUARDED_SECTION.test(String(write.section)) ? refused(`on section ${write.section}`) : ALLOW;
  const key = String(write.key ?? '');
  if (/^core\.hookspath$/i.test(key)) {
    const current = hooksPathOf(currentConfig('core.hooksPath'));
    const unchanged = write.value !== undefined ? hooksPathOf(write.value) === current : current == null;
    return unchanged ? ALLOW : refused(key);
  }
  return REMOTE_KEY.test(key) ? refused(key) : ALLOW;
};

const REVERT = 'undo a wrong commit with `git revert <sha>` (a new commit); never move the shared branch back';
const OWNED_DISCARD = 'discard only your own files: `git restore --source=HEAD --staged --worktree -- <owned paths>`';

// The verdict of each path-scoped or history-writing subcommand. Every helper takes the shared
// ctx ({sub, rest, options, words, paths, dashDash, fileSpecs, config, currentConfig, scoped}) and
// returns what the old switch case returned, in the same order of checks.
const resetVerdict = ({ options, dashDash, fileSpecs, words, paths, scoped }) => {
  if (has(options, '--soft', '--hard', '--mixed', '--keep', '--merge'))
    return refusal('HISTORY_REWRITE', `git reset ${options.join(' ')} moves or discards the shared branch other workflows commit on`, REVERT);
  if ((!dashDash && fileSpecs === null) || words.some((w) => w !== 'HEAD'))
    return refusal('HISTORY_REWRITE', 'git reset without `-- <paths>` resets the whole shared index (or moves the branch)', 'unstage your own files with `git restore --staged -- <owned paths>`');
  return scoped([...paths, ...(fileSpecs ?? [])], 'git reset');
};
const rebaseVerdict = ({ options }) => (has(options, '--abort', '--quit', '--show-current-patch')
  ? ALLOW
  : refusal('HISTORY_REWRITE', 'git rebase rewrites commits of the shared branch', REVERT));
const pullVerdict = ({ options }) => {
  if (has(options, '--rebase', '-r') && !has(options, '--rebase=false', '--no-rebase'))
    return refusal('HISTORY_REWRITE', 'git pull --rebase rewrites local commits, including other workflows\' unpushed commits', 'use `git pull --ff-only` (or a merge); never rebase the shared branch');
  return ALLOW;
};
const commitVerdict = ({ options, dashDash, fileSpecs, words, paths, scoped, rest }) => {
  if (has(options, '--amend') || options.some((o) => /^--fixup=(amend|reword):/.test(o)))
    return refusal('HISTORY_REWRITE', 'git commit --amend replaces HEAD, which may be another workflow\'s commit', 'make a new commit; a wrong one is undone with `git revert`');
  const shorts = shortFlags(options);
  if (has(options, '--no-verify') || hasShort(shorts, 'n'))
    return refusal('HOOKS_BYPASS', 'git commit --no-verify skips the repository hooks', 'fix what the hook reports and commit again');
  if (has(options, '--all', '--include', '--interactive', '--patch') || hasShort(shorts, 'a') || hasShort(shorts, 'i'))
    return refusal('COMMIT_NOT_SCOPED', 'git commit -a/--include commits whatever is staged or modified, including other workflows\' files',
      'commit with explicit owned pathspecs: `git commit -m "<msg>" -- <owned paths>`');
  const specs = [...paths, ...(dashDash ? [] : words.filter((w, i) => !optionValue(rest, w, i))), ...(fileSpecs ?? [])];
  if (!specs.length) {
    const pathspecDetails = fileSpecs ? ` (its ${PATHSPEC_FILE} list is empty)` : '';
    return refusal('COMMIT_NOT_SCOPED', `git commit without pathspecs${pathspecDetails} commits the whole shared index, including files other workflows staged`,
      `commit with explicit owned pathspecs: \`git commit -m "<msg>" -- <owned paths>\` (a long list: \`git commit -m "<msg>" ${PATHSPEC_FILE}=<list>\`)`);
  }
  return scoped(specs, 'git commit');
};
const stashVerdict = ({ words }) => {
  // lint-staged's pre-commit backup is `stash create` + `stash store`, dropped
  // after a clean run: it copies, it never sweeps the worktree. push/save/pop/apply/clear do.
  if (['list', 'show', 'create', 'store', 'drop'].includes(words[0])) return ALLOW;
  return refusal('SHARED_WORKTREE_DISCARD', 'git stash sweeps every workflow\'s uncommitted changes out of the shared checkout', 'leave other files alone; commit or restore only your owned paths');
};
const cleanVerdict = ({ options, words, paths, scoped }) => {
  if (has(options, '--dry-run') || hasShort(shortFlags(options), 'n')) return ALLOW;
  if (has(options, '--force') || hasShort(shortFlags(options), 'f')) {
    if (!paths.length && !words.length) return refusal('SHARED_WORKTREE_DISCARD', 'git clean -f deletes every workflow\'s untracked files', 'delete only files you created under your owned paths');
    return scoped([...paths, ...words], 'git clean');
  }
  return ALLOW;
};
const checkoutVerdict = ({ options, dashDash, fileSpecs, paths, scoped }) => {
  if (dashDash || fileSpecs) {
    const specs = [...paths, ...(fileSpecs ?? [])];
    if (!specs.length) return ALLOW;
    return scoped(specs, 'git checkout -- <paths>');
  }
  if (has(options, '--help')) return ALLOW;
  return refusal('SHARED_HEAD_MOVE', 'git checkout <branch|commit|path> without `--` switches the shared checkout for every workflow or discards files',
    `stay on the branch; ${OWNED_DISCARD}`);
};
const switchVerdict = ({ options }) => {
  if (has(options, '--help')) return ALLOW;
  return refusal('SHARED_HEAD_MOVE', 'git switch moves HEAD of the checkout every workflow shares', 'stay on the current branch');
};
const restoreVerdict = ({ words, paths, fileSpecs, scoped }) => {
  const specs = [...paths, ...words, ...(fileSpecs ?? [])];
  if (!specs.length) return ALLOW;
  // --staged alone rewrites only the shared index, the worktree form discards
  // files: either way it touches only the paths it names, which must be yours.
  return scoped(specs, 'git restore');
};
const addVerdict = ({ options, words, paths, fileSpecs, scoped }) => {
  if (has(options, '--all', '-A', '--update', '-u') || hasShort(shortFlags(options), 'A') || hasShort(shortFlags(options), 'u'))
    return refusal('COMMIT_NOT_SCOPED', 'git add -A/-u stages every workflow\'s changes', 'stage only your owned paths: `git add -- <owned paths>`');
  const specs = [...paths, ...words, ...(fileSpecs ?? [])];
  return specs.length ? scoped(specs, 'git add') : ALLOW;
};
const scopedSubVerdict = ({ sub, words, paths, fileSpecs, scoped }) => {
  const specs = [...paths, ...words, ...(fileSpecs ?? [])];
  return specs.length ? scoped(specs, `git ${sub}`) : ALLOW;
};
const branchVerdict = ({ options, words }) => {
  if (has(options, '--delete', '--move', '--copy', '--force', '--set-upstream-to', '--unset-upstream') || [...'dDmMcCfu'].some((l) => hasShort(options, l)))
    return refusal('HISTORY_REWRITE', `git branch ${options.join(' ')} rewrites or deletes branches of the shared repository`, 'leave branches alone; the kernel lands work on the current branch');
  // in list mode the words are patterns or the values of --contains/--merged/--points-at
  if (has(options, '--list', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--all', '--remotes') || [...'lar'].some((l) => hasShort(options, l))) return ALLOW;
  return words.length ? refusal('SHARED_HEAD_MOVE', 'creating branches in the shared repository is not an op effect', 'commit on the current branch') : ALLOW;
};
const pushVerdict = ({ options, words, rest, config }) => {
  if (has(options, '--force', '--force-with-lease', '--force-if-includes', '--mirror', '--delete', '--prune') || hasShort(options, 'f') || hasShort(options, 'd')
    || words.some((w) => w.startsWith('+') || w.startsWith(':')))
    return refusal('HISTORY_REWRITE', 'a forced or deleting push rewrites the shared remote branch', 'push fast-forward only; integrate with a merge, never a force');
  if (has(options, '--no-verify')) return refusal('HOOKS_BYPASS', 'git push --no-verify skips the pre-push gate', 'fix what the gate reports and push again');
  const target = pushTarget(rest);
  if ((target != null && !REMOTE_NAME.test(target)) || config.some(redirectsRemote)) {
    const targetDetails = target ? ` ${target}` : '';
    return refusal('PUSH_REMOTE_NOT_CONFIGURED', `git push${targetDetails} names a URL, a path or a remote redirected on the command line`, 'push to the configured remote by name (`git push origin <branch>`)');
  }
  return ALLOW;
};
const remoteVerdict = ({ words }) => {
  if (['add', 'set-url', 'rename', 'remove', 'rm'].includes(words[0]))
    return refusal('REMOTE_REWRITE', `git remote ${words[0]} changes where every workflow of this checkout pushes`, 'push to the configured remote; report a need for another remote');
  return ALLOW;
};
const refVerdict = ({ sub, options, words }) => {
  if (sub === 'symbolic-ref' && words.length <= 1 && !has(options, '-d', '--delete')) return ALLOW;
  if (sub === 'update-ref' && has(options, '--help')) return ALLOW;
  return refusal('HISTORY_REWRITE', `git ${sub} writes refs directly`, REVERT);
};
const historyVerdict = ({ sub }) => refusal('HISTORY_REWRITE', `git ${sub} rewrites history`, REVERT);
const reflogVerdict = ({ words }) => {
  if (['expire', 'delete'].includes(words[0])) return refusal('HISTORY_REWRITE', 'git reflog expire/delete destroys the recovery record', 'leave the reflog alone');
  return ALLOW;
};
const worktreeVerdict = ({ words }) => {
  // A Devin op worker once added its own worktree beside a live repository, junctioned the live
  // node_modules into it, and `git worktree remove --force` followed the junctions and deleted 674 live files.
  // An op works in the checkout it was dispatched to; it never creates, moves or removes a worktree.
  if (['add', 'move', 'remove'].includes(words[0]))
    return refusal('WORKTREE_NOT_OPS', `git worktree ${words[0]}: an op worker never creates, moves or removes a git worktree - it works in the checkout it was dispatched to (a private worktree with links into the live repository deleted live files)`,
      'work in your dispatched checkout; a worktree is created and removed only by the runtime worktree API (scripts/machine/worktree-git.mjs createScratchWorktree, removeScratchWorktree and safeRemoveWorktree, scripts/machine/worktree-orca.mjs createOrcaWorktree and removeOrcaWorktree) - a build or measurement that needs another revision is reported as a need (report blocked environment), never done in a worktree of your own, and never with a junction or symlink');
  return ALLOW;
};
const mergeLikeVerdict = ({ sub, options }) => {
  if (has(options, '--no-verify')) return refusal('HOOKS_BYPASS', `git ${sub} --no-verify skips the repository hooks`, 'run it without --no-verify');
  return ALLOW;
};
const SUB_VERDICTS = {
  reset: resetVerdict, rebase: rebaseVerdict, pull: pullVerdict, commit: commitVerdict,
  stash: stashVerdict, clean: cleanVerdict, checkout: checkoutVerdict, switch: switchVerdict,
  restore: restoreVerdict, add: addVerdict, rm: scopedSubVerdict, mv: scopedSubVerdict,
  branch: branchVerdict, push: pushVerdict, remote: remoteVerdict,
  'update-ref': refVerdict, 'symbolic-ref': refVerdict,
  'filter-branch': historyVerdict, 'filter-repo': historyVerdict, replace: historyVerdict,
  reflog: reflogVerdict, worktree: worktreeVerdict,
  merge: mergeLikeVerdict, 'cherry-pick': mergeLikeVerdict, revert: mergeLikeVerdict,
};

/**
 * classifyGit(argv, {cwd, owned, top}) -> {allow} | {allow:false, code, reason, remedy}
 * `owned` is the op's owned paths as absolute paths (the job guard file); when
 * it is null the path-scoped rules refuse what they cannot prove owned.
 */
export function classifyGit(argv, { cwd = process.cwd(), owned = null, top = null, env = process.env, stdin = null, currentConfig = () => null } = {}) {
  const parsed = parseGitArgv(argv, cwd);
  const { cwd: dir, sub, rest: argRest } = parsed;
  const config = [...parsed.config, ...envConfig(env)];
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
  // Path-scoped verbs fail closed: without the job's owned paths (no readable guard file) nothing proves a path yours.
  const scoped = (specs, what) => {
    if (owned == null) return refusal('PATH_NOT_OWNED', `${what} names paths and your owned paths are unknown (no readable guard file)`, 'report blocked environment: your guard file (STARCI_GUARD_FILE) is missing or unreadable');
    const within = pathspecsWithinOwned(specs, { cwd: dir, owned, top });
    return within.ok ? ALLOW : refusal('PATH_NOT_OWNED', `${what} names paths outside your owned_paths: ${within.outside.join(', ')}`,
      'name only your owned paths after `--`; files other workflows changed are theirs');
  };
  const ctx = { sub, rest, options, words, paths, dashDash, fileSpecs, config, currentConfig, scoped };
  if (sub === 'config') return classifyConfig(rest, currentConfig);
  return SUB_VERDICTS[sub]?.(ctx) ?? ALLOW;
}

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
