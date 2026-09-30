#!/usr/bin/env node
// push-mains.mjs — the Supervisor pushes main of the runtime and of every product repository each tick
// (modules/supervisor/supervise.yaml kernelSeat, owner 2026-09-24). Secret scan first, hooks on:
// never --no-verify, never force, never a branch other than main, never a repository not listed.
//
//   node scripts/supervisor/push-mains.mjs [--repo <path>]... [--dry-run] [--hooks-only] [--json]
//       default repositories: the runtime (.claude) plus one app checkout per
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
// (husky: nivo-backend `npm run lint && npm run test:unit`, nivo-fe turbo lint) red for reasons
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
// not at all, never copied; the scratch is made on the checkout's own volume — the temp dir, or `.starci-tmp`
// at that volume's root — because file symlinks need a privilege Windows withholds and hard links cannot
// cross volumes. A repository whose scratch cannot be prepared reports `deferred: in-flight tree` while `git status --porcelain --untracked-files=no`
// shows tracked modifications — never FAILED, so a tick separates a red main from a busy tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { getBlob, putBlob } from '../lib/artifact-store.mjs';
import { redactText } from '../lib/redact.mjs';
import {sha256} from '../../engine/digest.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { git } from './workers.mjs';
import { projectBinding } from '../kernel/target-repo.mjs';
import { SKILL_ROOT, readSupervisor, withSupervisor, supervisorSettings, productRepos, supervisorLog } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);

// The secret scan's patterns live in scripts/lib/secret-patterns.mjs, so the typed-log redaction
// (scripts/kernel/typed-logs.mjs) imports the very same rules without loading the supervisor.
import { FORBIDDEN_FILES, SECRET_PATTERNS, secretHits } from '../lib/secret-patterns.mjs';
import { slash } from '../lib/path-key.mjs';
import { isSopsEnvelope, setCommand } from '../lib/test-secrets.mjs';
import { starciSourceRoot } from '../lib/hk-orphan-ledgers.mjs';
export { FORBIDDEN_FILES, SECRET_PATTERNS };

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
 *  plaintext value (scripts/lib/test-secrets.mjs isSopsEnvelope) - judged on the whole file at the pushed commit
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
export const TEST_SECRET_HINT = `move it to .starcistacks/<stack>/secrets/test/<name> and encrypt it with the repository's own command (${setCommand('<name>', '<stack>')}; commit only the .enc, read it with testSecret() from scripts/lib/test-secrets.mjs) or generate it per run; never a plaintext literal`;
export const scanHint = (findings = []) => (findings.some((f) => f.pattern === 'assigned-secret') ? TEST_SECRET_HINT : null);

/** Feed a file's lines to `onLine` in bounded chunks. An outgoing range can be hundreds of MB of diff
 *  (nivo-backend 2026-09-27: 334 commits, 567 MB of evidence JSON), past any spawn buffer and V8's string cap. */
export function forEachFileLine(file, onLine, { chunkBytes = 8 * 1024 * 1024 } = {}) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(chunkBytes);
    let carry = '';
    for (;;) {
      const n = fs.readSync(fd, buf, 0, chunkBytes, null);
      if (n <= 0) break;
      const lines = (carry + buf.toString('utf8', 0, n)).split(/\r?\n/);
      carry = lines.pop();
      for (const l of lines) onLine(l);
    }
    if (carry) onLine(carry);
  } finally { fs.closeSync(fd); }
}

/** Scan the range `from..to` of `cwd`: {ok, findings, files}. The diff is written to a temp file and read
 *  in chunks, never held whole in a spawn buffer (a 64 MB overflow read as `scan failed: git diff failed`). */
export function scanRange({ cwd, from, to }) {
  const names = git(['diff', '--name-only', '--diff-filter=ACMR', `${from}..${to}`], { cwd });
  if (!names.ok) return { ok: false, error: names.stderr || names.error || 'git diff failed', findings: [] };
  const files = names.stdout.split(/\r?\n/).filter(Boolean);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-push-scan-'));
  const out = path.join(dir, 'range.diff');
  try {
    const diff = git(['diff', '--no-color', '--unified=0', '--diff-filter=ACMR', `--output=${out}`, `${from}..${to}`], { cwd });
    if (!diff.ok) return { ok: false, error: diff.stderr || diff.error || 'git diff failed', findings: [] };
    const encText = (f) => { const r = git(['show', `${to}:${f}`], { cwd }); return r.ok ? r.stdout : null; };
    const scanner = diffScanner(files, { encText });
    forEachFileLine(out, (l) => scanner.line(l));
    return { ok: scanner.findings.length === 0, findings: scanner.findings, files };
  } finally { safeRemoveTree(dir); }
}

