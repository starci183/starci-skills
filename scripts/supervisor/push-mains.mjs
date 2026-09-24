#!/usr/bin/env node
// push-mains.mjs — the Supervisor pushes main of the runtime and of every product repository each tick
// (modules/supervisor/supervise.yaml kernelSeat, owner 2026-09-24). Secret scan first, hooks on:
// never --no-verify, never force, never a branch other than main, never a repository not listed.
//
//   node scripts/supervisor/push-mains.mjs [--repo <path>]... [--dry-run] [--hooks-only] [--json]
//       default repositories: the runtime (.claude) plus config.yaml supervisor.repos plus every
//       target repository one of those ledgers binds (.workspaces/projects/<p>/work.json —
//       scripts/kernel/target-repo.mjs projectBinding; a checkout is never guessed by name)
//   --hooks-only   prepare the scratch of committed main and run its pre-push hook (`git hook run pre-push`)
//                  without pushing, ahead or not: proves main is green where a push would judge it
//
// Per repository: main must be the checked-out branch's upstream-tracked main with commits ahead of
// origin/main (nothing ahead = nothing to do). The outgoing range origin/main..main is scanned: a forbidden
// file (an env file, a private key, a credentials JSON, anything under .secrets/) or an added line matching a
// secret pattern refuses the push. Findings name the file, line and pattern, NEVER the value. A push the
// remote refuses (non-fast-forward, a red pre-push hook) is reported, never retried with force.
//
// The push runs from a scratch worktree of committed main, never from the live working tree: a product
// checkout is shared with running op workers, whose uncommitted edits make the repository's pre-push hook
// (husky: nivo-backend `npm run lint:check && npm run test:unit`, nivo-fe turbo lint) red for reasons
// unrelated to the commits being pushed — while one op is mid-edit nivo never pushes (cluster
// push-hooks-test-inflight-tree, 2026-09-24 15:34Z: 42 unit failures that lived only in uncommitted edits).
// The scratch gets the live checkout's node_modules (root and every workspace package that has its own) and
// a relative core.hooksPath by DIRECTORY LINK, so hooks stay ON and judge the commit; it is removed whatever
// happens, its links first so a forced removal can never walk into the live tree. The rest of the live
// checkout's git-ignored LOCAL STATE the hook's tests read is mirrored the same way, discovered by
// `git ls-files --others --ignored --exclude-standard --directory`, never a hard-coded list (cluster
// push-scratch-local-mounts, 2026-09-24 16:30Z: nivo-backend's hook was red on a clean scratch of main for
// the `.gitmounts/data` clone, `.env.override` and `.starcistacks/<env>/runtime/files/*` it lacked): each
// entry is linked at its shallowest path the scratch does not hold — a directory by junction/symlink, a file
// by hard link — build and tool output excluded (LOCAL_STATE_EXCLUDED). A secret file is linked in place or
// not at all, never copied; the scratch lives under the repository's git dir so a hard link stays on its
// volume (file symlinks need a privilege Windows withholds, hard links cannot cross volumes). A repository whose scratch
// cannot be prepared reports `deferred: in-flight tree` while `git status --porcelain --untracked-files=no`
// shows tracked modifications — never FAILED, so a tick separates a red main from a busy tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './workers.mjs';
import { projectBinding, sourceRootOf } from '../kernel/target-repo.mjs';
import { SKILL_ROOT, openSupervisorLedger, supervisorEvent, supervisorSettings, productRepos, supervisorLog } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);

