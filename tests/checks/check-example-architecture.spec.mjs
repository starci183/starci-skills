import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkExamples, exampleDirs, formatResults, main } from '../../scripts/checks/check-example-architecture.mjs';

// The examples gate runs `hfs lint --repo <example> --format json` per example app and reads the one lint report (starci/lint@1).
// A real lint of an app takes a TypeScript program per side, so these specs hand the gate a stub CLI that answers the report a
// real run would print for each example by name; the gate's own job - which directories are examples, how a report becomes
// a verdict and a count per code, when the run is not a pass - is what is judged here.
const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const finding = (engine, rule, code, file) => ({ engine, rule, code, severity: 'error', path: file, line: 1, column: 1, message: `${code ?? rule} on ${file}` });
const REPORTS = {
  clean: { schema: 'starci/lint@1', ok: true, counts: { error: 0 }, errors: [], findings: [] },
  dirty: {
    schema: 'starci/lint@1', ok: false, counts: { error: 3 }, errors: [],
    findings: [
      finding('hfs', 'HFS_EMPTY_DIR', 'HFS_EMPTY_DIR', 'be/src/modules/business'),
      finding('eslint', 'starci-be/feature-not-composed', 'BE_FEATURE_NOT_COMPOSED', 'be/src/modules/domain/order/index.ts'),
      finding('eslint', 'starci-be/require-export-jsdoc', null, 'be/src/modules/domain/order/index.ts'),
    ],
  },
  broken: { schema: 'starci/lint@1', ok: false, counts: { error: 0 }, errors: ['eslint could not run in be/: Cannot find package eslint'], findings: [] },
};

/** A stub hfs CLI: `lint --repo <dir> --format json` prints the report of the example named like <dir>, anything else prints nothing. */
function stubCli(dir) {
  const bin = path.join(dir, 'hfs-stub.mjs');
  fs.writeFileSync(bin, [
    "import path from 'node:path';",
    `const reports = ${JSON.stringify(REPORTS)};`,
    'const [command, flag, repo, format, json] = process.argv.slice(2);',
    "const report = command === 'lint' && flag === '--repo' && format === '--format' && json === 'json' ? reports[path.basename(repo)] : undefined;",
    "console.log(report ? JSON.stringify(report) : 'not a report');",
    '',
  ].join('\n'));
  return bin;
}

/** An examples directory: the named apps (each with an hfs.json), plus a directory with no hfs.json. */
function examples(names) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-examples-'));
  made.push(dir);
  for (const name of names) {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, 'hfs.json'), '{ "hfs": 2, "kind": "app" }\n');
  }
  fs.mkdirSync(path.join(dir, 'not-an-example'));
  fs.writeFileSync(path.join(dir, 'not-an-example', 'README.md'), '# nothing\n');
  return { dir, bin: stubCli(dir) };
}

test('only directories with an hfs.json are examples', () => {
  const { dir } = examples(['clean', 'dirty']);
  assert.deepEqual(exampleDirs(dir), ['clean', 'dirty']);
  assert.deepEqual(exampleDirs(dir, 'dirty'), ['dirty']);
});

test('a clean example passes and a dirty one fails with its lint findings counted by code, a finding with no code by its rule', () => {
  const { dir, bin } = examples(['clean', 'dirty']);
  const results = checkExamples({ examplesDir: dir, bin });
  const [clean, dirty] = results;
  assert.deepEqual([clean.name, clean.status, clean.errors], ['clean', 'clean', 0]);
  assert.equal(dirty.name, 'dirty');
  assert.equal(dirty.status, 'findings');
  assert.deepEqual(dirty.byCode, { HFS_EMPTY_DIR: 1, BE_FEATURE_NOT_COMPOSED: 1, 'starci-be/require-export-jsdoc': 1 });
  const text = formatResults(results);
  assert.match(text, /clean: clean/);
  assert.match(text, /dirty: 3 findings/);
  assert.match(text, /BE_FEATURE_NOT_COMPOSED x1/);
  assert.match(text, /1 of 2 examples not clean/);
});

test('the gate exits 1 while any example has a finding, 0 when every one is clean, 2 on a bad argument', () => {
  const { dir, bin } = examples(['clean', 'dirty']);
  let out = '';
  assert.equal(main(['--examples', dir], { out: (s) => { out += s; }, err: () => {}, bin }), 1);
  assert.match(out, /dirty: 3 findings/);
  assert.equal(main(['--examples', dir, '--only', 'clean'], { out: () => {}, err: () => {}, bin }), 0);
  assert.equal(main(['--nope'], { err: () => {} }), 2);
});

test('an example whose lint could not run is unrunnable and fails, never skipped: a tool error or no report at all', () => {
  const { dir, bin } = examples(['broken', 'silent']);
  const [broken, silent] = checkExamples({ examplesDir: dir, bin });
  assert.equal(broken.status, 'unrunnable');
  assert.match(formatResults([broken]), /broken: the check could not run \(eslint could not run in be\/: Cannot find package eslint\)/);
  assert.equal(silent.status, 'unrunnable');
  assert.match(formatResults([silent]), /silent: the check could not run \(not a report\)/);
  assert.equal(main(['--examples', dir], { out: () => {}, err: () => {}, bin }), 1);
});
