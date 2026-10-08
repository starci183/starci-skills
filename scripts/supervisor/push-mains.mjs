#!/usr/bin/env node
// starci supervisor push-mains — the Supervisor pushes main of every product repository each tick
// (modules/supervisor/supervise.yaml kernelSeat, owner 2026-09-24). Secret scan first, hooks on:
// never --no-verify, never force, never a branch other than main, never a repository not listed.
//
//   starci supervisor push-mains [--repo <path>]... [--dry-run] [--hooks-only] [--json]
//       default repositories: one app checkout per
//       configured project binding (.workspaces/projects/<p>/work.json —
//       scripts/kernel/target-repo.mjs projectBinding)
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
// (husky: `npm run lint && npm run test:unit`, turbo lint) red for reasons
// unrelated to the commits being pushed — while one op is mid-edit that repo never pushes (cluster
// push-hooks-test-inflight-tree: 42 unit failures that lived only in uncommitted edits).
// The scratch installs its own dependencies (npm ci from the cache; never a link to the live node_modules) and gets
// a relative core.hooksPath by DIRECTORY LINK, so hooks stay ON and judge the commit; it is removed whatever
// happens, its links first so a forced removal can never walk into the live tree. The rest of the live
// checkout's git-ignored LOCAL STATE the hook's tests read is mirrored the same way, discovered by
// `git ls-files --others --ignored --exclude-standard --directory`, never a hard-coded list (cluster
// push-scratch-local-mounts: a product repo's hook was red on a clean scratch of main for
// the `.gitmounts/data` clone, `.env.override` and `.starcistacks/<env>/runtime/files/*` it lacked): each
// entry is linked at its shallowest path the scratch does not hold — a directory by junction/symlink, a file
// by hard link — build and tool output excluded (LOCAL_STATE_EXCLUDED). A secret file is linked in place or
// not at all, never copied; the scratch is made on the checkout's own volume — the temp dir, or `.starci-tmp`
// at that volume's root — because file symlinks need a privilege Windows withholds and hard links cannot
// cross volumes. A repository whose scratch cannot be prepared reports `deferred: in-flight tree` while `git status --porcelain --untracked-files=no`
// shows tracked modifications — never FAILED, so a tick separates a red main from a busy tree.
import fs from 'node:fs';
import path from 'node:path';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { getBlob } from '../../engine/db/blob.mjs';
import { git } from './workers.mjs';
import { failureOf, failureSignature, PUSH_TIMEOUT_MS } from './push-failure.mjs';
import { pushFromScratch } from './push-scratch.mjs';
import { projectBinding } from '../kernel/target-repo.mjs';
import { SKILL_ROOT, readSupervisor, withSupervisor, supervisorSettings, productRepos, supervisorLog } from '../machine/home.mjs';


// The secret scan's patterns live in scripts/lib/secret-patterns.mjs, so the typed-log redaction
// (scripts/kernel/typed-logs.mjs) imports the very same rules without loading the supervisor.
import { FORBIDDEN_FILES, secretHits } from '../lib/secret-patterns.mjs';
import { foldCase, realPath, slash } from '../lib/path-key.mjs';
import { isSopsEnvelope, setCommand } from '../lib/sops-envelope.mjs';
import { forEachFileLine } from '../lib/read-text.mjs';
import { starciSourceRoot } from '../../engine/runtime-root.mjs'; import { isMain } from '../lib/is-main.mjs'; import { byCodeUnit } from '../lib/list.mjs'; import { describePush } from './push-description.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
export { FORBIDDEN_FILES }; export { SECRET_PATTERNS } from '../lib/secret-patterns.mjs';

/**
 * Scan a unified diff (added lines only) and its file list. Returns [{file, line, pattern}] - never the value.
 * `files` are the changed paths (status A/M/R); deleted paths are not scanned.
 */
export function scanDiff({ diff = '', files = [] } = {}) {
  const scanner = diffScanner(files);
  for (const raw of String(diff).split(/\r?\n/)) scanner.line(raw);
  return scanner.findings;
}

