// starci app lint (packages/hfs/lint/run.mjs): the ONE lint entry over a hermetic temp repository with a fake ESLint install and injected
// hfsCheck / trackedFiles. The fake eslint is a package with a `bin` that prints a fixed json result array.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lintRepository, parseLintArgs } from '../../packages/hfs/lint/run.mjs';
import { appDeclarationText, DEFAULT_APPS } from '../helpers/hfs-arch-fixture.mjs';
import { withSpawnResult } from '../helpers/lint-child-outcome.mjs';
import { fakeLintCanon } from '../helpers/lint-canon-fixture.mjs';

const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

/** A fake linter package in `side`'s node_modules whose bin prints `output` as its json report (stylelint prints on stderr). */
const fakeLinter = (side, name, output, stream = 'stdout') => {
  const pkg = path.join(side, 'node_modules', name);
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name, version: '9.0.0', bin: { [name]: 'bin.js' } }));
  fs.writeFileSync(path.join(pkg, 'bin.js'), `const path = require('node:path');\nconst output = ${JSON.stringify(output)};\nconst requested = process.argv.slice(2).filter(arg => arg === '.' || /\\.(?:[cm]?[jt]sx?)$/.test(arg) || /^(?:apps|packages)\\//.test(arg));\nconst results = ${JSON.stringify(name)} === 'eslint' && requested.length ? output.filter(result => !result?.filePath || requested.some(arg => arg === '.' || path.relative(process.cwd(), result.filePath).replace(/\\\\/g, '/') === arg || path.relative(process.cwd(), result.filePath).replace(/\\\\/g, '/').startsWith(arg + '/'))) : output;\nprocess.${stream}.write(JSON.stringify(results));\n`);
};
/**
 * A temp app (starci app lint runs at the app root, the folder of a kind: app hfs.json): `messages` are the ESLint messages on
 * be/src/a.ts (null: no ESLint install at all). The fe side lints clean and has a clean stylelint.
 */
const repoWith = (messages) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lint-'));
  made.push(dir);
  fs.writeFileSync(path.join(dir, 'hfs.json'), appDeclarationText('be', { apps: DEFAULT_APPS.be }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', private: true }));
  fs.writeFileSync(path.join(dir, 'sonar-project.properties'), 'sonar.sources=be/src\n');
  for (const file of ['be/src/a.ts', 'be/src/b.ts']) { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), 'export {};\n'); }
  fs.mkdirSync(path.join(dir, 'fe'), { recursive: true });
  for (const side of ['be', 'fe']) fakeLintCanon(path.join(dir, side));
  if (messages !== null) {
    fakeLinter(path.join(dir, 'be'), 'eslint', [{ filePath: path.join(dir, 'be', 'src', 'a.ts'), messages }, { filePath: path.join(dir, 'be', 'src', 'b.ts'), messages: [] }]);
    fakeLinter(path.join(dir, 'fe'), 'eslint', []);
  }
  fakeLinter(path.join(dir, 'fe'), 'stylelint', [], 'stderr');
  return dir;
};
const hfsOf = (...findings) => async () => ({ findings, tracked: [] });
const finding = (code, file) => ({ level: 'error', code, path: file, message: `${code} message` });
const run = (dir, argv, hfsCheck) => lintRepository({ repoRoot: dir, opts: parseLintArgs(argv), hfsCheck, trackedFiles: () => ['be/src/a.ts', 'be/src/b.ts'] });

test('a clean repository exits 0 with ok true and an empty sonar document', async () => {
  const { report, sonar, exit } = await run(repoWith([]), [], hfsOf());
  assert.equal(exit, 0);
  assert.equal(report.ok, true);
  assert.equal(report.schema, 'starci/lint@1');
  assert.deepEqual(report.counts, { error: 0 });
  assert.deepEqual(sonar.issues, []);
});

test('an ESLint finding with a [CODE] message exits 1, carries its code, and is an eslint issue on that file and line in the sonar document', async () => {
  const dir = repoWith([{ ruleId: 'starci-be/tier-direction', line: 7, column: 3, message: '[BE_TIER_DIRECTION] a service imports a controller' }]);
  const { report, sonar, exit } = await run(dir, [], hfsOf());
  assert.equal(exit, 1);
  assert.equal(report.ok, false);
  assert.deepEqual(report.findings.map((f) => [f.engine, f.rule, f.code, f.path, f.line]), [['eslint', 'starci-be/tier-direction', 'BE_TIER_DIRECTION', 'be/src/a.ts', 7]]);
  assert.deepEqual(sonar.issues.map((i) => [i.ruleId, i.primaryLocation.filePath, i.primaryLocation.textRange.startLine]), [['starci-be/tier-direction', 'be/src/a.ts', 7]]);
  assert.equal(sonar.rules.find((rule) => rule.id === 'starci-be/tier-direction').engineId, 'eslint');
});

