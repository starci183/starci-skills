// hfs lint (packages/hfs/lint/run.mjs): the ONE lint entry over a hermetic temp repository with a fake ESLint install and injected
// hfsCheck / trackedFiles. The fake eslint is a package with a `bin` that prints a fixed json result array.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lintRepository, parseLintArgs } from '../packages/hfs/lint/run.mjs';

const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const fakeEslint = (dir, output) => {
  const pkg = path.join(dir, 'node_modules', 'eslint');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'eslint', version: '9.0.0', bin: { eslint: 'bin.js' } }));
  fs.writeFileSync(path.join(pkg, 'bin.js'), `process.stdout.write(${JSON.stringify(JSON.stringify(output))});\n`);
};
/** A temp repository; `messages` are the ESLint messages on src/a.ts (null: no ESLint install at all). */
const repoWith = (messages) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lint-'));
  made.push(dir);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'demo', private: true }));
  fs.writeFileSync(path.join(dir, 'sonar-project.properties'), 'sonar.sources=src\n');
  for (const file of ['src/a.ts', 'src/b.ts']) { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), 'export {};\n'); }
  if (messages !== null) fakeEslint(dir, messages.length ? [{ filePath: path.join(dir, 'src', 'a.ts'), messages }] : []);
  return dir;
};
const hfsOf = (...findings) => async () => ({ findings, tracked: [] });
const finding = (code, file) => ({ level: 'error', code, path: file, message: `${code} message` });
const run = (dir, argv, hfsCheck) => lintRepository({ repoRoot: dir, opts: parseLintArgs(argv), hfsCheck, trackedFiles: () => ['src/a.ts', 'src/b.ts'] });

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
  assert.deepEqual(report.findings.map((f) => [f.engine, f.rule, f.code, f.path, f.line]), [['eslint', 'starci-be/tier-direction', 'BE_TIER_DIRECTION', 'src/a.ts', 7]]);
  assert.deepEqual(sonar.issues.map((i) => [i.ruleId, i.primaryLocation.filePath, i.primaryLocation.textRange.startLine]), [['starci-be/tier-direction', 'src/a.ts', 7]]);
  assert.equal(sonar.rules.find((rule) => rule.id === 'starci-be/tier-direction').engineId, 'eslint');
});

test('--changed keeps an hfs finding with no path and one on a changed file, and drops one on an unchanged file', async () => {
  const dir = repoWith([]);
  const hfsCheck = hfsOf(finding('HFS_PIN_DRIFT', null), finding('HFS_X', 'src/b.ts'), finding('HFS_Y', 'src/a.ts'));
  const { report, exit } = await run(dir, ['--changed', 'src/a.ts'], hfsCheck);
  assert.equal(exit, 1);
  assert.deepEqual(report.findings.map((f) => f.code).sort(), ['HFS_PIN_DRIFT', 'HFS_Y']);
  assert.deepEqual(report.changed, ['src/a.ts']);
  const whole = await run(dir, [], hfsCheck);
  assert.equal(whole.report.findings.length, 3, 'without --changed every repository finding stays');
});

test('a missing ESLint install is exit 2 with an error, never a pass', async () => {
  const { report, exit } = await run(repoWith(null), [], hfsOf());
  assert.equal(exit, 2);
  assert.equal(report.ok, false);
  assert.match(report.errors[0], /eslint is not installed/);
});

test('a crashed hfs check is exit 2, not a pass', async () => {
  const { report, exit } = await run(repoWith([]), [], async () => { throw new Error('boom'); });
  assert.equal(exit, 2);
  assert.match(report.errors[0], /hfs check could not run: boom/);
});

test('the merged sonar document holds the rules of both engines, sorted', async () => {
  const dir = repoWith([{ ruleId: 'starci-be/zeta', line: 2, message: 'z' }, { ruleId: 'starci-be/alpha', line: 1, message: 'a' }]);
  const { sonar } = await run(dir, [], hfsOf(finding('HFS_SLOT_UNDECLARED', 'src/b.ts')));
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
  assert.throws(() => parseLintArgs(['--format', 'xml']), /text or json/);
  assert.throws(() => parseLintArgs(['--nope']), /unknown argument/);
  assert.throws(() => parseLintArgs(['--sonar']), /needs a value/);
});