const SCAN_ALLOW_FILE = path.join(SKILL_ROOT, 'modules', 'supervisor', 'push-scan-allow.yaml');

/** The owner-approved exemptions (modules/supervisor/push-scan-allow.yaml): each names one repository (by
 *  checkout folder name), one file and one pattern. A forbidden-file finding (line null) is never exempt. */
export function scanAllowEntries(file = SCAN_ALLOW_FILE) {
  try {
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    return (Array.isArray(doc?.entries) ? doc.entries : []).filter((e) => e?.repo && e?.file && e?.pattern && e?.approvedBy === 'owner');
  } catch { return []; }
}

/** Whether an entry pinned to a historical range (`until: <sha>`, the last commit of the range that carries the
 *  literal) still applies: only while that commit exists and origin/main does not hold it yet. Once the range is
 *  pushed the entry is spent, so a later literal in the same file refuses the push again. Unpinned entries apply. */
export function scanAllowLive(repo, entry, { run = git } = {}) {
  if (!entry.until) return true;
  const r = run(['merge-base', '--is-ancestor', String(entry.until), 'refs/remotes/origin/main'], { cwd: repo });
  return r.status === 1;
}

/** Split findings into those still refusing the push and those an owner exemption covers. */
export function applyScanAllow(repo, findings = [], entries = scanAllowEntries(), { run = git } = {}) {
  const name = path.basename(path.resolve(String(repo)));
  const live = entries.filter((e) => e.repo === name && scanAllowLive(repo, e, { run }));
  const exempt = (f) => f.line !== null && live.some((e) => e.pattern === f.pattern && e.file === slash(String(f.file ?? '')));
  return { findings: findings.filter((f) => !exempt(f)), exempted: findings.filter(exempt) };
}

/** Push one repository's main (see the header). `dryRun` stops after the scan. Never throws. */
export function pushMain(repo, { dryRun = false, hooksOnly = false, run = git, scratchPush = null, prior = null, now = Date.now() } = {}) {
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
    // MB-07: the head is known on every outcome (a refused push too), so a refusal's Decision Item names it.
    out.head = fullHeadOf(repo, run);
    if (!hooksOnly && !dryRun && ahead) {
      const held = refusalHold(prior, { head: out.head, now });
      if (held.hold) return { ...out, held: true, skipped: `refused at this head ${held.repeat}x (${held.signature}); next try after ${new Date(held.until).toISOString()}`, signature: held.signature, repeat: held.repeat };
      if (prior?.head === out.head && prior?.signature) out.repeat = (held.repeat ?? 1) + 1;
    }
    if (hooksOnly) {
      const hooks = (scratchPush ?? pushFromScratch)(repo, { run, hooksOnly: true });
      const green = hooks.ok && hooks.green;
      return { ...out, via: 'scratch', hooksOnly: true, scratch: hooks.scratch, linked: hooks.linked, hooks: hooks.ok ? (green ? 'green' : 'red') : 'unavailable', ...(green ? {} : { error: hooks.error }) };
    }
    if (!ahead) return { ...out, skipped: 'up to date' };
    const raw = scanRange({ cwd: repo, from: 'origin/main', to: 'main' });
    const allowed = raw.error ? { findings: raw.findings, exempted: [] } : applyScanAllow(repo, raw.findings, scanAllowEntries(), { run });
    const scan = { ...raw, findings: allowed.findings, ok: !raw.error && allowed.findings.length === 0 };
    out.scan = { ok: scan.ok, files: scan.files?.length ?? 0, findings: scan.findings, ...(allowed.exempted.length ? { exempted: allowed.exempted } : {}) };
    if (!scan.ok) {
      const hint = scan.error ? null : scanHint(scan.findings);
      const signature = scan.error ? 'secret-scan:failed' : `secret-scan:${[...new Set(scan.findings.map((f) => f.pattern))].sort().join('+')}`;
      return { ...out, refused: scan.error ? `scan failed: ${scan.error}` : 'secret scan found candidates (file/line/pattern only)', signature, ...(hint ? { hint } : {}) };
    }
    if (dryRun) return { ...out, wouldPush: true };
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
  } catch (error) { return { ...out, error: String(error?.message ?? error) }; }
}