export const FORBIDDEN_FILES = [
  { name: 'env-file', test: (f) => /(^|\/)\.env(\.[^/]*)?$/i.test(f) && !/\.env\.(example|sample|template)$/i.test(f) },
  { name: 'secrets-dir', test: (f) => /(^|\/)\.secrets\//i.test(f) },
  { name: 'private-key-file', test: (f) => /\.(pem|key|p12|pfx)$/i.test(f) || /(^|\/)id_(rsa|ed25519|ecdsa)$/i.test(f) },
  { name: 'credentials-json', test: (f) => /(^|\/)(credentials|service-account|client_secret)[^/]*\.json$/i.test(f) },
];
export const SECRET_PATTERNS = [
  { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'telegram-bot-token', re: /\b\d{8,10}:AA[0-9A-Za-z_-]{33}\b/ },
  { name: 'stripe-secret', re: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/ },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // A keyword-assigned value that names itself a stand-in (a test stub's `accessToken: "fixture-..."`) is no
  // candidate; only this heuristic takes the exemption, never a provider-shaped token above.
  // A spec file's keyword-assigned values are test inputs (nivo-fe AuthenticationPage/index.spec.tsx: the sign-in
  // form's password and a mocked accessToken refused the push, 2026-09-24): the heuristic skips spec files too.
  { name: 'assigned-secret', re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"]([^'"\s$<{]{12,})['"]/i, placeholder: /fixture|stub|fake|dummy|placeholder|example|sample|changeme|redacted|mock/i,
    skipFile: /\.(?:spec|test|e2e-spec)\.[cm]?[jt]sx?$/ },
];

/**
 * Scan a unified diff (added lines only) and its file list. Returns [{file, line, pattern}] - never the value.
 * `files` are the changed paths (status A/M/R); deleted paths are not scanned.
 */
export function scanDiff({ diff = '', files = [] } = {}) {
  const findings = [];
  for (const file of files) for (const rule of FORBIDDEN_FILES) if (rule.test(file.replace(/\\/g, '/'))) findings.push({ file, line: null, pattern: rule.name });
  let file = null, line = 0;
  for (const raw of String(diff).split(/\r?\n/)) {
    if (raw.startsWith('+++ ')) { file = raw.slice(4).replace(/^b\//, ''); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (raw.startsWith('+')) {
      for (const rule of SECRET_PATTERNS) {
        if (rule.skipFile?.test(file ?? '')) continue;
        const hit = rule.re.exec(raw.slice(1));
        if (hit && !rule.placeholder?.test(hit[1] ?? '')) findings.push({ file, line, pattern: rule.name });
      }
      line += 1;
    } else if (!raw.startsWith('-')) line += 1;
  }
  return findings;
}

/** Scan the range `from..to` of `cwd`: {ok, findings, files}. */
export function scanRange({ cwd, from, to }) {
  const names = git(['diff', '--name-only', '--diff-filter=ACMR', `${from}..${to}`], { cwd });
  if (!names.ok) return { ok: false, error: names.stderr || 'git diff failed', findings: [] };
  const files = names.stdout.split(/\r?\n/).filter(Boolean);
  const diff = git(['diff', '--no-color', '--unified=0', '--diff-filter=ACMR', `${from}..${to}`], { cwd });
  if (!diff.ok) return { ok: false, error: diff.stderr || 'git diff failed', findings: [] };
  const findings = scanDiff({ diff: diff.stdout, files });
  return { ok: findings.length === 0, findings, files };
}

/** Push one repository's main (see the header). `dryRun` stops after the scan. Never throws. */
export function pushMain(repo, { dryRun = false, hooksOnly = false, run = git, scratchPush = null } = {}) {
  const out = { repo, pushed: false };
  try {
    if (!fs.existsSync(path.join(repo, '.git'))) return { ...out, skipped: 'not a git checkout' };
    const branch = run(['symbolic-ref', '--short', 'HEAD'], { cwd: repo }).stdout;
    const hasMain = run(['rev-parse', '--verify', '--quiet', 'refs/heads/main'], { cwd: repo }).ok;
    if (!hasMain) return { ...out, skipped: 'no main branch' };
    const remote = run(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: repo });
    if (!remote.ok) return { ...out, skipped: 'no origin/main' };
    const ahead = Number(run(['rev-list', '--count', 'origin/main..main'], { cwd: repo }).stdout) || 0;
    out.branch = branch || null;
    out.ahead = ahead;
    if (hooksOnly) {
      const hooks = (scratchPush ?? pushFromScratch)(repo, { run, hooksOnly: true });
      const green = hooks.ok && hooks.green;
      return { ...out, via: 'scratch', hooksOnly: true, scratch: hooks.scratch, linked: hooks.linked, hooks: hooks.ok ? (green ? 'green' : 'red') : 'unavailable', ...(green ? {} : { error: hooks.error }) };
    }
    if (!ahead) return { ...out, skipped: 'up to date' };
    const scan = scanRange({ cwd: repo, from: 'origin/main', to: 'main' });
    out.scan = { ok: scan.ok, files: scan.files?.length ?? 0, findings: scan.findings };
    if (!scan.ok) return { ...out, refused: scan.error ? `scan failed: ${scan.error}` : 'secret scan found candidates (file/line/pattern only)' };
    if (dryRun) return { ...out, wouldPush: true };
    const scratch = (scratchPush ?? pushFromScratch)(repo, { run });
    if (scratch.scratch) out.scratch = scratch.scratch;
    if (scratch.ok) {
      out.via = 'scratch';
      out.pushed = scratch.pushed;
      if (scratch.pushed) out.head = scratch.head ?? headOf(repo, run);
      else out.error = scratch.error;
      return out;
    }
    // The scratch cannot be prepared here (no worktree, a refused link, no tool). Pushing from the live tree
    // judges the same thing as the commit only while nothing is modified; a modified tracked path is exactly
    // where the hook goes red for the worker's sake, so that is deferred, not a failed push.
    const dirty = trackedModifications(repo, run);
    if (dirty.length) return { ...out, via: 'live', deferred: 'in-flight tree', detail: dirty.slice(0, 5) };
    out.via = 'live';
    const pushed = run(['push', 'origin', 'main'], { cwd: repo });
    out.pushed = pushed.ok;
    if (!pushed.ok) out.error = pushError(pushed);
    else out.head = headOf(repo, run);
    return out;
  } catch (error) { return { ...out, error: String(error?.message ?? error) }; }
}

const headOf = (repo, run) => run(['rev-parse', '--short', 'main'], { cwd: repo }).stdout;
const pushError = (r) => (r.stderr || r.error || 'push failed').split(/\r?\n/).slice(-6).join(' | ').slice(0, 600);
/** Paths `git status --porcelain --untracked-files=no` reports modified (tracked only; the status field
 *  is stripped, the helper trims the line so its 3-column offset cannot be counted on). */
const trackedModifications = (repo, run) => run(['status', '--porcelain', '--untracked-files=no'], { cwd: repo })
  .stdout.split(/\r?\n/).filter(Boolean).map((line) => line.replace(/^\s*[A-Z?!]{1,2}\s+/, '').trim());

/* ------------------------------------------------------------ scratch push */

const NODE_MODULES_DEPTH = 4;

/** A directory link (junction on Windows, symlink elsewhere): an install artifact of the live checkout
 *  made visible to the scratch worktree, never copied and never the other way round. */
const linkDir = (target, link) => { fs.mkdirSync(path.dirname(link), { recursive: true }); fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); };