/** scanDiff one line at a time: feed each diff line to `line(raw)`; `findings` accumulates.
 *  A `*.enc` file is held back until its diff ends and passes only when it is a sops-encrypted file with no
 *  plaintext value (scripts/lib/sops-envelope.mjs isSopsEnvelope) - judged on the whole file at the pushed commit
 *  when `encText(file)` can read it (a --unified=0 diff of an edited sops YAML holds only its changed lines), else
 *  on its added lines. Anything else in a `.enc` file is scanned like any other file, and a `.enc` under
 *  `.starcistacks/` that is not a sops envelope refuses the push by itself (sops-not-envelope). */
export function diffScanner(files = [], { encText = null } = {}) {
  const findings = [];
  for (const file of files) for (const rule of FORBIDDEN_FILES) if (rule.test(slash(file))) findings.push({ file, line: null, pattern: rule.name });
  let file = null, line = 0, enc = null;
  const flushEnc = () => {
    if (enc && !isSopsEnvelope((encText ? encText(enc.file) : null) ?? enc.added.join('\n'))) {
      findings.push(...enc.findings);
      // .starcistacks holds sops twins only: anything else there (a JSON key the value rules cannot see, a
      // plaintext value next to the sops block) refuses the push by itself.
      if (/(^|\/)\.starcistacks\//i.test(enc.file)) findings.push({ file: enc.file, line: enc.line, pattern: 'sops-not-envelope' });
    }
    enc = null;
  };
  return {
    get findings() { flushEnc(); return findings; },
    line(raw) {
      if (raw.startsWith('+++ ')) {
        flushEnc();
        file = raw.slice(4).replace(/^b\//, '');
        if (/\.enc$/i.test(file)) enc = { file, line: null, added: [], findings: [] };
        return;
      }
      const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (hunk) { line = Number(hunk[1]); return; }
      if (raw.startsWith('+')) {
        const text = raw.slice(1);
        if (enc) { enc.added.push(text); enc.line ??= line; }
        for (const pattern of secretHits(file, text)) (enc ? enc.findings : findings).push({ file, line, pattern });
        line += 1;
      } else if (!raw.startsWith('-')) line += 1;
    },
  };
}

/** The one fix a refused plaintext test credential gets (owner ruling push-scan-test-secrets-encrypted): the product
 *  repository's own .starcistacks + sops convention, or a value generated per run. */
export const TEST_SECRET_HINT = `move it to .starcistacks/<stack>/secrets/test/<name> and encrypt it with the repository's own command (${setCommand('<name>', '<stack>')}; commit only the .enc, read it with testSecret() from scripts/uat/test-secret.mjs) or generate it per run; never a plaintext literal`;
export const scanHint = (findings = []) => (findings.some((f) => f.pattern === 'assigned-secret') ? TEST_SECRET_HINT : null);

/** Scan the range `from..to` of `cwd`: {ok, findings, files}. The diff is written to a temp file and read
 *  in chunks, never held whole in a spawn buffer (a 64 MB overflow read as `scan failed: git diff failed`). */
export function scanRange({ cwd, from, to }) {
  const names = git(['diff', '--name-only', '--diff-filter=ACMR', `${from}..${to}`], { cwd });
  if (!names.ok) return { ok: false, error: names.stderr || names.error || 'git diff failed', findings: [] };
  const files = names.stdout.split(/\r?\n/).filter(Boolean);
  const dir = makeTempDir('starci-push-scan-');
  const out = path.join(dir, 'range.diff');
  try {
    const diff = git(['diff', '--no-color', '--unified=0', '--diff-filter=ACMR', `--output=${out}`, `${from}..${to}`], { cwd });
    if (!diff.ok) return { ok: false, error: diff.stderr || diff.error || 'git diff failed', findings: [] };
    const encText = (f) => { const r = git(['show', `${to}:${f}`], { cwd }); return r.ok ? r.stdout : null; };
    const scanner = diffScanner(files, { encText });
    forEachFileLine(out, (l) => scanner.line(l));
    return { ok: scanner.findings.length === 0, findings: scanner.findings, files };
  } finally { safeRemove(dir, { hold: artifactHoldReason }); }
}

/** Why the runtime repository is never pushed here: the hook of that repository refuses every push of its main that is not a release. */
export const RUNTIME_RELEASE_ONLY = 'the runtime main moves only with a release: starci release cut --tag v<version>';

/** Push one repository's main (see the header). `dryRun` stops after the scan. Never throws. */
export function pushMain(repo, { dryRun = false, hooksOnly = false, run = git, scratchPush = null, prior = null, now = Date.now() } = {}) {
  const out = { repo, pushed: false };
  if (repoKey(repo) === repoKey(SKILL_ROOT)) return { ...out, skipped: RUNTIME_RELEASE_ONLY };
  try {
    const state = readPushState(repo, run);
    if (state.skipped) return { ...out, skipped: state.skipped };
    const { branch, ahead } = state;
    out.branch = branch || null;
    out.ahead = ahead;
    // MB-07: the head is known on every outcome (a refused push too), so a refusal's Decision Item names it.
    out.head = fullHeadOf(repo, run);
    if (!hooksOnly && !dryRun && ahead) {
      const held = heldOutcome(out, prior, now);
      if (held) return held;
    }
    if (hooksOnly) return hooksOnlyOutcome(out, repo, run, scratchPush);
    if (!ahead) return { ...out, skipped: 'up to date' };
    const refused = secretScanOutcome(out, repo);
    if (refused) return refused;
    if (dryRun) return { ...out, wouldPush: true };
    return pushOutcome(out, repo, run, scratchPush);
  } catch (error) { return { ...out, error: String(error?.message ?? error) }; }
}

/** What `repo` offers a push: {skipped: why it has nothing to push at all} or {branch, ahead}. */
function readPushState(repo, run) {
  if (!fs.existsSync(path.join(repo, '.git'))) return { skipped: 'not a git checkout' };
  const branch = run(['symbolic-ref', '--short', 'HEAD'], { cwd: repo }).stdout;
  const hasMain = run(['rev-parse', '--verify', '--quiet', 'refs/heads/main'], { cwd: repo }).ok;
  if (!hasMain) return { skipped: 'no main branch' };
  const remote = run(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: repo });
  if (!remote.ok) return { skipped: 'no origin/main' };
  const ahead = Number(run(['rev-list', '--count', 'origin/main..main'], { cwd: repo }).stdout) || 0;
  return { branch, ahead };
}

/** The held result while the last refusal at this head is inside its backoff, else null (a repeat is counted on `out`). */
function heldOutcome(out, prior, now) {
  const held = refusalHold(prior, { head: out.head, now });
  if (held.hold) return { ...out, held: true, skipped: `refused at this head ${held.repeat}x (${held.signature}); next try after ${new Date(held.until).toISOString()}`, signature: held.signature, repeat: held.repeat };
  if (prior?.head === out.head && prior?.signature) out.repeat = (held.repeat ?? 1) + 1;
  return null;
}

/** The result of --hooks-only: the pre-push hook run in a scratch of committed main, nothing pushed. */
function hooksOnlyOutcome(out, repo, run, scratchPush) {
  const hooks = (scratchPush ?? pushFromScratch)(repo, { run, hooksOnly: true });
  const green = hooks.ok && hooks.green;
  return { ...out, via: 'scratch', hooksOnly: true, scratch: hooks.scratch, linked: hooks.linked, hooks: (hooks.ok && green && 'green') || (hooks.ok && 'red') || 'unavailable', ...(green ? {} : { error: hooks.error }) };
}

/** Scan the outgoing range (recorded on `out.scan`): the refused result when it finds a candidate or fails, else null. */
function secretScanOutcome(out, repo) {
  const raw = scanRange({ cwd: repo, from: 'origin/main', to: 'main' });
  const scan = { ...raw, ok: !raw.error && raw.findings.length === 0 };
  out.scan = { ok: scan.ok, files: scan.files?.length ?? 0, findings: scan.findings };
  if (scan.ok) return null;
  const hint = scan.error ? null : scanHint(scan.findings);
  const signature = scan.error ? 'secret-scan:failed' : `secret-scan:${[...new Set(scan.findings.map((f) => f.pattern))].sort(byCodeUnit).join('+')}`;
  return { ...out, refused: scan.error ? `scan failed: ${scan.error}` : 'secret scan found candidates (file/line/pattern only)', signature, ...(hint ? { hint } : {}) };
}

/** The push itself: from a scratch of committed main, else (no scratch here) from the live tree unless it is mid-edit. */
function pushOutcome(out, repo, run, scratchPush) {
  const scratch = (scratchPush ?? pushFromScratch)(repo, { run });
  if (scratch.scratch) out.scratch = scratch.scratch;
  if (scratch.ok) {
    out.via = 'scratch';
    out.pushed = scratch.pushed;
    if (!scratch.pushed) Object.assign(out, { error: scratch.error, signature: scratch.signature ?? failureSignature({ stderr: scratch.error }), ...(scratch.outputSha ? { outputSha: scratch.outputSha, outputBytes: scratch.outputBytes } : {}) });
    return out;
  }
  // The scratch cannot be prepared here (no worktree, a refused link, no tool). Pushing from the live tree
  // judges the same thing as the commit only while nothing is modified; a modified tracked path is exactly
  // where the hook goes red for the worker's sake, so that is deferred, not a failed push.
  const dirty = trackedModifications(repo, run);
  if (dirty.length) return { ...out, via: 'live', deferred: 'in-flight tree', detail: dirty.slice(0, 5) };
  out.via = 'live';
  const pushed = run(['push', 'origin', 'main'], { cwd: repo, timeoutMs: PUSH_TIMEOUT_MS });
  out.pushed = pushed.ok;
  if (!pushed.ok) Object.assign(out, failureOf(pushed));
  return out;
}

const fullHeadOf = (repo, run) => run(['rev-parse', 'main'], { cwd: repo }).stdout || null;
/** MB-03: a refusal identical to the previous one (same head, same signature) is not re-run before base x 2^(n-1), capped. */
const REFUSAL_BACKOFF = Object.freeze({ baseMs: 1_800_000, maxMs: 86_400_000 });

/**
 * MB-03: whether `repo`'s push is held back because the last attempt was refused at the same head: {hold: true, until,
 * repeat, signature} while inside the backoff, else {hold: false}. `prior` = the last refusal {head, signature, at,
 * repeat}. Pure.
 */
function refusalHold(prior, { head, now = Date.now(), backoff = REFUSAL_BACKOFF } = {}) {
  if (!prior?.head || !head || prior.head !== head || !prior.signature) return { hold: false };
  const repeat = Math.max(1, Number(prior.repeat) || 1);
  const until = Number(prior.at) + Math.min(backoff.maxMs, backoff.baseMs * 2 ** (repeat - 1));
  return now < until ? { hold: true, until, repeat, signature: prior.signature } : { hold: false, repeat };
}
/** Paths `git status --porcelain --untracked-files=no` reports modified (tracked only; the status field
 *  is stripped, the helper trims the line so its 3-column offset cannot be counted on). */
const trackedModifications = (repo, run) => run(['status', '--porcelain', '--untracked-files=no'], { cwd: repo })
  .stdout.split(/\r?\n/).filter(Boolean).map((line) => line.replace(/^\s*[A-Z?!]{1,2}\s+/, '').trim());

const repoKey = (p) => foldCase(realPath(p));

/**
 * The app repository the ledger owner `repo` binds in work.json. [] when no
 * binding names `repo`.
 */
export function boundRepos(repo, { sourceRoot = starciSourceRoot() } = {}) {
  const app = projectBinding(repo, { sourceRoot })?.appRoot;
  return app ? [app] : [];
}

/**
 * The default push set: each config supervisor.repos ledger owner and every app repository each owner binds. The runtime
 * repository is not in it: its main moves only with a release (RUNTIME_RELEASE_ONLY). Canonical-deduped: an app root already in
 * supervisor.repos is pushed once.
 */
export function defaultPushRepos(settings = supervisorSettings(), { sourceRoot = starciSourceRoot() } = {}) {
  const seen = new Map();
  const add = (repo) => { const k = repoKey(repo); if (!seen.has(k)) seen.set(k, path.resolve(repo)); };
  for (const owner of productRepos(settings, { sourceRoot })) {
    add(boundRepos(owner, { sourceRoot })[0] ?? owner);
  }
  return [...seen.values()];
}

/**
 * MB-03: the last push outcome per repository when it was a refusal with a signature: Map(repoKey -> {head, signature,
 * at, repeat}). A later successful push clears it. Never throws.
 */
function lastRefusals({ env = process.env } = {}) {
  const out = new Map();
  try {
    // machine.sqlite pushes: a held (skipped) attempt is not an attempt; repeat = the consecutive refusals at that head.
    const rows = readSupervisor((m) => m.db.prepare("SELECT repo_root, head, result, failure_signature, at FROM pushes WHERE result IN ('pushed','refused','failed') ORDER BY push_id DESC LIMIT 400").all(), [], { env })
      .map((r) => ({ ...r, key: repoKey(r.repo_root) }));
    const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.key)) continue;
      seen.add(r.key);
      if (r.result === 'pushed' || !r.head || !r.failure_signature) continue;
      let repeat = 0;
      for (const x of rows.filter((y) => y.key === r.key)) { if (x.result === 'pushed' || x.head !== r.head || x.failure_signature !== r.failure_signature) { break; } repeat += 1; }
      out.set(r.key, { head: r.head, signature: r.failure_signature, at: Number(r.at), repeat: repeat || 1 });
    }
  } catch { /* no history: every push runs */ }
  return out;
}