const headOf = (repo, run) => run(['rev-parse', '--short', 'main'], { cwd: repo }).stdout;
const fullHeadOf = (repo, run) => run(['rev-parse', 'main'], { cwd: repo }).stdout || null;

/** MB-03: a push (with its pre-push hook: nivo-backend's Jest alone takes ~4 min) may run this long; a timeout is its own reason. */
export const PUSH_TIMEOUT_MS = 600_000;
/** MB-03: a refusal identical to the previous one (same head, same signature) is not re-run before base x 2^(n-1), capped. */
export const REFUSAL_BACKOFF = Object.freeze({ baseMs: 1_800_000, maxMs: 86_400_000 });

const outputOf = (r) => [r?.stdout, r?.stderr, r?.error].filter(Boolean).join('\n');
const WHY_LINE = /\b(?:error|errors|failed|failure|fail|rejected|denied|refused|timed out|ERR!)\b|✖|×/i;

/** The lines that say why a push failed: its error/fail lines (at most 8), else its last 8 lines. Pure. */
export function failureSummary(text, { max = 8 } = {}) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const why = lines.filter((l) => WHY_LINE.test(l));
  // The error lines first, then the tail (a hook's own last words: `LINT_ERROR ...`, a failing suite), once each.
  return [...new Set([...why.slice(0, max), ...lines.slice(-6)])].join(' | ').slice(0, 1200) || 'push failed';
}

/**
 * A stable failure signature: what failed, never the HEAD, a sha, a time or a count, so the same failure on a new
 * commit signs the same and a changed failure signs differently (MB-03, MB-07). Pure over the git result and its text.
 */
