import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { winPath } from '../fixtures/win-path.mjs';
import { checkExamples, exampleDirs, formatResults, main } from '../../scripts/checks/check-example-architecture.mjs';

// The examples gate runs `starci app lint --format json` at the root of each example app and reads the one lint report (starci/lint@1).
// A real lint of an installed app takes a TypeScript program per side, so most specs hand the gate a stub CLI that answers the
// report a real run would print for each example by name; the gate's own job - which directories are examples, how a report
// becomes a verdict and a count per code, when the run is not a pass - is what is judged there. The last spec runs the real
// `starci` bin (packages/cli/bin/starci.mjs over @starci/hfs) on an example that installs nothing.
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

/** A stub starci CLI: `app lint --format json` prints the report of the example named like its working directory, anything else not a report. */
function stubCli(dir) {
  const bin = path.join(dir, 'starci-stub.mjs');
  fs.writeFileSync(bin, [
    "import path from 'node:path';",
    `const reports = ${JSON.stringify(REPORTS)};`,
    'const [group, verb, format, json] = process.argv.slice(2);',
    "const report = group === 'app' && verb === 'lint' && format === '--format' && json === 'json' ? reports[path.basename(process.cwd())] : undefined;",
    "console.log(report ? JSON.stringify({ ...report, repoRoot: process.cwd(), changed: null, workspace: null }) : 'not a report');",
    'process.exitCode = report?.errors?.length ? 2 : report?.counts?.error ? 1 : 0;',
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

test('without a stub the gate runs the real starci bin at the example root: a starci/lint@1 report, never a missing entry', () => {
  const { dir } = examples(['bare']);
  const [bare] = checkExamples({ examplesDir: dir });
  // The bare example declares no sides and installs nothing: the real lint answers with its refusal, so it could not run.
  assert.equal(bare.status, 'unrunnable');
  assert.match(bare.detail, /starci app lint runs at the app root/);
  assert.doesNotMatch(bare.detail, /hfs\.mjs|Cannot find module|not a report/);
});


test('clean JSON cannot qualify a failed, interrupted or unknown native lint child', () => {
  const { dir, bin } = examples(['clean']);
  const clean = { ...REPORTS.clean, repoRoot: path.join(dir, 'clean'), changed: null, workspace: null };
  const outcomes = [
    { status: null }, { status: '0' }, { status: 3 }, { status: 2 }, { status: 1 },
    { status: 0, error: new Error('spawn failed') }, { status: 0, signal: 'SIGTERM' },
  ];
  for (const outcome of outcomes) {
    const runner = () => ({ status: 0, error: null, signal: null, stdout: JSON.stringify(clean), stderr: '', ...outcome });
    assert.equal(checkExamples({ examplesDir: dir, bin, runner })[0].status, 'unrunnable');
    assert.equal(main(['--examples', dir], { bin, runner, out: () => {}, err: () => {} }), 1);
  }
});

test('the example gate refuses malformed counts and a clean report outside its whole-app scope', () => {
  const { dir, bin } = examples(['clean']);
  const clean = { ...REPORTS.clean, repoRoot: path.join(dir, 'clean'), changed: null, workspace: null };
  const reports = [
    { ...clean, schema: 'foreign/lint@1' }, { ...clean, ok: false },
    { ...clean, counts: { error: -1 } }, { ...clean, counts: { error: 0.5 } },
    { ...clean, counts: { error: 1 } }, { ...clean, errors: 'none' },
    { ...clean, findings: [null] }, { ...clean, repoRoot: dir },
    { ...clean, changed: [] }, { ...clean, workspace: 'fe/apps/portal' },
  ];
  for (const report of reports) {
    const runner = () => ({ status: 0, error: null, signal: null, stdout: JSON.stringify(report), stderr: '' });
    assert.equal(checkExamples({ examplesDir: dir, bin, runner })[0].status, 'unrunnable');
  }
  const dirty = { ...REPORTS.dirty, repoRoot: path.join(dir, 'clean'), changed: null, workspace: null };
  const runner = () => ({ status: 0, error: null, signal: null, stdout: JSON.stringify(dirty), stderr: '' });
  assert.equal(checkExamples({ examplesDir: dir, bin, runner })[0].status, 'unrunnable');
});

test('diagnostic locations preserve public source coordinates and slots without copying raw finding fields', () => {
  const { dir, bin } = examples(['dirty']);
  const findings = [
    { code: 'PUBLIC_CODE', rule: 'starci-be/public-rule', slot: 'be.modules.domain', path: 'be\\src\\modules\\domain\\order.ts', line: 27, column: 4, message: 'raw-private-message', engine: 'eslint', severity: 'error' },
    { code: null, rule: 'starci-fe/public-rule', path: 'fe/src/app/page.tsx', line: 9, column: 2 },
    { code: 'ROOT_CODE', path: '.', slot: 'app.root' },
  ];
  const report = { ...REPORTS.dirty, counts: { error: findings.length }, findings, repoRoot: path.join(dir, 'dirty'), changed: null, workspace: null };
  const runner = (args, options) => {
    assert.deepEqual(args, [bin, 'app', 'lint', '--format', 'json']);
    assert.equal(options.cwd, path.join(dir, 'dirty'));
    return { status: 1, error: null, signal: null, stdout: JSON.stringify(report), stderr: '' };
  };
  const [result] = checkExamples({ examplesDir: dir, bin, runner });
  assert.equal(result.status, 'findings');
  assert.equal(result.errors, 3);
  assert.deepEqual(result.byCode, { PUBLIC_CODE: 1, 'starci-fe/public-rule': 1, ROOT_CODE: 1 });
  assert.deepEqual(result.findings, [
    { code: 'PUBLIC_CODE', rule: 'starci-be/public-rule', slot: 'be.modules.domain', path: 'be/src/modules/domain/order.ts', line: 27, column: 4 },
    { code: 'starci-fe/public-rule', rule: 'starci-fe/public-rule', path: 'fe/src/app/page.tsx', line: 9, column: 2 },
    { code: 'ROOT_CODE', path: '.', slot: 'app.root' },
  ]);
  const text = formatResults([result]);
  assert.match(text, /be\/src\/modules\/domain\/order\.ts:27:4  PUBLIC_CODE \(starci-be\/public-rule\) slot:be\.modules\.domain/);
  assert.match(text, /fe\/src\/app\/page\.tsx:9:2  starci-fe\/public-rule/);
  assert.doesNotMatch(text, /raw-private-message|severity|eslint/);
  assert.equal(main(['--examples', dir], { bin, runner, out: () => {}, err: () => {} }), 1);
});

test('unsafe, private and missing finding paths are omitted without reducing the verdict or counts', () => {
  const { dir, bin } = examples(['dirty']);
  const paths = [
    'be/src/first\nsecond.ts', 'be/src/first\rsecond.ts', 'be/src/first\u0000second.ts', 'be/src/first\u007fsecond.ts',
    '../private.ts', 'be/../private.ts', 'be/./private.ts', 'be//private.ts',
    '/tmp/private.ts', winPath('C', 'Users', 'fixture', 'private.ts'), '\\\\server\\share\\private.ts',
    '.git/config', 'be/.STARCIWORK/runtime.sqlite', 'fe/node_modules/package/index.ts',
    '.env', 'be/.env.local', 'credentials.toml', 'be/credentials.json',
    'be/src/invalid?.ts', 'a'.repeat(513), '', null, 42, undefined,
  ];
  assert.equal(paths[0].charCodeAt('be/src/first'.length), 10);
  const findings = paths.map((file) => ({ code: 'PUBLIC_CODE', path: file, line: 1, message: 'raw-private-message' }));
  const report = { ...REPORTS.dirty, counts: { error: findings.length }, findings, repoRoot: path.join(dir, 'dirty'), changed: null, workspace: null };
  const runner = () => ({ status: 1, error: null, signal: null, stdout: JSON.stringify(report), stderr: '' });
  const [result] = checkExamples({ examplesDir: dir, bin, runner });
  assert.equal(result.status, 'findings');
  assert.equal(result.errors, findings.length);
  assert.deepEqual(result.byCode, { PUBLIC_CODE: findings.length });
  assert.deepEqual(result.findings, []);
  const text = formatResults([result]);
  assert.match(text, new RegExp(`PUBLIC_CODE x${findings.length}`));
  assert.match(text, new RegExp(`${findings.length} finding location\\(s\\) not shown`));
  assert.doesNotMatch(text, /private\.ts|runtime\.sqlite|credentials|raw-private-message|first|second/);
  assert.equal(main(['--examples', dir], { bin, runner, out: () => {}, err: () => {} }), 1);
});

test('trailing newlines fail the token whitelist and invalid coordinates never become source positions', () => {
  const { dir, bin } = examples(['dirty']);
  const findings = [
    { code: 'PUBLIC_CODE\n', rule: 'PUBLIC_RULE', slot: 'be.modules.domain', path: 'be/src/unsafe-code.ts', line: 1, column: 1 },
    { code: 'PUBLIC_CODE', rule: 'PUBLIC_RULE\n', slot: 'be.modules.domain\n', path: 'be/src/safe.ts', line: 7, column: 2 },
    { code: 'PUBLIC_CODE', path: 'be/src/no-line.ts', line: 0, column: 3, slot: 'unsafe slot' },
    { code: 'PUBLIC_CODE', path: 'be/src/fractional-line.ts', line: 1.5, column: 3 },
    { code: 'PUBLIC_CODE', path: 'be/src/string-line.ts', line: '2', column: 3 },
    { code: 'PUBLIC_CODE', path: 'be/src/unsafe-integer-line.ts', line: Number.MAX_SAFE_INTEGER + 1, column: 3 },
    { code: 'PUBLIC_CODE', path: 'be/src/no-column.ts', line: 2, column: -1 },
    { code: 'PUBLIC_CODE', path: 'be/src/fractional-column.ts', line: 3, column: 1.5 },
    { code: 'PUBLIC_CODE', path: 'be/src/unsafe-integer-column.ts', line: 4, column: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const token of [findings[0].code, findings[1].rule, findings[1].slot]) assert.equal(token.charCodeAt(token.length - 1), 10);
  const report = { ...REPORTS.dirty, counts: { error: findings.length }, findings, repoRoot: path.join(dir, 'dirty'), changed: null, workspace: null };
  const runner = () => ({ status: 1, error: null, signal: null, stdout: JSON.stringify(report), stderr: '' });
  const [result] = checkExamples({ examplesDir: dir, bin, runner });
  assert.equal(result.status, 'findings');
  assert.equal(result.errors, findings.length);
  assert.deepEqual(result.byCode, { 'PUBLIC_CODE\n': 1, PUBLIC_CODE: 8 });
  assert.deepEqual(result.findings, [
    { code: 'PUBLIC_CODE', path: 'be/src/safe.ts', line: 7, column: 2 },
    { code: 'PUBLIC_CODE', path: 'be/src/no-line.ts' },
    { code: 'PUBLIC_CODE', path: 'be/src/fractional-line.ts' },
    { code: 'PUBLIC_CODE', path: 'be/src/string-line.ts' },
    { code: 'PUBLIC_CODE', path: 'be/src/unsafe-integer-line.ts' },
    { code: 'PUBLIC_CODE', path: 'be/src/no-column.ts', line: 2 },
    { code: 'PUBLIC_CODE', path: 'be/src/fractional-column.ts', line: 3 },
    { code: 'PUBLIC_CODE', path: 'be/src/unsafe-integer-column.ts', line: 4 },
  ]);
  const text = formatResults([result]);
  assert.match(text, /be\/src\/safe\.ts:7:2  PUBLIC_CODE/);
  assert.doesNotMatch(text, /unsafe-code\.ts|PUBLIC_RULE|slot:|no-line\.ts:/);
  assert.match(text, /1 finding location\(s\) not shown/);
  assert.equal(main(['--examples', dir], { bin, runner, out: () => {}, err: () => {} }), 1);
});

test('the location cap retains the first 100 eligible rows and all original finding counts', () => {
  const { dir, bin } = examples(['dirty']);
  const valid = Array.from({ length: 103 }, (_, index) => ({ code: 'PUBLIC_CODE', path: `be/src/file-${index}.ts`, line: index + 1 }));
  const findings = [{ code: 'PUBLIC_CODE', path: '../private.ts' }, { code: 'PUBLIC_CODE', path: '.env.local' }, ...valid];
  const report = { ...REPORTS.dirty, counts: { error: findings.length }, findings, repoRoot: path.join(dir, 'dirty'), changed: null, workspace: null };
  const runner = () => ({ status: 1, error: null, signal: null, stdout: JSON.stringify(report), stderr: '' });
  const [result] = checkExamples({ examplesDir: dir, bin, runner });
  assert.equal(result.status, 'findings');
  assert.equal(result.errors, 105);
  assert.deepEqual(result.byCode, { PUBLIC_CODE: 105 });
  assert.deepEqual(result.findings, valid.slice(0, 100));
  const text = formatResults([result]);
  assert.equal(text.split('\n').filter((line) => line.startsWith('  be/src/file-')).length, 100);
  assert.match(text, /PUBLIC_CODE x105/);
  assert.match(text, /5 finding location\(s\) not shown/);
  assert.doesNotMatch(text, /file-10[0-2]\.ts|private\.ts|\.env\.local/);
  assert.equal(main(['--examples', dir], { bin, runner, out: () => {}, err: () => {} }), 1);
});

test('location-rich reports still require whole-app binding and matching native exit, and an empty example set fails', () => {
  const { dir, bin } = examples(['dirty']);
  const report = { ...REPORTS.dirty, counts: { error: 1 }, findings: [{ code: 'PUBLIC_CODE', path: 'be/src/refused-location.ts', line: 4, column: 2 }], repoRoot: path.join(dir, 'dirty'), changed: null, workspace: null };
  const outcomes = [
    { report: { ...report, repoRoot: dir }, status: 1 },
    { report: { ...report, changed: [] }, status: 1 },
    { report: { ...report, workspace: 'fe/apps/portal' }, status: 1 },
    { report, status: 0 },
  ];
  for (const outcome of outcomes) {
    const runner = () => ({ status: outcome.status, error: null, signal: null, stdout: JSON.stringify(outcome.report), stderr: '' });
    const [result] = checkExamples({ examplesDir: dir, bin, runner });
    assert.equal(result.status, 'unrunnable');
    assert.equal(result.errors, 1);
    assert.deepEqual(result.byCode, {});
    assert.equal(Object.hasOwn(result, 'findings'), false);
    assert.doesNotMatch(formatResults([result]), /refused-location\.ts/);
    assert.equal(main(['--examples', dir], { bin, runner, out: () => {}, err: () => {} }), 1);
  }
  const empty = examples([]);
  assert.deepEqual(checkExamples({ examplesDir: empty.dir, bin: empty.bin }), []);
  assert.equal(main(['--examples', empty.dir], { bin: empty.bin, out: () => {}, err: () => {} }), 1);
});
