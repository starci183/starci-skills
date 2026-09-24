import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseYaml } from '../engine/yaml.mjs';
import { checkScopedLint, codePatternExitCode, parseScopedLintArgs, scopedLintMain } from '../scripts/checks/check-scoped-lint.mjs';
import { classifySliceFindings, diffRanges, removeLink } from '../scripts/checks/scoped-lint-baseline.mjs';

// nivo wf-nivo-app-auth-mudqjob3 inc-ee60a7c362a7: the scoped check (83d5a7447, the slice verdict) gated a slice on
// EVERY finding in each file it touched, including repository debt it never wrote - modules/auth/session.tsx
// useSession's hook-location finding has ~20 importers, so fixing it is a repo-wide refactor - and a slice touching an
// old file could never pass. Same principle as the Sonar slice rule (3e0b17f9c): the slice is judged on its own NEW
// findings against --base; the ones already there at base are preexisting notes owed to code.refactor.
const FILES = ['src/session.tsx', 'src/login.tsx'];
const SESSION = ['export function Provider() {', '  return null', '}', 'export const useSession = () => HOOK_DEBT', ''].join('\n');
const LOGIN = ['export function Login() {', '  return null', '}', ''].join('\n');

const run = (cwd, args) => {
  const r = spawnSync('git', ['-c', 'user.name=spec', '-c', 'user.email=spec@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const lines = (text) => text.split(/\r?\n/);

// The architecture stub reads whatever tree it is pointed at, so the base run measures the base blobs:
// - one FE_CUSTOM_HOOK_LOCATION per line holding HOOK_DEBT, on that line;
// - one FE_HOOK_COUNT per WORSE marker, all reported on line 1 (a rule whose location the slice does not edit);
// - one FE_CROSS on line 1 when the file holds TRIGGER anywhere (a finding the slice causes on an unchanged line).
const architectureOf = (seen) => ({ repositoryRoot }) => {
  const violations = [];
  for (const file of FILES) {
    let text; try { text = fs.readFileSync(path.join(repositoryRoot, file), 'utf8'); } catch { continue; }
    lines(text).forEach((line, index) => { if (line.includes('HOOK_DEBT')) violations.push({ ruleId: 'FE_CUSTOM_HOOK_LOCATION', path: file, line: index + 1 }); });
    for (const _ of text.matchAll(/WORSE/g)) violations.push({ ruleId: 'FE_HOOK_COUNT', path: file, line: 1 });
    if (text.includes('TRIGGER')) violations.push({ ruleId: 'FE_CROSS', path: file, line: 1 });
  }
  seen.push({ root: repositoryRoot, env: fs.existsSync(path.join(repositoryRoot, '.env')), nextEnv: fs.existsSync(path.join(repositoryRoot, 'next-env.d.ts')),
    dependency: fs.existsSync(path.join(repositoryRoot, 'node_modules', 'dep', 'index.js')),
    workspace: (() => { try { return fs.realpathSync(path.join(repositoryRoot, 'node_modules', '@scope', 'ui')); } catch { return null; } })() });
  const present = FILES.filter((file) => fs.existsSync(path.join(repositoryRoot, file)));
  return { schema: 'starci/architecture-check@1', ok: violations.length === 0, kinds: ['frontend'], files: present.length, violations, errors: [],
    coverage: { sourceFiles: present, checkedRuleIds: ['FE_CUSTOM_HOOK_LOCATION', 'FE_HOOK_COUNT', 'FE_CROSS'] } };
};
// The ESLint stub: one no-console error per console.log line of the file it lints.
const runtime = { package: { name: '@starci/eslint-canon-fe', version: '1.0.0', digest: 'a'.repeat(64), files: 1 }, canon: { rules: {}, recommended: {} }, builtinRules: new Map(), typescriptRules: {}, eslintVersion: 'fixture', eslint: {
  isPathIgnored: async () => false,
  calculateConfigForFile: async () => ({ linterOptions: { noInlineConfig: true }, rules: {}, plugins: {} }),
  lintFiles: async (files) => files.map((filePath) => {
    const messages = lines(fs.readFileSync(filePath, 'utf8')).flatMap((line, index) => line.includes('console.log') ? [{ ruleId: 'no-console', severity: 2, line: index + 1, message: 'Unexpected console statement.' }] : []);
    return { filePath, messages, suppressedMessages: [], errorCount: messages.length, warningCount: 0, fatalErrorCount: 0 };
  }),
} };
const profileCatalog = { schema: 'starci/code-pattern-profile@1', profiles: { next: {
  canon: { package: '@starci/eslint-canon-fe', version: '1.0.0', contentDigest: { algorithm: 'sha256', include: ['**/*.mjs'], exclude: [], framing: 'sorted-posix-relative-path-null-raw-bytes-null', value: 'a'.repeat(64), files: 1 } },
  expectedSourceRuleIds: ['FE-1'], sourceGlobs: ['src/**/*.tsx'], inputGlobs: [], semanticOnly: [],
  obligations: [{ id: 'NEXT-HOOKS', sourceRuleIds: ['FE-1'], applicability: { include: ['**/*.tsx'] }, status: 'implemented',
    mechanical: { requirement: 'x', check: { kind: 'architecture', ruleIds: ['FE_CUSTOM_HOOK_LOCATION', 'FE_HOOK_COUNT', 'FE_CROSS'] } } }],
} } };

function repo(t, { session = SESSION, login = LOGIN } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-scoped-new-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/session.tsx'), session);
  fs.writeFileSync(path.join(root, 'src/login.tsx'), login);
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n.env\nnext-env.d.ts\n');
  run(root, ['init', '-q', '-b', 'main']);
  run(root, ['add', '-A']);
  run(root, ['commit', '-q', '-m', 'base']);
  const base = run(root, ['rev-parse', 'HEAD']);
  const seen = [];
  const check = (files, extra = {}) => checkScopedLint(root, files, { profile: 'next', profileCatalog, runtime, architecture: architectureOf(seen), ...extra });
  const write = (file, text) => fs.writeFileSync(path.join(root, file), text);
  return { root, base, seen, check, write };
}
const validate = new Ajv2020({ strict: true }).compile(parseYaml(fs.readFileSync(new URL('../modules/schemas/code-pattern-check.schema.yaml', import.meta.url), 'utf8')));

test('pre-existing debt in a touched file is a preexisting note, never a finding against the slice', async (t) => {
  const r = repo(t);
  r.write('src/session.tsx', SESSION.replace('  return null', '  return null // the slice edits line 2 only'));
  const report = await r.check(FILES, { base: r.base });
  assert.equal(report.status, 'findings', 'the top-level status still measures the files as they are');
  assert.equal(report.slice.status, 'clean', JSON.stringify(report.slice.issues));
  assert.equal(report.slice.ok, true);
  assert.equal(codePatternExitCode(report), 0);
  assert.deepEqual(report.slice.counts, { new: 0, preexisting: 1, runLevel: 0 });
  const [note] = report.slice.preexisting;
  assert.equal(note.code, 'SLICE_PREEXISTING_FINDINGS');
  assert.equal(note.severity, 'note');
  assert.equal(note.owner, 'code.refactor');
  assert.deepEqual([note.finding, note.ruleId, note.file, note.count, note.lines], ['ARCHITECTURE_VIOLATION', 'FE_CUSTOM_HOOK_LOCATION', 'src/session.tsx', 1, [4]]);
  assert.match(note.message, /pre-existing FE_CUSTOM_HOOK_LOCATION/);
  assert.equal(report.slice.baseline.method, 'base-tree');
  assert.equal(report.slice.baseline.status, 'measured');
  assert.equal(report.slice.baseline.baseCommit, r.base);
  assert.equal(report.slice.baseline.source, 'argument');
  assert.deepEqual(report.slice.baseline.changedFiles, [{ path: 'src/session.tsx', added: false, ranges: [[2, 2]] }]);
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
});

test('a finding on a line the slice changed is new and gates the slice', async (t) => {
  const r = repo(t);
  r.write('src/login.tsx', LOGIN.replace('  return null', '  console.log("x")\n  return null'));
  const report = await r.check(FILES, { base: r.base });
  assert.equal(report.slice.status, 'findings');
  assert.equal(codePatternExitCode(report), 1);
  assert.deepEqual(report.slice.issues.map((issue) => [issue.code, issue.ruleId, issue.file ?? issue.path, issue.newBecause]), [['LINT_MESSAGE', 'no-console', 'src/login.tsx', 'changed-line']]);
  assert.deepEqual(report.slice.counts, { new: 1, preexisting: 1, runLevel: 0 }, 'the untouched session debt is still only a note');
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
});

test('a finding the slice made worse (same rule, more occurrences) counts as new, even on an unchanged line', async (t) => {
  const r = repo(t, { session: `${SESSION}// WORSE\n` });
  r.write('src/session.tsx', `${SESSION}// WORSE\n// WORSE\n`);
  const report = await r.check(FILES, { base: r.base });
  assert.equal(report.slice.status, 'findings');
  const worse = report.slice.issues.filter((issue) => issue.ruleId === 'FE_HOOK_COUNT');
  assert.equal(worse.length, 2, 'every occurrence of the worsened key gates');
  for (const issue of worse) assert.deepEqual([issue.line, issue.newBecause, issue.baseCount, issue.count], [1, 'more-than-base', 1, 2]);
  assert.deepEqual(report.slice.preexisting.map((note) => note.ruleId), ['FE_CUSTOM_HOOK_LOCATION']);
});

test('a finding absent at base is new even when it lands on a line the slice did not change', async (t) => {
  const r = repo(t);
  r.write('src/login.tsx', `${LOGIN}// TRIGGER\n`);
  const report = await r.check(FILES, { base: r.base });
  assert.equal(report.slice.status, 'findings');
  assert.deepEqual(report.slice.issues.map((issue) => [issue.ruleId, issue.line, issue.newBecause]), [['FE_CROSS', 1, 'absent-at-base']]);
});

test('every finding in a file the slice added is new', async (t) => {
  const r = repo(t);
  fs.rmSync(path.join(r.root, 'src/session.tsx'));
  run(r.root, ['commit', '-q', '-am', 'drop session']);
  const base = run(r.root, ['rev-parse', 'HEAD']);
  r.write('src/session.tsx', SESSION);
  const report = await r.check(FILES, { base });
  assert.equal(report.slice.status, 'findings');
  assert.deepEqual(report.slice.issues.map((issue) => [issue.ruleId, issue.newBecause]), [['FE_CUSTOM_HOOK_LOCATION', 'added-file']]);
  assert.equal(report.slice.baseline.changedFiles[0].added, true);
  assert.deepEqual([report.slice.baseline.method, report.slice.baseline.status], ['changed-lines', 'not-needed'], 'no base run when every finding is already new');
  assert.equal(r.seen.length, 1);
});

test('committed slice work is judged against the explicit --base; the default base is the merge-base with upstream, else HEAD', async (t) => {
  const r = repo(t);
  r.write('src/login.tsx', LOGIN.replace('  return null', '  console.log("x")\n  return null'));
  run(r.root, ['commit', '-q', '-am', 'slice']);
  const explicit = await r.check(FILES, { base: r.base });
  assert.equal(explicit.slice.status, 'findings', 'the slice commit is inside base..working tree');
  const fallback = await r.check(FILES);
  assert.equal(fallback.slice.baseline.source, 'head');
  assert.equal(fallback.slice.baseline.method, 'unchanged', 'nothing changed against HEAD, so the base measurement is the current one');
  assert.equal(fallback.slice.status, 'clean');
  assert.deepEqual(fallback.slice.counts, { new: 0, preexisting: 2, runLevel: 0 });
  run(r.root, ['branch', '-q', 'upstream-main', r.base]);
  run(r.root, ['branch', '-q', '--set-upstream-to=upstream-main']);
  const upstream = await r.check(FILES);
  assert.equal(upstream.slice.baseline.source, 'merge-base');
  assert.equal(upstream.slice.baseline.baseCommit, r.base);
  assert.equal(upstream.slice.status, 'findings');
});

test('an explicit --base that is not a commit makes the slice unavailable', async (t) => {
  const r = repo(t);
  const report = await r.check(FILES, { base: 'no-such-ref' });
  assert.equal(report.slice.status, 'unavailable');
  assert.ok(report.slice.issues.some((issue) => issue.code === 'SLICE_BASE_UNKNOWN'));
  assert.equal(codePatternExitCode(report), 2);
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
});

test('outside git there is no base: every finding on the slice files gates, as before', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-scoped-nogit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/session.tsx'), SESSION);
  fs.writeFileSync(path.join(root, 'src/login.tsx'), LOGIN);
  const report = await checkScopedLint(root, FILES, { profile: 'next', profileCatalog, runtime, architecture: architectureOf([]) });
  assert.equal(report.slice.status, 'findings');
  assert.equal(report.slice.baseline.method, 'none');
  assert.equal(report.slice.baseline.status, 'unavailable');
  assert.deepEqual(report.slice.issues.map((issue) => issue.newBecause), ['no-baseline']);
});

test('the base tree links node_modules, maps workspace links into itself, copies no secret, and cleanup never deletes through a link', async (t) => {
  const r = repo(t);
  fs.mkdirSync(path.join(r.root, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(r.root, 'node_modules', 'dep', 'index.js'), 'module.exports = 1\n');
  fs.writeFileSync(path.join(r.root, 'node_modules', '.modules.yaml'), 'x: 1\n');
  fs.mkdirSync(path.join(r.root, 'packages', 'ui'), { recursive: true });
  fs.writeFileSync(path.join(r.root, 'packages', 'ui', 'index.ts'), 'export const ui = 1\n');
  run(r.root, ['add', 'packages']);
  run(r.root, ['commit', '-q', '-m', 'workspace package']);
  const base = run(r.root, ['rev-parse', 'HEAD']);
  fs.mkdirSync(path.join(r.root, 'node_modules', '@scope'));
  fs.symlinkSync(path.join(r.root, 'packages', 'ui'), path.join(r.root, 'node_modules', '@scope', 'ui'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(r.root, '.env'), 'SECRET=1\n');
  fs.writeFileSync(path.join(r.root, 'next-env.d.ts'), '/// <reference types="next" />\n');
  r.write('src/session.tsx', SESSION.replace('  return null', '  return null // edit'));
  const report = await r.check(FILES, { base });
  assert.equal(report.slice.status, 'clean', JSON.stringify(report.slice.issues));
  const baseRun = r.seen.find((entry) => entry.root !== r.root);
  assert.ok(baseRun, 'the base was measured on its own tree');
  assert.deepEqual([baseRun.dependency, baseRun.nextEnv, baseRun.env], [true, true, false]);
  assert.equal(path.relative(baseRun.root, baseRun.workspace), path.join('packages', 'ui'), 'a workspace package link resolves inside the base tree, not the live repository');
  assert.equal(fs.existsSync(baseRun.root), false, 'the base tree is removed');
  assert.equal(fs.readFileSync(path.join(r.root, 'node_modules', 'dep', 'index.js'), 'utf8'), 'module.exports = 1\n', 'the linked node_modules survives');
  assert.equal(fs.readFileSync(path.join(r.root, 'packages', 'ui', 'index.ts'), 'utf8'), 'export const ui = 1\n');
  assert.equal(fs.existsSync(path.join(r.root, 'node_modules', '@scope', 'ui', 'index.ts')), true);
  assert.equal(fs.readFileSync(path.join(r.root, 'node_modules', '.modules.yaml'), 'utf8'), 'x: 1\n');
  assert.equal(report.slice.baseline.cleanup, undefined);
});

test('removeLink refuses a real directory and removes only a link', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-scoped-link-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'target');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'keep.txt'), 'x');
  const link = path.join(root, 'link');
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(removeLink(target), false, 'a real directory is never removed');
  assert.equal(removeLink(link), true);
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'x');
});