test('--changed keeps an hfs finding with no path and one on a changed file, and drops one on an unchanged file', async () => {
  const dir = repoWith([]);
  const hfsCheck = hfsOf(finding('HFS_PIN_DRIFT', null), finding('HFS_X', 'be/src/b.ts'), finding('HFS_Y', 'be/src/a.ts'));
  const { report, exit } = await run(dir, ['--changed', 'be/src/a.ts'], hfsCheck);
  assert.equal(exit, 1);
  assert.deepEqual(report.findings.map((f) => f.code).sort(), ['HFS_PIN_DRIFT', 'HFS_Y']);
  assert.deepEqual(report.changed, ['be/src/a.ts']);
  const whole = await run(dir, [], hfsCheck);
  assert.equal(whole.report.findings.length, 3, 'without --changed every repository finding stays');
});

test('a missing ESLint install is exit 2 with an error, never a pass', async () => {
  const { report, exit } = await run(repoWith(null), [], hfsOf());
  assert.equal(exit, 2);
  assert.equal(report.ok, false);
  assert.match(report.errors[0], /eslint is not installed/);
});

test('a crashed starci app check is exit 2, not a pass', async () => {
  const { report, exit } = await run(repoWith([]), [], async () => { throw new Error('boom'); });
  assert.equal(exit, 2);
  assert.match(report.errors[0], /starci app check could not run: boom/);
});

