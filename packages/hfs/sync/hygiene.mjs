// starci app hygiene: the guard for the two trees an app tracks besides source. A file under the app root's .starciwork must be
// product content (the .starciwork/.gitignore allowlist admits it, so agent output is refused), and a file under the app root's
// .starcistacks must not be a plaintext secret (only *.enc is sealed). It is also the secrets guard of the commit: every staged file, in
// any tree, is read from the index and judged with the one secret judgement of `starci app check` (scripts/hfs/rules/secrets.mjs: a secret by
// being, an .enc that is no sops envelope, a line that matches a secret pattern), so no plaintext secret reaches the history whatever
// .gitignore says (`git add -f`, a path tracked before a rule tightened). There is no override. It also
// refuses every bypass marker the index holds (R303: an inline disable, a type-check escape, a skipped test, a failure swallowed in a hook or
// workflow; scripts/lib/bypass-markers.mjs), so a bypass fails at the commit and not only at the release. At an HFS app root (hfs.json) it also
// refuses a back-end logic file the index adds without its unit spec beside it (BE_UNIT_SPEC_NOT_STAGED,
// scripts/hfs/rules/staged-specs.mjs over the coverage scope; a constants-only file has nothing to test), naming the file. The pre-commit hook judges the staged files;
// scripts/gates/hfs-sync.mjs judges every tracked file.
//
// Run inside a full runtime checkout — the repository under judgment is the checkout — it also reports the
// state-root ledger finding of that checkout's scripts/housekeeping/hk-orphan-ledgers.mjs: LEDGER_ORPHAN_STATE_ROOT. Any other repository — a product repo,
// a bare repo — carries no scripts/housekeeping/ledger-hygiene.mjs at its root, so that section is silently absent:
// never a crash, never machine-state findings blamed on a repository that does not own them.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { secretFileFindings } from '../runtime/scripts/hfs/rules/secrets.mjs';
import { stagedSpecFindings } from '../runtime/scripts/hfs/rules/staged-specs.mjs';
import { HFS_BYPASS_MARKER, bypassMessage } from '../runtime/scripts/hfs/rules/bypass-markers.mjs';
import { bypassesIn } from '../runtime/scripts/lib/bypass-markers.mjs';
import { loadSlotManifest } from '../runtime/scripts/hfs/slots.mjs';
import { runGit } from '../runtime/scripts/api/git/lib.mjs';
import { loadTypescript } from '../runtime/scripts/lib/package-at.mjs';

// One git call through the runtime's git owner (scripts/api/git/lib.mjs): stdout, or the failure thrown the way execFileSync threw it (error.status carries the exit code). The caller's own env is passed on unchanged: a hook runs with GIT_INDEX_FILE set, which the staged reads must keep seeing.
const git = (cwd, args, options = {}) => {
  const run = runGit(args, { cwd, env: process.env, ...options });
  if (run.error) throw run.error;
  if (run.status !== 0) throw Object.assign(new Error(`git ${args[0]} exited ${run.status}`), { status: run.status });
  return run.stdout;
};

const PLAINTEXT_NAME = /(^|\/)(\.env(\..*)?|[^/]*\.(pem|key|identity|age))$/;
/** The app root's work tree and stack tree, app-relative (`starci app hygiene` runs at the app root). */
const WORK = '.starciwork/';
const STACKS = '.starcistacks/';
const GUARDED = file => file.startsWith(WORK) || file.startsWith(STACKS);

/** The subset of `files` git ignores (as if untracked), asked in one call: a Set of paths. */
function ignoredAmong(cwd, files) {
  if (files.length === 0) return new Set();
  try {
    const out = git(cwd, ['check-ignore', '--no-index', '-z', '--stdin'], { input: files.join('\0'), maxBuffer: 64 * 1024 * 1024 });
    return new Set(out.split('\0').filter(Boolean));
  } catch (error) {
    if (error.status === 1) return new Set();
    throw error;
  }
}

/** Violations among `files` (repository-relative, '/'-separated): [{ file, code, message }]. `ignored` is a Set of ignored paths. */
function hygieneFindings(files, ignored) {
  const findings = [];
  for (const file of files) {
    if (file.startsWith(WORK) && ignored.has(file)) {
      findings.push({ file, code: 'HFS_WORK_AGENT_DATA', message: 'is agent output, which .starciwork/.gitignore refuses; keep it in the scratchpad or the blob store' });
    }
    if (file.startsWith(STACKS) && !file.endsWith('.enc') && !file.endsWith('.env.example')) {
      if (file.includes('/secrets/')) findings.push({ file, code: 'HFS_PLAINTEXT_SECRET', message: 'sits under secrets/ but is not sealed; only <slug>.enc may be tracked' });
      else if (PLAINTEXT_NAME.test(file)) findings.push({ file, code: 'HFS_PLAINTEXT_SECRET', message: 'is a plaintext secret; seal it to .starcistacks/<env>/secrets/<slug>.enc' });
    }
  }
  return findings;
}

