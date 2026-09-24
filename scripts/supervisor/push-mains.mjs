#!/usr/bin/env node
// push-mains.mjs — the Supervisor pushes main of the runtime and of every product repository each tick
// (modules/supervisor/supervise.yaml kernelSeat, owner 2026-09-24). Secret scan first, hooks on:
// never --no-verify, never force, never a branch other than main, never a repository not listed.
//
//   node scripts/supervisor/push-mains.mjs [--repo <path>]... [--dry-run] [--json]
//       default repositories: the runtime (.claude) plus config.yaml supervisor.repos
//
// Per repository: main must be the checked-out branch's upstream-tracked main with commits ahead of
// origin/main (nothing ahead = nothing to do). The outgoing range origin/main..main is scanned: a forbidden
// file (an env file, a private key, a credentials JSON, anything under .secrets/) or an added line matching a
// secret pattern refuses the push. Findings name the file, line and pattern, NEVER the value. A push the
// remote refuses (non-fast-forward, a red pre-push hook) is reported, never retried with force.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './workers.mjs';
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
  { name: 'assigned-secret', re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"]([^'"\s$<{]{12,})['"]/i, placeholder: /fixture|stub|fake|dummy|placeholder|example|sample|changeme|redacted|mock/i },
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
export function pushMain(repo, { dryRun = false, run = git } = {}) {
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
    const pushed = run(['push', 'origin', 'main'], { cwd: repo });
    out.pushed = pushed.ok;
    if (!pushed.ok) out.error = (pushed.stderr || pushed.error || 'push failed').split(/\r?\n/).slice(-6).join(' | ').slice(0, 600);
    else out.head = run(['rev-parse', '--short', 'main'], { cwd: repo }).stdout;
    return out;
  } catch (error) { return { ...out, error: String(error?.message ?? error) }; }
}

/** Push every listed main and record one push event per repository in the supervisor ledger. */
export function pushMains({ repos = null, dryRun = false, env = process.env, record = true } = {}) {
  const list = repos ?? [SKILL_ROOT, ...productRepos(supervisorSettings())];
  const results = list.map((repo) => pushMain(path.resolve(repo), { dryRun }));
  if (record && !dryRun) {
    try {
      const ledger = openSupervisorLedger({ env });
      try { ledger.transaction(() => { for (const r of results) supervisorEvent(ledger, { entityType: 'push', entityId: r.repo, kind: r.pushed ? 'push-main' : r.skipped ? 'push-skipped' : 'push-refused', payload: { ...r, scan: r.scan ? { ok: r.scan.ok, files: r.scan.files, findings: r.scan.findings.length } : undefined } }); }); }
      finally { ledger.close(); }
    } catch { /* recording is best effort */ }
  }
  return results;
}

export const describePush = (r) => `${path.basename(r.repo)}: ${r.pushed ? `pushed ${r.ahead} commit(s) -> ${r.head}` : r.wouldPush ? `would push ${r.ahead}` : r.skipped ? r.skipped : r.refused ? `REFUSED ${r.refused}${(r.scan?.findings ?? []).map((f) => ` [${f.file}:${f.line ?? '-'} ${f.pattern}]`).join('')}` : `FAILED ${r.error ?? ''}`}`;

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [argv[i + 1]] : []));
  const results = pushMains({ repos: repos.length ? repos : null, dryRun: argv.includes('--dry-run') });
  supervisorLog('push', results.map(describePush).join(' ; '));
  console.log(argv.includes('--json') ? JSON.stringify(results) : results.map(describePush).join('\n'));
  if (results.some((r) => r.refused || r.error)) process.exitCode = 1;
}