test('the merged sonar document holds the rules of both engines, sorted', async () => {
  const dir = repoWith([{ ruleId: 'starci-be/zeta', line: 2, message: 'z' }, { ruleId: 'starci-be/alpha', line: 1, message: 'a' }]);
  const { sonar } = await run(dir, [], hfsOf(finding('HFS_SLOT_UNDECLARED', 'be/src/b.ts')));
  const ids = sonar.rules.map((rule) => rule.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.deepEqual(ids, ['HFS_SLOT_UNDECLARED', 'starci-be/alpha', 'starci-be/zeta']);
  assert.deepEqual(new Set(sonar.rules.map((rule) => rule.engineId)), new Set(['eslint', 'starci-hfs']));
  assert.equal(sonar.issues.length, 3);
});

test('parseLintArgs takes every argument after --changed up to the next flag, and refuses what it does not know', () => {
  const opts = parseLintArgs(['--changed', 'a.ts', './b\\c.ts', '--format', 'json']);
  assert.deepEqual(opts.changed, ['a.ts', 'b/c.ts']);
  assert.equal(opts.format, 'json');
  assert.equal(parseLintArgs(['--fix']).fix, true);
  assert.equal(parseLintArgs([]).changed, null);
  // The catalog's list flag reaches @starci/hfs as `--changed a --changed b` (packages/cli/src/validate-args.mjs): every one counts.
  assert.deepEqual(parseLintArgs(['--changed', 'a.ts', '--changed', 'b.ts', 'c.ts', '--format', 'json']).changed, ['a.ts', 'b.ts', 'c.ts']);
  assert.throws(() => parseLintArgs(['--format', 'xml']), /text or json/);
  assert.throws(() => parseLintArgs(['--nope']), /unknown argument/);
  assert.throws(() => parseLintArgs(['--sonar']), /needs a value/);
});

/** repoWith plus the fe workspace fe/apps/app (its package.json), and an fe ESLint that reports `messages` on fe/apps/app/src/page.tsx. */
const workspaceRepo = (messages) => {
  const dir = repoWith([{ ruleId: 'starci-be/zeta', line: 2, message: 'a be finding' }]);
  fs.mkdirSync(path.join(dir, 'fe', 'apps', 'app', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'fe', 'apps', 'app', 'package.json'), JSON.stringify({ name: '@demo/app', private: true }));
  fs.writeFileSync(path.join(dir, 'fe', 'apps', 'app', 'src', 'page.tsx'), 'export {};\n');
  fakeLinter(path.join(dir, 'fe'), 'eslint', [{ filePath: path.join(dir, 'fe', 'apps', 'app', 'src', 'page.tsx'), messages }]);
  return dir;
};

test('--workspace reports a finding inside the workspace and drops one outside it (another workspace, the be side)', async () => {
  const dir = workspaceRepo([{ ruleId: 'starci-fe/leaf', line: 4, message: '[FE_X] inside' }]);
  const hfsCheck = hfsOf(finding('HFS_IN', 'fe/apps/app/src/page.tsx'), finding('HFS_OTHER_WS', 'fe/apps/landing/src/page.tsx'), finding('HFS_BE', 'be/src/a.ts'), finding('HFS_NO_PATH', null));
  const { report, exit } = await run(dir, ['--workspace', 'fe/apps/app'], hfsCheck);
  assert.equal(exit, 1);
  assert.equal(report.workspace, 'fe/apps/app');
  assert.deepEqual(report.findings.map((f) => [f.engine, f.code, f.path]).sort(), [['eslint', 'FE_X', 'fe/apps/app/src/page.tsx'], ['hfs', 'HFS_IN', 'fe/apps/app/src/page.tsx']]);
  assert.match(report.engines.eslint.sides.be.skipped, /outside --workspace/);
  const whole = await run(dir, [], hfsCheck);
  assert.equal(whole.report.findings.filter((f) => f.engine === 'hfs').length, 4, 'the root lint keeps every app finding');
});

test('--workspace with nothing inside it is clean, though the app has findings elsewhere', async () => {
  const dir = workspaceRepo([]);
  const { report, exit } = await run(dir, ['--workspace', 'fe/apps/app'], hfsOf(finding('HFS_BE', 'be/src/a.ts')));
  assert.equal(exit, 0);
  assert.equal(report.ok, true);
});

test('--workspace refuses a folder that is not an fe workspace (exit 2, never a pass)', async () => {
  const dir = workspaceRepo([]);
  for (const bad of ['be/apps/core', 'fe', 'fe/apps/app/src', 'fe/apps/missing']) {
    const { report, exit } = await run(dir, ['--workspace', bad], hfsOf());
    assert.equal(exit, 2, bad);
    assert.equal(report.ok, false, bad);
  }
});

test('parseLintArgs takes --workspace and refuses it with --changed', () => {
  assert.equal(parseLintArgs(['--workspace', 'fe/apps/app']).workspace, 'fe/apps/app');
  assert.throws(() => parseLintArgs(['--workspace', 'fe/apps/app', '--changed', 'a.ts']), /do not combine/);
});

test('ESLint must return every requested source in changed, whole-app and workspace modes', async (t) => {
  for (const mode of ['changed', 'whole', 'workspace']) {
    const dir = mode === 'workspace' ? workspaceRepo([]) : repoWith([]);
    const side = mode === 'workspace' ? 'fe' : 'be', entry = path.join(dir, side, 'node_modules', 'eslint', 'bin.js');
    const argv = mode === 'changed' ? ['--changed', 'be/src/a.ts'] : mode === 'workspace' ? ['--workspace', 'fe/apps/app'] : [];
    const results = mode === 'whole' ? [{ filePath: path.join(dir, 'be', 'src', 'a.ts'), messages: [] }] : [];
    const measured = await withSpawnResult(t, (command, args) => command === process.execPath && args.includes(entry),
      { status: 0, stdout: JSON.stringify(results), stderr: '' }, () => run(dir, argv, hfsOf()));
    assert.equal(measured.exit, 2, mode);
    assert.equal(measured.report.ok, false);
    assert.match(measured.report.errors.join('\n'), /no result for requested source files/);
  }
});

test('malformed, suppressed, duplicate and foreign ESLint results cannot prove a completed lint', async (t) => {
  const dir = repoWith([]), entry = path.join(dir, 'be', 'node_modules', 'eslint', 'bin.js');
  const good = { filePath: path.join(dir, 'be', 'src', 'a.ts'), messages: [] };
  for (const results of [[null], [{ ...good, messages: {} }], [{ ...good, suppressedMessages: {} }],
    [{ ...good, suppressedMessages: [{ ruleId: 'hidden', message: 'suppressed finding' }] }], [good, good],
    [{ ...good, filePath: path.join(dir, 'be', 'src', 'b.ts') }]]) {
    const measured = await withSpawnResult(t, (command, args) => command === process.execPath && args.includes(entry),
      { status: 0, stdout: JSON.stringify(results), stderr: '' }, () => run(dir, ['--changed', 'be/src/a.ts'], hfsOf()));
    assert.equal(measured.exit, 2);
    assert.equal(measured.report.ok, false);
    assert.match(measured.report.errors.join('\n'), /malformed|suppressed|duplicate|outside the requested scope/);
  }
});

test('whole-app coverage uses installed canon selectors and ignores, rather than a second source policy', async () => {
  const dir = repoWith([]), cwd = path.join(dir, 'be');
  fakeLintCanon(cwd, { files: ['owned/**/*.mts'], ignores: ['owned/generated/**', '**/node_modules/**'] });
  for (const file of ['owned/a.mts', 'owned/generated/skip.mts']) { fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true }); fs.writeFileSync(path.join(cwd, file), 'export {};\n'); }
  fakeLinter(cwd, 'eslint', [{ filePath: path.join(cwd, 'owned', 'a.mts'), messages: [] }]);
  const measured = await run(dir, [], hfsOf());
  assert.equal(measured.exit, 0);
  assert.equal(measured.report.engines.eslint.sides.be.files, 1);
});