/** Unlink a link: the link only, never what it points at (as workers.mjs unlinkNodeModulesLink). */
const unlinkLink = (link) => { try { fs.unlinkSync(link); } catch { try { fs.rmdirSync(link); } catch { /* best effort */ } } };

/** Build and tool output a scratch never borrows from the live tree: the hook judges the commit, not a stale
 *  build of the working tree. Matched against every path segment of an ignored entry. */
export const LOCAL_STATE_EXCLUDED = /^(?:dist|build|coverage|\.turbo|\.next|\.scannerwork|test-results|tmp|\.git)$|\.log$/i;

/** A local-state path that is linked in place or not at all, never copied: the stack runtime and every file
 *  the outgoing scan forbids (env files, keys, credentials, .secrets). */
const neverCopied = (rel) => /(^|\/)\.starcistacks\//i.test(rel) || FORBIDDEN_FILES.some((rule) => rule.test(rel));

/**
 * The live checkout's git-ignored local state, as the points to link into a fresh worktree of `repo` at
 * `worktree`: every entry of `git ls-files --others --ignored --exclude-standard --directory` (which reaches
 * inside each workspace package too), mapped to its shallowest path the worktree does not hold — a directory
 * git ignores whole is one link, a file inside a tracked directory is linked by itself. Excluded output and
 * anything the worktree already holds (the node_modules and hooks links made first) are skipped.
 * Returns [{rel, dir}], `rel` '/'-separated, one point per subtree.
 */
export function localStateEntries(repo, worktree, { run = git } = {}) {
  const listed = run(['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'], { cwd: repo });
  if (!listed.ok) return [];
  const points = new Map();
  const covered = (rel) => [...points.keys()].some((p) => rel === p || rel.startsWith(`${p}/`));
  for (const entry of listed.stdout.split('\0').map((e) => e.replace(/\/+$/, '')).filter(Boolean)) {
    const parts = entry.split('/');
    if (parts.some((part) => LOCAL_STATE_EXCLUDED.test(part))) continue;
    for (let i = 1; i <= parts.length; i += 1) {
      const rel = parts.slice(0, i).join('/');
      if (covered(rel)) break;
      if (fs.existsSync(path.join(worktree, rel))) continue;
      let stat;
      try { stat = fs.statSync(path.join(repo, rel)); } catch { break; }
      points.set(rel, { rel, dir: stat.isDirectory() });
      break;
    }
  }
  return [...points.values()];
}

/** Link one local-state point of `repo` into `worktree`: a directory by junction/symlink, a file by hard
 *  link, else (another volume) by copy unless it is a secret, which is then left out. Returns the path
 *  made, or null when nothing was. */
