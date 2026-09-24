#!/usr/bin/env node
// push-mains.mjs — the Supervisor pushes main of the runtime and of every product repository each tick
// (modules/supervisor/supervise.yaml kernelSeat, owner 2026-09-24). Secret scan first, hooks on:
// never --no-verify, never force, never a branch other than main, never a repository not listed.
//
//   node scripts/supervisor/push-mains.mjs [--repo <path>]... [--dry-run] [--json]
//       default repositories: the runtime (.claude) plus config.yaml supervisor.repos plus every
//       target repository one of those ledgers binds (.workspaces/projects/<p>/work.json —
//       scripts/kernel/target-repo.mjs projectBinding; a checkout is never guessed by name)
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
// happens, its links first so a forced removal can never walk into the live tree. A repository whose scratch
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
export function pushMain(repo, { dryRun = false, run = git, scratchPush = null } = {}) {
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
export function pushFromScratch(repo, { run = git, scratch = null } = {}) {
  const base = scratch ?? fs.mkdtempSync(path.join(os.tmpdir(), 'starci-push-'));
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
    const pushed = run(['push', 'origin', 'main'], { cwd: worktree });
    const out = { ok: true, pushed: pushed.ok, scratch: base };
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
export function pushMains({ repos = null, dryRun = false, env = process.env, record = true, settings = null, sourceRoot = sourceRootOf() } = {}) {
  const list = repos ?? defaultPushRepos(settings ?? supervisorSettings(), { sourceRoot });
  const results = list.map((repo) => pushMain(path.resolve(repo), { dryRun }));
  if (record && !dryRun) {
    try {
      const ledger = openSupervisorLedger({ env });
      try { ledger.transaction(() => { for (const r of results) supervisorEvent(ledger, { entityType: 'push', entityId: r.repo, kind: r.pushed ? 'push-main' : r.deferred ? 'push-deferred' : r.skipped ? 'push-skipped' : 'push-refused', payload: { ...r, scan: r.scan ? { ok: r.scan.ok, files: r.scan.files, findings: r.scan.findings.length } : undefined } }); }); }
      finally { ledger.close(); }
    } catch { /* recording is best effort */ }
  }
  return results;
}

export const describePush = (r) => `${path.basename(r.repo)}: ${r.pushed ? `pushed ${r.ahead} commit(s) -> ${r.head}` : r.wouldPush ? `would push ${r.ahead}` : r.deferred ? `deferred: ${r.deferred}` : r.skipped ? r.skipped : r.refused ? `REFUSED ${r.refused}${(r.scan?.findings ?? []).map((f) => ` [${f.file}:${f.line ?? '-'} ${f.pattern}]`).join('')}` : `FAILED ${r.error ?? ''}`}`;

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [argv[i + 1]] : []));
  const results = pushMains({ repos: repos.length ? repos : null, dryRun: argv.includes('--dry-run') });
  supervisorLog('push', results.map(describePush).join(' ; '));
  console.log(argv.includes('--json') ? JSON.stringify(results) : results.map(describePush).join('\n'));
  if (results.some((r) => r.refused || r.error)) process.exitCode = 1;
}