export function failureSignature(r, text = outputOf(r)) {
  if (r?.timedOut) return `timeout:${Math.round((Number(r.timeoutMs) || PUSH_TIMEOUT_MS) / 1000)}s`;
  const t = String(text ?? '');
  if (/non-fast-forward|\[rejected\]|fetch first/i.test(t)) return 'rejected:non-fast-forward';
  if (/\b(?:HTTP )?5\d\d\b.*(?:gateway|unavailable|error)|RPC failed|Bad Gateway|Service Unavailable/i.test(t)) return 'remote:unavailable';
  if (/permission denied|Authentication failed|\b403\b/i.test(t)) return 'remote:denied';
  const task = /(\S+#[\w:-]+?):?\s+(?:command\b[^\n]*exited \(\d+\)|failed|ERR|error)/i.exec(t) ?? /ERR!?\s+(\S+#[\w:-]+)/.exec(t);
  if (task) return `task:${task[1]}`;
  const jest = /^\s*FAIL\s+(\S+\.(?:spec|test)\.[cm]?[jt]sx?)/m.exec(t);
  if (jest) return `jest:${path.basename(jest[1])}`;
  const tsc = /error (TS\d+)/.exec(t);
  if (tsc) return `tsc:${tsc[1]}`;
  const script = /npm ERR! (?:code|Lifecycle script) "?([\w:-]+)"?/.exec(t) ?? /Lifecycle script `([\w:-]+)` failed/.exec(t);
  if (script) return `npm:${script[1]}`;
  const norm = failureSummary(t).replace(/'[^'\n]*'|"[^"\n]*"/g, "'…'").replace(/[0-9a-f]{7,64}/gi, '#').replace(/\d+/g, 'N').replace(/[A-Z]:\\[^\s|]+|\/(?:tmp|var)\/[^\s|]+/g, '<path>');
  return `other:${sha256(norm).slice(0, 12)}`;
}

/** The full (redacted) push/hook output as a blob: {sha, bytes} or null (the store refused). Never throws. */
export function storeOutput(text, { put = null } = {}) {
  if (!String(text ?? '').trim()) return null;
  try {
    const bytes = Buffer.from(redactText(String(text)), 'utf8');
    const r = (put ?? putBlob)(bytes, { mediaType: 'text/plain; charset=utf-8' });
    return r?.sha ? { sha: r.sha, bytes: bytes.length } : null;
  } catch { return null; }
}

/**
 * A failed push/hook result's fields: the summary line, the stable signature, the full output blob and (MB-03, the
 * pushes row) the full stdout and stderr blobs.
 */
const failureOf = (r, { store = storeOutput } = {}) => {
  const text = outputOf(r);
  const blob = store(text);
  const stdout = store(r?.stdout), stderr = store([r?.stderr, r?.error].filter(Boolean).join('\n'));
  return { error: r?.timedOut ? `timed out after ${Math.round((Number(r.timeoutMs) || PUSH_TIMEOUT_MS) / 1000)}s: ${failureSummary(text)}` : failureSummary(text),
    signature: failureSignature(r, text), ...(blob ? { outputSha: blob.sha, outputBytes: blob.bytes } : {}),
    ...(stdout ? { stdoutSha: stdout.sha } : {}), ...(stderr ? { stderrSha: stderr.sha } : {}) };
};

/**
 * MB-03: whether `repo`'s push is held back because the last attempt was refused at the same head: {hold: true, until,
 * repeat, signature} while inside the backoff, else {hold: false}. `prior` = the last refusal {head, signature, at,
 * repeat}. Pure.
 */
export function refusalHold(prior, { head, now = Date.now(), backoff = REFUSAL_BACKOFF } = {}) {
  if (!prior?.head || !head || prior.head !== head || !prior.signature) return { hold: false };
  const repeat = Math.max(1, Number(prior.repeat) || 1);
  const until = Number(prior.at) + Math.min(backoff.maxMs, backoff.baseMs * 2 ** (repeat - 1));
  return now < until ? { hold: true, until, repeat, signature: prior.signature } : { hold: false, repeat };
}
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
export const LOCAL_STATE_EXCLUDED = /^(?:dist|build|coverage|\.turbo|\.next|\.scannerwork|test-results|tmp|target|\.git)$|\.log$/i;

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

/** Where a repository's scratch goes: the system temp dir when it shares the checkout's volume, else
 *  `.starci-tmp` at that volume's root — a hard link cannot cross volumes. Never under the git dir: jest's
 *  haste map ignores every path with a `.git` segment and finds no tests there (nivo-backend, 2026-09-24). */
const scratchBaseOf = (repo) => {
  const tmp = os.tmpdir();
  const volume = (p) => path.parse(path.resolve(p)).root.toLowerCase();
  if (volume(repo) !== volume(tmp)) {
    try {
      const parent = path.join(path.parse(path.resolve(repo)).root, '.starci-tmp');
      fs.mkdirSync(parent, { recursive: true });
      return fs.mkdtempSync(path.join(parent, 'starci-push-'));
    } catch { /* the temp dir below; files then fall back to copy, secrets to nothing */ }
  }
  return fs.mkdtempSync(path.join(tmp, 'starci-push-'));
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
  const base = scratch ?? scratchBaseOf(repo);
  const worktree = path.join(base, 'wt');
  const links = [];
  const cleanup = () => {
    for (const link of links.splice(0).reverse()) unlinkLink(link);
    // Never `git worktree remove --force` or a recursive rmSync: Git for Windows follows a junction left in
    // the worktree into the live checkout (nivo-fe inc-c8fbf76aa499). safeRemoveTree unlinks any link it
    // meets (recorded or not) and never descends into one; prune drops the registration.
    try { safeRemoveTree(worktree); } catch { /* best effort */ }
    try { run(['worktree', 'prune'], { cwd: repo }); } catch { /* best effort */ }
    try { safeRemoveTree(base); } catch { /* best effort */ }
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
      const hook = run(['hook', 'run', '--ignore-missing', 'pre-push', '--', 'origin', url.ok ? url.stdout : 'origin'], { cwd: worktree, input: '', timeoutMs: PUSH_TIMEOUT_MS });
      const out = { ok: true, green: hook.ok, scratch: base, linked };
      if (!hook.ok) Object.assign(out, failureOf(hook));
      cleanup();
      return out;
    }
    // The hook's stdout is kept too (MB-03: husky prints the failing lint/test there, while stderr alone said only
    // "failed to push some refs"), in full, as a blob.
    const pushed = run(['push', 'origin', 'main'], { cwd: worktree, timeoutMs: PUSH_TIMEOUT_MS });
    const out = { ok: true, pushed: pushed.ok, scratch: base, linked };
    if (pushed.ok) out.head = headOf(worktree, run);
    else Object.assign(out, failureOf(pushed));
    cleanup();
    return out;
  } catch (error) { return unavailable(String(error?.message ?? error)); }
}