const linkLocalState = (repo, worktree, { rel, dir }) => {
  const target = path.join(repo, rel), link = path.join(worktree, rel);
  if (dir) { linkDir(target, link); return link; }
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try { fs.linkSync(target, link); return link; }
  catch {
    if (neverCopied(rel)) return null;
    fs.copyFileSync(target, link);
    return link;
  }
};

/** Where a repository's scratch goes: under its git common dir (the checkout's volume, outside the working
 *  tree, never listed by git), else the system temp dir. */
const scratchBaseOf = (repo, run) => {
  const common = run(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repo });
  if (common.ok && common.stdout && fs.existsSync(common.stdout)) {
    try {
      const parent = path.join(common.stdout, 'starci-push');
      fs.mkdirSync(parent, { recursive: true });
      return fs.mkdtempSync(path.join(parent, 'wt-'));
    } catch { /* the temp dir below */ }
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), 'starci-push-'));
};

/**
 * Every directory of `root` that holds its own node_modules, read from the checkout's layout: its root
 * node_modules plus each workspace package's (nivo-fe's apps/* keep their own; nivo-backend hoists one).
 * A bounded walk that never descends into a node_modules or a hidden directory.
 */
export function nodeModulesRoots(root, { maxDepth = NODE_MODULES_DEPTH } = {}) {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules') { found.push(path.join(dir, entry.name)); continue; }
      if (depth >= maxDepth || entry.name.startsWith('.')) continue;
      if (!entry.isDirectory()) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

/**
 * `git push origin main` of `repo` from a scratch detached worktree of committed main — the same ref, a tree
 * the workers cannot dirty — so the repository's pre-push hook judges the commits and nothing else. The
 * worktree is removed whatever happens, its links unlinked first so the removal can never reach the live
 * checkout. `scratch` in the result is the directory that was used (already removed; it is kept in the tick's
 * JSON and the ledger payload so a deferred push can be inspected). Returns {ok:true, pushed, head?, scratch}
 * | {ok:true, pushed:false, error, scratch} (the remote or the hook refused) | {ok:false, unavailable,
 * error, scratch} (no scratch could be prepared here).
 */
export function pushFromScratch(repo, { run = git, scratch = null, hooksOnly = false } = {}) {
  const base = scratch ?? scratchBaseOf(repo, run);
  const worktree = path.join(base, 'wt');
  const links = [];
  const cleanup = () => {
    for (const link of links.splice(0).reverse()) unlinkLink(link);
    try { run(['worktree', 'remove', '--force', worktree], { cwd: repo }); } catch { /* best effort */ }
    try { run(['worktree', 'prune'], { cwd: repo }); } catch { /* best effort */ }
    try { fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); } catch { /* best effort */ }
  };
  const unavailable = (error) => { cleanup(); return { ok: false, unavailable: true, error, scratch: base }; };
  try {
    const added = run(['worktree', 'add', '--detach', worktree, 'main'], { cwd: repo });
    if (!added.ok) return unavailable(added.stderr || added.error || 'git worktree add failed');
    for (const dir of nodeModulesRoots(repo)) {
      const rel = path.relative(repo, dir);
      try { const link = path.join(worktree, rel); linkDir(dir, link); links.push(link); }
      catch (error) { return unavailable(`cannot link ${rel}: ${String(error?.message ?? error)}`); }
    }
    // Husky's core.hooksPath (.husky/_ in every product repo) is a gitignored install artifact: without it
    // the scratch has no pre-push hook at all and the push would be --no-verify in all but name.
    const configured = run(['config', '--get', 'core.hooksPath'], { cwd: repo });
    const hooksPath = configured.ok ? configured.stdout.trim() : '';
    if (hooksPath && !path.isAbsolute(hooksPath)) {
      const target = path.resolve(repo, hooksPath), link = path.resolve(worktree, hooksPath);
      if (fs.existsSync(target) && !fs.existsSync(link)) {
        try { linkDir(target, link); links.push(link); }
        catch (error) { return unavailable(`cannot link ${hooksPath}: ${String(error?.message ?? error)}`); }
      }
    }
    // The rest of the ignored local state the hook's tests read (a data clone, env overrides, stack runtime
    // files): linked, never written through here, unlinked before the worktree is removed.
    const linked = [];
    for (const point of localStateEntries(repo, worktree, { run })) {
      try { const link = linkLocalState(repo, worktree, point); if (link) { links.push(link); linked.push(point.rel); } }
      catch (error) { return unavailable(`cannot link ${point.rel}: ${String(error?.message ?? error)}`); }
    }
    if (hooksOnly) {
      const url = run(['remote', 'get-url', 'origin'], { cwd: repo });
      const hook = run(['hook', 'run', '--ignore-missing', 'pre-push', '--', 'origin', url.ok ? url.stdout : 'origin'], { cwd: worktree, input: '' });
      const out = { ok: true, green: hook.ok, scratch: base, linked };
      if (!hook.ok) out.error = pushError({ stderr: [hook.stdout, hook.stderr].filter(Boolean).join('\n'), error: hook.error });
      cleanup();
      return out;
    }
    const pushed = run(['push', 'origin', 'main'], { cwd: worktree });
    const out = { ok: true, pushed: pushed.ok, scratch: base, linked };
    if (pushed.ok) out.head = headOf(worktree, run);
    else out.error = pushError(pushed);
    cleanup();
    return out;
  } catch (error) { return unavailable(String(error?.message ?? error)); }
}