test('classification and diff parsing', () => {
  const ranges = diffRanges(['diff --git a/src/x.ts b/src/x.ts', '--- a/src/x.ts', '+++ b/src/x.ts', '@@ -3,0 +4,2 @@', '+a', '+b', '@@ -9 +11 @@', '-c', '+d'].join('\n'));
  assert.deepEqual([...ranges], [['src/x.ts', [[4, 5], [11, 11]]]]);
  const issue = (line, message = 'm') => ({ code: 'LINT_MESSAGE', file: 'src/x.ts', ruleId: 'r', line, message });
  const changes = new Map([['src/x.ts', { added: false, ranges: [[4, 5]] }]]);
  const run = classifySliceFindings([issue(4), issue(20), { code: 'CONFIG_INVALID' }], { changes, baseIssues: [issue(18)] });
  assert.deepEqual(run.fresh.map((item) => item.newBecause), ['changed-line']);
  assert.deepEqual(run.preexisting.map((item) => item.line), [20]);
  assert.deepEqual(run.other.map((item) => item.code), ['CONFIG_INVALID']);
  const linesOnly = classifySliceFindings([issue(4), issue(20), issue(null)], { changes, baseIssues: null });
  assert.deepEqual(linesOnly.fresh.map((item) => item.newBecause), ['changed-line', 'changed-file-unlocated']);
  assert.deepEqual(linesOnly.preexisting.map((item) => item.line), [20]);
  // A script input gap on a slice file (session.tsx's FE_READONLY_PROPS_CONTRACT) is judged the same way; one without a path stays run-level.
  const gap = { code: 'SCRIPT_INPUT_UNAVAILABLE', obligation: 'NEXT-READONLY-PROPS-CONTRACT', ruleId: 'FE_READONLY_PROPS_CONTRACT', path: 'src/x.ts', message: 'needs a contract' };
  const gaps = classifySliceFindings([gap, { ...gap, path: null }], { changes, baseIssues: [gap] });
  assert.deepEqual([gaps.fresh.length, gaps.preexisting.length, gaps.other.length], [0, 1, 1]);
});

test('the CLI takes --base for a scoped run only', async () => {
  assert.equal(parseScopedLintArgs(['--profile', 'next', '--root', '.', '--base', 'abc', '--', 'a.ts']).base, 'abc');
  assert.equal(parseScopedLintArgs(['--profile', 'next', '--root', '.', '--', 'a.ts']).base, null);
  assert.throws(() => parseScopedLintArgs(['--profile', 'next', '--root', '.', '--base', 'abc', '--all']), /scoped run only/);
  assert.throws(() => parseScopedLintArgs(['--profile', 'next', '--root', '.', '--base']), /--base needs a commit/);
  let received = null;
  await scopedLintMain(['--profile', 'next', '--root', '.', '--base', 'abc', '--', 'a.ts'], { checker: async (_root, _files, options) => { received = options; return { slice: { status: 'clean', ok: true } }; }, write: () => {} });
  assert.equal(received.base, 'abc');
});