/** The pushes.result of one pushMain result. */
const pushResultOf = (r) => (r.pushed && 'pushed') || ((r.skipped || r.deferred) && 'skipped') || (r.refused && 'refused') || 'failed';
const blobText = (sha) => { if (!sha) { return null; } try { return getBlob(sha).toString('utf8'); } catch { return null; } };

/** Push every listed main and record one pushes row per repository in machine.sqlite (MB-03: full stdout/stderr blobs). */
export function pushMains({ repos = null, dryRun = false, hooksOnly = false, env = process.env, record = true, settings = null, sourceRoot = starciSourceRoot() } = {}) {
  const list = repos ?? defaultPushRepos(settings ?? supervisorSettings(), { sourceRoot });
  const priors = record && !dryRun && !hooksOnly ? lastRefusals({ env }) : new Map();
  const results = list.map((repo) => pushMain(path.resolve(repo), { dryRun, hooksOnly, prior: priors.get(repoKey(path.resolve(repo))) ?? null }));
  if (record && !dryRun && !hooksOnly) {
    try {
      withSupervisor((m) => m.transaction(() => {
        for (const r of results) {
          const result = pushResultOf(r);
          m.recordPush({ repoRoot: r.repo, branch: r.branch ?? null, head: r.head ?? 'unknown', result, reason: r.refused ?? r.error ?? r.skipped ?? (r.deferred ? `deferred: ${r.deferred}` : null),
            failureSignature: r.signature ?? (result === 'refused' || result === 'failed' ? 'push:error' : null), scan: r.scan ?? null,
            stdout: blobText(r.stdoutSha), stderr: blobText(r.stderrSha) });
        }
      }), { env });
    } catch { /* recording is best effort */ }
  }
  return results;
}

export { describePush, pushFromScratch };

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [argv[i + 1]] : []));
  const results = pushMains({ repos: repos.length ? repos : null, dryRun: argv.includes('--dry-run'), hooksOnly: argv.includes('--hooks-only') });
  supervisorLog('push', results.map(describePush).join(' ; '));
  console.log(argv.includes('--json') ? JSON.stringify(results) : results.map(describePush).join('\n'));
  if (results.some((r) => r.refused || r.error)) process.exitCode = 1;
}
