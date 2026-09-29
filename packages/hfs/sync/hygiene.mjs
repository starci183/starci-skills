// hfs work-hygiene: the pre-commit guard for the two trees a back end tracks besides source. A staged file under
// .starciwork must be product content (the .starciwork/.gitignore allowlist admits it, so agent output is refused),
// and a staged file under .starcistacks must not be a plaintext secret (only *.enc is sealed).
import { execFileSync } from 'node:child_process';

const PLAINTEXT_NAME = /(^|\/)(\.env(\..*)?|[^/]*\.(pem|key|identity|age))$/;

function gitSucceeds(cwd, args) {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Violations among `files` (repository-relative, '/'-separated): [{ file, code, message }]. `ignored(file)` says whether git ignores it. */
export function hygieneFindings(files, ignored) {
  const findings = [];
  for (const file of files) {
    if (file.startsWith('.starciwork/') && ignored(file)) {
      findings.push({ file, code: 'HFS_WORK_AGENT_DATA', message: 'is agent output, which .starciwork/.gitignore refuses; keep it in the scratchpad or the blob store' });
    }
    if (file.startsWith('.starcistacks/') && !file.endsWith('.enc') && !file.endsWith('.env.example')) {
      if (file.includes('/secrets/')) findings.push({ file, code: 'HFS_STACKS_PLAINTEXT', message: 'sits under secrets/ but is not sealed; only <slug>.enc may be tracked' });
      else if (PLAINTEXT_NAME.test(file)) findings.push({ file, code: 'HFS_STACKS_PLAINTEXT', message: 'is a plaintext secret; seal it to .starcistacks/<env>/secrets/<slug>.enc' });
    }
  }
  return findings;
}

export function stagedFiles(cwd) {
  const listing = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd, encoding: 'utf8' });
  return listing.split('\0').filter(Boolean);
}

/** `hfs work-hygiene`: checks the staged files; returns the exit code. */
export function runWorkHygiene({ cwd = process.cwd(), out = line => process.stdout.write(`${line}\n`), files } = {}) {
  const staged = (files ?? stagedFiles(cwd)).filter(file => file.startsWith('.starciwork/') || file.startsWith('.starcistacks/'));
  const findings = hygieneFindings(staged, file => gitSucceeds(cwd, ['check-ignore', '--no-index', '-q', '--', file]));
  for (const finding of findings) out(`${finding.code} ${finding.file} ${finding.message}`);
  out(`hfs work-hygiene: ${staged.length} staged file(s) checked, ${findings.length} finding(s)`);
  return findings.length ? 1 : 0;
}