const canonical = (p) => { const resolved = path.resolve(p); try { return fs.realpathSync.native(resolved); } catch { return resolved; } };
const repoKey = (p) => (process.platform === 'win32' ? canonical(p).toLowerCase() : canonical(p));

/**
 * The app repository the ledger owner `repo` binds in work.json. [] when no
 * binding names `repo`.
 */
export function boundRepos(repo, { sourceRoot = starciSourceRoot() } = {}) {
  const app = projectBinding(repo, { sourceRoot })?.appRoot;
  return app ? [app] : [];
}

/**
 * The default push set: the runtime (.claude), each config supervisor.repos ledger owner, and every
 * app repository each owner binds. Canonical-deduped: an app root already in
 * supervisor.repos is pushed once.
 */
export function defaultPushRepos(settings = supervisorSettings(), { sourceRoot = starciSourceRoot() } = {}) {
  const seen = new Map();
  const add = (repo) => { const k = repoKey(repo); if (!seen.has(k)) seen.set(k, path.resolve(repo)); };
  add(SKILL_ROOT);
  for (const owner of productRepos(settings, { sourceRoot })) {
    add(boundRepos(owner, { sourceRoot })[0] ?? owner);
  }
  return [...seen.values()];
}

/**
 * MB-03: the last push outcome per repository when it was a refusal with a signature: Map(repoKey -> {head, signature,
 * at, repeat}). A later successful push clears it. Never throws.
 */
export function lastRefusals({ env = process.env } = {}) {
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
      for (const x of rows.filter((y) => y.key === r.key)) { if (x.result === 'pushed' || x.head !== r.head || x.failure_signature !== r.failure_signature) break; repeat += 1; }
      out.set(r.key, { head: r.head, signature: r.failure_signature, at: Number(r.at), repeat: repeat || 1 });
    }
  } catch { /* no history: every push runs */ }
  return out;
}

/** The pushes.result of one pushMain result. */
const pushResultOf = (r) => (r.pushed ? 'pushed' : r.skipped || r.deferred ? 'skipped' : r.refused ? 'refused' : 'failed');
const blobText = (sha) => { if (!sha) return null; try { return getBlob(sha).toString('utf8'); } catch { return null; } };

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

export const describePush = (r) => `${path.basename(r.repo)}: ${r.hooksOnly ? `pre-push hook on main ${r.hooks === 'green' ? 'green' : `${String(r.hooks).toUpperCase()} ${r.error ?? ''}`} (${r.linked?.length ?? 0} local-state link(s))` : r.pushed ? `pushed ${r.ahead} commit(s) -> ${r.head}` : r.wouldPush ? `would push ${r.ahead}` : r.deferred ? `deferred: ${r.deferred}` : r.skipped ? r.skipped : r.refused ? `REFUSED ${r.refused}${(r.scan?.findings ?? []).map((f) => ` [${f.file}:${f.line ?? '-'} ${f.pattern}]`).join('')}${r.hint ? ` - ${r.hint}` : ''}` : `FAILED ${r.error ?? ''}`}`;

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [argv[i + 1]] : []));
  const results = pushMains({ repos: repos.length ? repos : null, dryRun: argv.includes('--dry-run'), hooksOnly: argv.includes('--hooks-only') });
  supervisorLog('push', results.map(describePush).join(' ; '));
  console.log(argv.includes('--json') ? JSON.stringify(results) : results.map(describePush).join('\n'));
  if (results.some((r) => r.refused || r.error)) process.exitCode = 1;
}