const gitList = (cwd, args) => git(cwd, args, { maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

/** Files staged for the next commit (added, copied, modified, renamed). */
export const stagedFiles = cwd => gitList(cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);

/** Every tracked file. */
export const trackedFiles = cwd => gitList(cwd, ['ls-files', '-z']);

/** Files the index adds for the next commit. */
const addedFiles = cwd => gitList(cwd, ['diff', '--cached', '--name-only', '--diff-filter=A', '-z']);

/** The new back-end logic files staged without their unit spec, at an HFS app root only (a repository without hfs.json has no slots). */
function missingSpecFindings(cwd, { added = addedFiles(cwd), indexed, manifest } = {}) {
  if (!fs.existsSync(path.join(cwd, 'hfs.json')) || !added.some(file => file.startsWith('be/'))) return [];
  const staged = (file) => {
    try { return git(cwd, ['show', `:${file}`]); } catch { return null; }
  };
  let ts = null;
  try { ts = loadTypescript(cwd, import.meta.dirname); } catch { ts = null; }
  return stagedSpecFindings(manifest ?? loadSlotManifest(), added, indexed ?? new Set(trackedFiles(cwd)), { ts, staged });
}

const MAX_STAGED_BYTES = 1024 * 1024;

/** The text of `file` as the index holds it (what the commit would record), or null when it is absent, binary or over 1 MB. */
function stagedText(cwd, file) {
  try {
    const blob = git(cwd, ['show', `:${file}`], { encoding: 'buffer', maxBuffer: MAX_STAGED_BYTES * 2 });
    return blob.length > MAX_STAGED_BYTES || blob.includes(0) ? null : blob.toString('utf8');
  } catch {
    return null;
  }
}

/** The secret findings of `files` read from the index, as {file, code, message}; a file the name check already refused is not reported twice. */
function secretGuardFindings(cwd, files, alreadyRefused = new Set()) {
  return files.filter(file => !alreadyRefused.has(file)).flatMap(file => {
    const manifestText = /(?:^|\/)README\.md$/.test(file) ? stagedText(cwd, path.posix.join(path.posix.dirname(file), '.starcistacks/application-stacks.yaml')) ?? undefined : undefined;
    return secretFileFindings({ file, text: stagedText(cwd, file), manifestText }).map(finding => ({ file, code: finding.code, message: finding.message }));
  });
}

/** The bypass markers (R303) of `files` read from the index: an inline disable, a type-check escape, a skipped test or a swallowed failure fails at the commit. */
function bypassGuardFindings(cwd, files) {
  return files.flatMap(file => {
    const text = stagedText(cwd, file);
    return text === null ? [] : bypassesIn(file, text).map(hit => ({ file, code: HFS_BYPASS_MARKER, message: bypassMessage(file, hit) }));
  });
}

/** Findings for `files`: the guarded trees, then the secret guard and the bypass guard over every file. */
export function judge(cwd, files) {
  const guarded = files.filter(GUARDED);
  const findings = hygieneFindings(guarded, ignoredAmong(cwd, guarded.filter(file => file.startsWith(WORK))));
  const refused = new Set(findings.filter(finding => finding.code === 'HFS_PLAINTEXT_SECRET').map(finding => finding.file));
  return { checked: files.length, findings: [...findings, ...secretGuardFindings(cwd, files, refused), ...bypassGuardFindings(cwd, files)] };
}

// The scripts/housekeeping/ledger-hygiene.mjs of the checkout under judgment: the root git names for `cwd`, which carries
// that script only when the repository IS a full StarCi runtime checkout (packages/hfs/sync/ sits 3 directories
// under such a root, the same computation scripts/hfs/sync-runtime.mjs uses). A product repository — or a
// bare repo — has no such file, so the section is silently absent wherever this module happens to be installed.
const ledgerHygieneScript = cwd => {
  try {
    const root = git(cwd, ['rev-parse', '--show-toplevel']).trim();
    return path.join(root, 'scripts', 'housekeeping', 'ledger-hygiene.mjs');
  } catch {
    return null;
  }
};

/**
 * The state-root ledger findings (LEDGER_ORPHAN_STATE_ROOT) of the checkout containing
 * `cwd`, as {code, file, message} entries; [] when that checkout carries no ledger-hygiene script. Never throws: a
 * report failure is one HFS_LEDGER_HYGIENE_UNAVAILABLE finding, not a crash of `starci app hygiene`.
 */
async function ledgerHygieneFindings(cwd = process.cwd()) {
  const script = ledgerHygieneScript(cwd);
  if (!script || !fs.existsSync(script)) return [];
  try {
    const { ledgerHygieneReport } = await import(pathToFileURL(script).href);
    const report = await ledgerHygieneReport({ apply: false });
    return [
      ...report.orphans.map(o => ({ code: o.code, file: o.ledgerId, message: `ledger ${o.name ?? o.ledgerId} - ${o.reason}; source roots: ${o.sourceRoots.join(', ') || '(none)'}` })),
    ];
  } catch (error) {
    return [{ code: 'HFS_LEDGER_HYGIENE_UNAVAILABLE', file: script, message: `could not run: ${String(error?.message ?? error).slice(0, 200)}` }];
  }
}

/** `starci app hygiene`: checks staged files (for the staged run also the new logic files without a spec) plus state-root ledger findings when reachable; returns the exit code. */
export async function runWorkHygiene({ cwd = process.cwd(), out = line => process.stdout.write(`${line}\n`), files } = {}) {
  const judged = judge(cwd, files ?? stagedFiles(cwd));
  const { checked } = judged;
  const findings = [...judged.findings, ...(files ? [] : missingSpecFindings(cwd))];
  const ledgerFindings = await ledgerHygieneFindings(cwd);
  const all = [...findings, ...ledgerFindings];
  for (const finding of all) out(`${finding.code} ${finding.file} ${finding.message}`);
  out(`starci app hygiene: ${checked} staged file(s) checked, ${findings.length} finding(s), ${ledgerFindings.length} ledger finding(s)`);
  return all.length ? 1 : 0;
}