const canonical = (p) => { const resolved = path.resolve(p); try { return fs.realpathSync.native(resolved); } catch { return resolved; } };
const repoKey = (p) => (process.platform === 'win32' ? canonical(p).toLowerCase() : canonical(p));

/**
 * Every repository the ledger owner `repo` binds — repositories.*.pathFromSource of its project
 * work.json (the same binding api enqueue/dispatch/settle resolve against). [] when no binding
 * names `repo` its Work owner.
 */
export function boundRepos(repo, { sourceRoot = sourceRootOf() } = {}) {
  return (projectBinding(repo, { sourceRoot })?.repos ?? []).map((r) => r.root);
}

/**
 * The default push set: the runtime (.claude), each config supervisor.repos ledger owner, and every
 * repository each owner binds — the routed targets (starci-next-fe, miamia-fe, ...) a Kernel gate can
 * wait on, which a bare supervisor.repos list never pushed (inc-4de495f55f1e). Canonical-deduped:
 * a binding role that resolves to an already-listed checkout adds nothing.
 */
export function defaultPushRepos(settings = supervisorSettings(), { sourceRoot = sourceRootOf() } = {}) {
  const seen = new Map();
  const add = (repo) => { const k = repoKey(repo); if (!seen.has(k)) seen.set(k, path.resolve(repo)); };
  add(SKILL_ROOT);
  for (const owner of productRepos(settings, { sourceRoot })) {
    add(owner);
    for (const bound of boundRepos(owner, { sourceRoot })) add(bound);
  }
  return [...seen.values()];
}

/** Push every listed main and record one push event per repository in the supervisor ledger. */
export function pushMains({ repos = null, dryRun = false, hooksOnly = false, env = process.env, record = true, settings = null, sourceRoot = sourceRootOf() } = {}) {
  const list = repos ?? defaultPushRepos(settings ?? supervisorSettings(), { sourceRoot });
  const results = list.map((repo) => pushMain(path.resolve(repo), { dryRun, hooksOnly }));
  if (record && !dryRun && !hooksOnly) {
    try {
      const ledger = openSupervisorLedger({ env });
      try { ledger.transaction(() => { for (const r of results) supervisorEvent(ledger, { entityType: 'push', entityId: r.repo, kind: r.pushed ? 'push-main' : r.deferred ? 'push-deferred' : r.skipped ? 'push-skipped' : 'push-refused', payload: { ...r, scan: r.scan ? { ok: r.scan.ok, files: r.scan.files, findings: r.scan.findings.length } : undefined } }); }); }
      finally { ledger.close(); }
    } catch { /* recording is best effort */ }
  }
  return results;
}

export const describePush = (r) => `${path.basename(r.repo)}: ${r.hooksOnly ? `pre-push hook on main ${r.hooks === 'green' ? 'green' : `${String(r.hooks).toUpperCase()} ${r.error ?? ''}`} (${r.linked?.length ?? 0} local-state link(s))` : r.pushed ? `pushed ${r.ahead} commit(s) -> ${r.head}` : r.wouldPush ? `would push ${r.ahead}` : r.deferred ? `deferred: ${r.deferred}` : r.skipped ? r.skipped : r.refused ? `REFUSED ${r.refused}${(r.scan?.findings ?? []).map((f) => ` [${f.file}:${f.line ?? '-'} ${f.pattern}]`).join('')}` : `FAILED ${r.error ?? ''}`}`;

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [argv[i + 1]] : []));
  const results = pushMains({ repos: repos.length ? repos : null, dryRun: argv.includes('--dry-run'), hooksOnly: argv.includes('--hooks-only') });
  supervisorLog('push', results.map(describePush).join(' ; '));
  console.log(argv.includes('--json') ? JSON.stringify(results) : results.map(describePush).join('\n'));
  if (results.some((r) => r.refused || r.error)) process.exitCode = 1;
}