test('unavailable canon selectors fail closed, while deleted changed files owe no linter result', async () => {
  const dir = repoWith([]);
  fs.rmSync(path.join(dir, 'be', 'node_modules', '@starci', 'eslint-canon-be'), { recursive: true });
  const unavailable = await run(dir, [], hfsOf());
  assert.equal(unavailable.exit, 2);
  assert.match(unavailable.report.errors.join('\n'), /source scope is unavailable/);
  const deleted = await run(dir, ['--changed', 'be/src/deleted.ts'], hfsOf());
  assert.equal(deleted.exit, 0);
  assert.match(deleted.report.engines.eslint.sides.be.skipped, /no changed source file/);
});

test('an explicit ignored-file warning is a blocking measured result, rather than missing coverage', async () => {
  const dir = repoWith([]);
  fakeLinter(path.join(dir, 'be'), 'eslint', [{ filePath: path.join(dir, 'be', 'src', 'a.ts'), messages: [{ ruleId: null, severity: 1, message: 'File ignored because of a matching ignore pattern.' }] }]);
  const measured = await run(dir, ['--changed', 'be/src/a.ts'], hfsOf());
  assert.equal(measured.exit, 1);
  assert.deepEqual(measured.report.errors, []);
  assert.equal(measured.report.findings.length, 1);
});

test('a valid linter report never masks a failed or unknown child and retains reported findings', async (t) => {
  for (const pkg of ['eslint', 'stylelint']) {
    const dir = repoWith([]), entry = path.join(dir, pkg === 'eslint' ? 'be' : 'fe', 'node_modules', pkg, 'bin.js');
    const file = pkg === 'eslint' ? 'be/src/a.ts' : 'fe/src/a.css';
    if (pkg === 'stylelint') { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), 'a {}\n'); }
    const message = { ruleId: 'fixture-rule', rule: 'fixture-rule', line: 1, message: 'retained finding', text: 'retained finding' };
    const results = [{ filePath: path.join(dir, file), source: path.join(dir, file), messages: [message], warnings: [message] }];
    for (const sample of [
      { status: 1 }, { status: 2 }, { status: 9 }, { status: null }, { status: undefined }, { status: '0' },
      { status: 0, error: new Error('child spawn failed') }, { status: 0, signal: 'SIGTERM' },
      { status: 2, findings: true }, { status: 1, error: new Error('child spawn failed'), findings: true },
    ]) {
      const json = JSON.stringify(sample.findings ? results : []);
      const child = { status: sample.status, error: sample.error, signal: sample.signal ?? null,
        stdout: pkg === 'eslint' ? json : '', stderr: pkg === 'stylelint' ? json : '' };
      let calls = 0;
      const measured = await withSpawnResult(t, (command, args) => {
        const matched = command === process.execPath && args.includes(entry); if (matched) calls += 1; return matched;
      }, child, () => run(dir, ['--changed', file], hfsOf()));
      assert.equal(calls, 1, `${pkg}: the real lint entry must reach the selected child`);
      assert.equal(measured.exit, 2, `${pkg} ${String(sample.status)}`);
      assert.equal(measured.report.ok, false);
      assert.match(measured.report.errors.join('\n'), /could not complete/);
      if (sample.error) assert.match(measured.report.errors.join('\n'), /child spawn failed/);
      if (sample.signal) assert.match(measured.report.errors.join('\n'), /SIGTERM/);
      assert.equal(measured.report.findings.length, sample.findings ? 1 : 0, 'tool failure retains the child findings');
      assert.equal(measured.sonar.issues.length, sample.findings ? 1 : 0);
    }
  }
});

test('real linter exits 1 with findings remain measured findings, not tool failures', async () => {
  for (const pkg of ['eslint', 'stylelint']) {
    const dir = repoWith([]), side = path.join(dir, pkg === 'eslint' ? 'be' : 'fe');
    const file = pkg === 'eslint' ? 'be/src/a.ts' : 'fe/src/a.css';
    if (pkg === 'stylelint') { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), 'a {}\n'); }
    const entry = path.join(side, 'node_modules', pkg, 'bin.js');
    const message = { ruleId: 'fixture-rule', rule: 'fixture-rule', line: 1, message: 'measured finding', text: 'measured finding' };
    fakeLinter(side, pkg, [{ filePath: path.join(dir, file), source: path.join(dir, file), messages: [message], warnings: [message] }], pkg === 'stylelint' ? 'stderr' : 'stdout');
    fs.appendFileSync(entry, 'process.exitCode = 1;\n');
    const measured = await run(dir, ['--changed', file], hfsOf());
    assert.equal(measured.exit, 1, pkg);
    assert.equal(measured.report.ok, false);
    assert.deepEqual(measured.report.errors, []);
    assert.equal(measured.report.findings.length, 1);
    assert.equal(measured.sonar.issues.length, 1);
  }
});
