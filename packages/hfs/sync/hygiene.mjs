// hfs work-hygiene: the guard for the two trees a back end tracks besides source. A file under .starciwork must be
// product content (the .starciwork/.gitignore allowlist admits it, so agent output is refused), and a file under
// .starcistacks must not be a plaintext secret (only *.enc is sealed). The pre-commit hook judges the staged files;
// scripts/checks/check-hfs-sync.mjs judges every tracked file.
import { execFileSync } from 'node:child_process';

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
      if (file.includes('/secrets/')) findings.push({ file, code: 'HFS_STACKS_PLAINTEXT', message: 'sits under secrets/ but is not sealed; only <slug>.enc may be tracked' });
      else if (PLAINTEXT_NAME.test(file)) findings.push({ file, code: 'HFS_STACKS_PLAINTEXT', message: 'is a plaintext secret; seal it to .starcistacks/<env>/secrets/<slug>.enc' });
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

/** `hfs work-hygiene`: checks the staged files; returns the exit code. */
export function runWorkHygiene({ cwd = process.cwd(), out = line => process.stdout.write(`${line}\n`), files } = {}) {
  const { checked, findings } = judge(cwd, files ?? stagedFiles(cwd));
  for (const finding of findings) out(`${finding.code} ${finding.file} ${finding.message}`);
  out(`hfs work-hygiene: ${checked} staged file(s) checked, ${findings.length} finding(s)`);
  return findings.length ? 1 : 0;
}
