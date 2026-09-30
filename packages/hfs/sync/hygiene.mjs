// hfs work-hygiene: the guard for the two trees a back end tracks besides source. A file under .starciwork must be
// product content (the .starciwork/.gitignore allowlist admits it, so agent output is refused), and a file under
// .starcistacks must not be a plaintext secret (only *.enc is sealed). It is also the secrets guard of the commit: every staged file, in
// any tree, is read from the index and judged with the one secret judgement of `hfs check` (scripts/lib/hfs-rules/secrets.mjs: a secret by
// being, an .enc that is no sops envelope, a line that matches a secret pattern), so no plaintext secret reaches the history whatever
// .gitignore says (`git add -f`, a path tracked before a rule tightened). There is no override. The pre-commit hook judges the staged
// files; scripts/checks/check-hfs-sync.mjs judges every tracked file.
//
// Run inside a full runtime checkout — the repository under judgment is the checkout — it also reports the
// state-root ledger findings of that checkout's scripts/lib/hk-orphan-ledgers.mjs: LEDGER_ORPHAN_STATE_ROOT and
// LEDGER_LEGACY_WORK_SQLITE (COOK-BRIEF F4 handover, incident 2026-09-30). Any other repository — a product repo,
// a bare repo — carries no scripts/checks/ledger-hygiene.mjs at its root, so that section is silently absent:
// never a crash, never machine-state findings blamed on a repository that does not own them.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { secretFileFindings } from '../runtime/scripts/lib/hfs-rules/secrets.mjs';

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

const MAX_STAGED_BYTES = 1024 * 1024;

/** The text of `file` as the index holds it (what the commit would record), or null when it is absent, binary or over 1 MB. */
export function stagedText(cwd, file) {
  try {
    const blob = execFileSync('git', ['show', `:${file}`], { cwd, maxBuffer: MAX_STAGED_BYTES * 2, stdio: ['ignore', 'pipe', 'ignore'] });
    return blob.length > MAX_STAGED_BYTES || blob.includes(0) ? null : blob.toString('utf8');
  } catch {
    return null;
  }
}

/** The secret findings of `files` read from the index, as {file, code, message}; a file the name check already refused is not reported twice. */
export function secretGuardFindings(cwd, files, alreadyRefused = new Set()) {
  return files.filter(file => !alreadyRefused.has(file)).flatMap(file => secretFileFindings({ file, text: stagedText(cwd, file) }).map(finding => ({ file, code: finding.code, message: finding.message })));
}

/** Findings for `files`: the guarded trees, then the secret guard over every file. */
export function judge(cwd, files) {
  const guarded = files.filter(GUARDED);
  const findings = hygieneFindings(guarded, ignoredAmong(cwd, guarded.filter(file => file.startsWith('.starciwork/'))));
  const refused = new Set(findings.filter(finding => finding.code === 'HFS_PLAINTEXT_SECRET').map(finding => finding.file));
  return { checked: files.length, findings: [...findings, ...secretGuardFindings(cwd, files, refused)] };
}

// The scripts/checks/ledger-hygiene.mjs of the checkout under judgment: the root git names for `cwd`, which carries
// that script only when the repository IS a full StarCi runtime checkout (packages/hfs/sync/ sits 3 directories
// under such a root, the same computation packages/hfs/scripts/sync-runtime.mjs uses). A product repository — or a
// bare repo — has no such file, so the section is silently absent wherever this module happens to be installed.
const ledgerHygieneScript = cwd => {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
    return path.join(root, 'scripts', 'checks', 'ledger-hygiene.mjs');
  } catch {
    return null;
  }
};

/**
 * The state-root ledger findings (LEDGER_ORPHAN_STATE_ROOT, LEDGER_LEGACY_WORK_SQLITE) of the checkout containing
 * `cwd`, as {code, file, message} entries; [] when that checkout carries no ledger-hygiene script. Never throws: a
 * report failure is one HFS_LEDGER_HYGIENE_UNAVAILABLE finding, not a crash of `hfs work-hygiene`.
 */
export async function ledgerHygieneFindings(cwd = process.cwd()) {
  const script = ledgerHygieneScript(cwd);
  if (!script || !fs.existsSync(script)) return [];
  try {
    const { ledgerHygieneReport } = await import(pathToFileURL(script).href);
    const report = await ledgerHygieneReport({ apply: false });
    return [
      ...report.orphans.map(o => ({ code: o.code, file: o.ledgerId, message: `ledger ${o.name ?? o.ledgerId} - ${o.reason}; source roots: ${o.sourceRoots.join(', ') || '(none)'}` })),
      ...report.legacy.map(l => ({ code: l.code, file: l.repoRoot, message: `${l.files.length} legacy file(s) still in the repo: ${l.files.join(', ')}` })),
    ];
  } catch (error) {
    return [{ code: 'HFS_LEDGER_HYGIENE_UNAVAILABLE', file: script, message: `could not run: ${String(error?.message ?? error).slice(0, 200)}` }];
  }
}

/** `hfs work-hygiene`: checks the staged files, plus the state-root ledger findings when reachable; returns the exit code. */
export async function runWorkHygiene({ cwd = process.cwd(), out = line => process.stdout.write(`${line}\n`), files } = {}) {
  const { checked, findings } = judge(cwd, files ?? stagedFiles(cwd));
  const ledgerFindings = await ledgerHygieneFindings(cwd);
  const all = [...findings, ...ledgerFindings];
  for (const finding of all) out(`${finding.code} ${finding.file} ${finding.message}`);
  out(`hfs work-hygiene: ${checked} staged file(s) checked, ${findings.length} finding(s), ${ledgerFindings.length} ledger finding(s)`);
  return all.length ? 1 : 0;
}
