// hfs work-hygiene: the guard for the two trees a back end tracks besides source. A file under .starciwork must be
// product content (the .starciwork/.gitignore allowlist admits it, so agent output is refused), and a file under
// .starcistacks must not be a plaintext secret (only *.enc is sealed). The pre-commit hook judges the staged files;
// scripts/checks/check-hfs-sync.mjs judges every tracked file.
//
// When this package runs from inside its own runtime checkout (packages/hfs lives 3 directories under the repo
// root), it also reports the state-root ledger findings of scripts/lib/hk-orphan-ledgers.mjs: LEDGER_ORPHAN_STATE_ROOT
// and LEDGER_LEGACY_WORK_SQLITE (COOK-BRIEF F4 handover, incident 2026-09-30). Installed standalone in a product
// repository with no such checkout, that section is silently absent — never a crash, never a false negative claimed.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLAINTEXT_NAME = /(^|\/)(\.env(\..*)?|[^/]*\.(pem|key|identity|age))$/;
const GUARDED = file => file.startsWith('.starciwork/') || file.startsWith('.starcistacks/');

/** The subset of `files` git ignores (as if untracked), asked in one call: a Set of paths. */
export function ignoredAmong(cwd, files) {
  if (files.length === 0) return new Set();
  try {
    const out = execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], { cwd, input: files.join('\0'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return new Set(out.split('\0').filter(Boolean));
  } catch (error) {
    if (error.status === 1) return new Set();
    throw error;
  }
}

/** Violations among `files` (repository-relative, '/'-separated): [{ file, code, message }]. `ignored` is a Set of ignored paths. */
export function hygieneFindings(files, ignored) {
  const findings = [];
  for (const file of files) {
    if (file.startsWith('.starciwork/') && ignored.has(file)) {
      findings.push({ file, code: 'HFS_WORK_AGENT_DATA', message: 'is agent output, which .starciwork/.gitignore refuses; keep it in the scratchpad or the blob store' });
    }
    if (file.startsWith('.starcistacks/') && !file.endsWith('.enc') && !file.endsWith('.env.example')) {
      if (file.includes('/secrets/')) findings.push({ file, code: 'HFS_PLAINTEXT_SECRET', message: 'sits under secrets/ but is not sealed; only <slug>.enc may be tracked' });
      else if (PLAINTEXT_NAME.test(file)) findings.push({ file, code: 'HFS_PLAINTEXT_SECRET', message: 'is a plaintext secret; seal it to .starcistacks/<env>/secrets/<slug>.enc' });
    }
  }
  return findings;
}

const gitList = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

/** Files staged for the next commit (added, copied, modified, renamed). */
export const stagedFiles = cwd => gitList(cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);

/** Every tracked file. */
export const trackedFiles = cwd => gitList(cwd, ['ls-files', '-z']);

/** Findings for `files` after keeping only the guarded trees. */
export function judge(cwd, files) {
  const guarded = files.filter(GUARDED);
  return { checked: guarded.length, findings: hygieneFindings(guarded, ignoredAmong(cwd, guarded.filter(file => file.startsWith('.starciwork/')))) };
}

// The sibling scripts/checks/ledger-hygiene.mjs, 3 directories up from this file when it runs inside its own full
// runtime checkout (packages/hfs/sync/ -> ../../.. is the repo root, the same computation
// packages/hfs/scripts/sync-runtime.mjs uses). Installed standalone (no such checkout), it does not exist and this
// section is silently absent — never a crash, never a false claim about a store this install cannot see.
const RUNTIME_LEDGER_HYGIENE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'checks', 'ledger-hygiene.mjs');

/**
 * The state-root ledger findings (LEDGER_ORPHAN_STATE_ROOT, LEDGER_LEGACY_WORK_SQLITE) as {code, file, message}
 * entries, when this install can reach the sibling runtime script; [] otherwise. Never throws: a report failure is
 * one HFS_LEDGER_HYGIENE_UNAVAILABLE finding, not a crash of `hfs work-hygiene`.
 */
export async function ledgerHygieneFindings() {
  if (!fs.existsSync(RUNTIME_LEDGER_HYGIENE)) return [];
  try {
    const { ledgerHygieneReport } = await import(pathToFileURL(RUNTIME_LEDGER_HYGIENE).href);
    const report = await ledgerHygieneReport({ apply: false });
    return [
      ...report.orphans.map(o => ({ code: o.code, file: o.ledgerId, message: `ledger ${o.name ?? o.ledgerId} - ${o.reason}; source roots: ${o.sourceRoots.join(', ') || '(none)'}` })),
      ...report.legacy.map(l => ({ code: l.code, file: l.repoRoot, message: `${l.files.length} legacy file(s) still in the repo: ${l.files.join(', ')}` })),
    ];
  } catch (error) {
    return [{ code: 'HFS_LEDGER_HYGIENE_UNAVAILABLE', file: RUNTIME_LEDGER_HYGIENE, message: `could not run: ${String(error?.message ?? error).slice(0, 200)}` }];
  }
}

/** `hfs work-hygiene`: checks the staged files, plus the state-root ledger findings when reachable; returns the exit code. */
export async function runWorkHygiene({ cwd = process.cwd(), out = line => process.stdout.write(`${line}\n`), files } = {}) {
  const { checked, findings } = judge(cwd, files ?? stagedFiles(cwd));
  const ledgerFindings = await ledgerHygieneFindings();
  const all = [...findings, ...ledgerFindings];
  for (const finding of all) out(`${finding.code} ${finding.file} ${finding.message}`);
  out(`hfs work-hygiene: ${checked} staged file(s) checked, ${findings.length} finding(s), ${ledgerFindings.length} ledger finding(s)`);
  return all.length ? 1 : 0;
}
