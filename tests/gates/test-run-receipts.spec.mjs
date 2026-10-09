// Required test receipts must bind real completion, exact counters and every selected scenario.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GATE_EXIT, runGate } from '../../scripts/gates/gate.mjs';
import { buildUnitRun } from '../../scripts/gates/unit-run.mjs';
import { buildTestWorldRun, jestRunError } from '../../scripts/gates/test-world-run.mjs';
import { judgeUnitRun, judgeTestWorld } from '../../scripts/kernel/gate-settle.mjs';
import { installBoundLintCanons, lintFixtureDeclaration } from '../helpers/lint-canon-fixture.mjs';

const put = (root, relative, bytes) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); return file; };
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-test-receipt-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  put(root, '.gitignore', 'node_modules/\n');
  put(root, 'package.json', JSON.stringify({ name: 'receipt-app', private: true }));
  put(root, 'hfs.json', JSON.stringify(lintFixtureDeclaration('receipt-app')) + '\n');
  put(root, 'be/package.json', '{"name":"receipt-be","private":true}\n');
  put(root, 'fe/package.json', '{"name":"receipt-fe","private":true}\n');
  // Jest configuration is an existing project input, not a new lint obligation of these receipt cases.
  put(root, 'jest.config.cjs', 'module.exports = {}\n');
  installBoundLintCanons(root);
  const git = (...args) => { const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }); assert.equal(run.status, 0, run.stderr); return run.stdout.trim(); };
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'spec'); git('config', 'user.email', 'spec@starci.test'); git('config', 'commit.gpgsign', 'false');
  git('add', '-A'); git('commit', '-qm', 'receipt fixture');
  return { root, base: git('rev-parse', 'HEAD') };
}

function receipt({ pending = 0, todo = 0, failed = 0, total = 1, ...over } = {}) {
  const passed = total - pending - todo - failed;
  const assertionResults = ['passed', 'failed', 'pending', 'todo'].flatMap((status, i) =>
    Array.from({ length: [passed, failed, pending, todo][i] }, (_, n) => ({ status, title: `${status}-${n}`, fullName: `${status}-${n}`, failureMessages: status === 'failed' ? ['expected fixture failure'] : [] })));
  return { numTotalTests: total, numPassedTests: passed, numFailedTests: failed, numPendingTests: pending, numTodoTests: todo,
    numTotalTestSuites: 1, numPassedTestSuites: failed ? 0 : 1, numFailedTestSuites: failed ? 1 : 0,
    numPendingTestSuites: 0, numRuntimeErrorTestSuites: 0, success: failed === 0, wasInterrupted: false,
    testResults: [{ name: 'fixture.spec.ts', status: failed ? 'failed' : pending ? 'focused' : 'passed', assertionResults }], ...over };
}

// This is a real child process at the tool edge. It emits the supplied JSON before exiting, so exit status cannot be inferred from JSON.
const emitter = `const fs = require('node:fs');
const path = require('node:path');
const row = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules/jest/receipt.json'), 'utf8'));
const output = process.argv.find(a => a.startsWith('--outputFile=')).slice('--outputFile='.length);
fs.writeFileSync(output, JSON.stringify(row.report));
const coverage = process.argv.find(a => a.startsWith('--coverageDirectory='));
if (coverage) { const dir = coverage.slice('--coverageDirectory='.length); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'coverage-summary.json'), '{}'); }
fs.appendFileSync(path.join(process.cwd(), 'node_modules/jest/calls.txt'), 'called\\n');
process.exitCode = row.exit;
`;
function installEmitter(root) {
  put(root, 'jest.config.cjs', 'module.exports = {}\n');
  put(root, 'node_modules/jest/package.json', '{"name":"jest","version":"30.0.0"}\n');
  return put(root, 'node_modules/jest/bin/jest.js', emitter);
}
const writeReceipt = (root, report, exit = 0) => put(root, 'node_modules/jest/receipt.json', JSON.stringify({ report, exit }));
const cases = () => [
  ['pending', receipt({ pending: 1 }), 0, GATE_EXIT.findings],
  ['todo', receipt({ todo: 1 }), 0, GATE_EXIT.findings],
  ['zero', receipt({ total: 0 }), 0, GATE_EXIT.findings],
  ['JSON then nonzero', receipt(), 7, GATE_EXIT.toolFailed],
  ['numeric string', receipt({ numTotalTests: '1' }), 0, GATE_EXIT.toolFailed],
  ['negative count', receipt({ numPendingTests: -1 }), 0, GATE_EXIT.toolFailed],
  ['inconsistent total', receipt({ numTotalTests: 2 }), 0, GATE_EXIT.toolFailed],
  ['partial suites', receipt({ numTotalTestSuites: 2, numPassedTestSuites: 2 }), 0, GATE_EXIT.toolFailed],
  ['focused without pending', receipt({ testResults: [{ ...receipt().testResults[0], status: 'focused' }] }), 0, GATE_EXIT.toolFailed],
  ['focused with only todo', receipt({ todo: 1, testResults: [{ ...receipt({ todo: 1 }).testResults[0], status: 'focused' }] }), 0, GATE_EXIT.toolFailed],
  ['interrupted', receipt({ wasInterrupted: true }), 0, GATE_EXIT.toolFailed],
  ['unsuccessful', receipt({ success: false }), 0, GATE_EXIT.toolFailed],
];

test('gate tests require a complete actual process receipt; no --tests preserves the optional slice', async (t) => {
  const { root, base } = fixture(t); installEmitter(root);
  writeReceipt(root, receipt());
  const clean = await runGate({ root, base, changed: [], tests: 'fixture' });
  assert.equal(clean.exit, GATE_EXIT.clean, JSON.stringify(clean));
  assert.deepEqual([clean.steps.tests.exit, clean.steps.tests.total, clean.steps.tests.passed, clean.steps.tests.skipped], [0, 1, 1, 0]);
  assert.deepEqual(clean.steps.tests.testFiles, ['fixture.spec.ts']);
  for (const [label, report, exit, expected] of cases()) {
    writeReceipt(root, report, exit);
    const result = await runGate({ root, base, changed: [], tests: 'fixture' });
    assert.equal(result.exit, expected, `${label}: ${JSON.stringify(result)}`);
    assert.equal(result.ok, false, label);
    assert.equal(result.steps.tests.exit, exit, 'the actual child exit is retained');
  }
  writeReceipt(root, receipt({ failed: 1 }), 1);
  const red = await runGate({ root, base, changed: [], tests: 'fixture' });
  assert.equal(red.exit, GATE_EXIT.findings, JSON.stringify(red));
  assert.ok(red.findings.some(f => f.rule === 'test-failed'), 'ordinary failed assertions retain typed findings');
  const calls = fs.readFileSync(path.join(root, 'node_modules/jest/calls.txt'), 'utf8');
  const optional = await runGate({ root, base, changed: [] });
  assert.equal(optional.exit, GATE_EXIT.clean, JSON.stringify(optional));
  assert.equal(optional.steps.tests, null);
  assert.equal(fs.readFileSync(path.join(root, 'node_modules/jest/calls.txt'), 'utf8'), calls);
});

test('unit and test-world producers preserve real nonzero JSON output and refuse required pending or malformed runs', (t) => {
  const { root } = fixture(t), bin = installEmitter(root);
  put(root, 'be/jest.config.js', 'module.exports = require("@starci/jest-preset").starciJestConfig()\n');
  put(root, 'be/src/tests/world/test-world.config.ts', 'export const { useTestWorld } = defineTestWorld({ stack: ".starcistacks/dev" })\n');
  put(root, 'be/src/tests/e2e/a.e2e-spec.ts', 'import { useTestWorld } from "@tests/world/use-test-world"; const world = useTestWorld({ apps: { shop: true } });\n');
  const npm = (args, options) => spawnSync(process.execPath, [bin, ...args], { ...options, encoding: 'utf8', windowsHide: true });
  const measure = () => [buildUnitRun({ root, npm }), buildTestWorldRun({ root, project: 'e2e', npm })];
  writeReceipt(root, receipt());
  for (const [i, result] of measure().entries()) {
    assert.equal(result.exit, 0, JSON.stringify(result));
    assert.deepEqual(result.run.testFiles, ['fixture.spec.ts']);
    assert.equal([judgeUnitRun, judgeTestWorld][i](result).status, 'pass');
  }
  for (const [label, report, exit, expected] of cases()) {
    writeReceipt(root, report, exit);
    for (const [i, result] of measure().entries()) {
      assert.equal(result.exit, expected, `${label}: ${JSON.stringify(result)}`);
      assert.equal(result.run.exit, exit);
      assert.notEqual([judgeUnitRun, judgeTestWorld][i](result).status, 'pass', label);
    }
  }
  writeReceipt(root, receipt({ failed: 1 }), 1);
  for (const result of measure()) { assert.equal(result.exit, 1, JSON.stringify(result)); assert.equal(result.run.failed, 1); }
});

test('a raw process error, signal, null or string status cannot be cleaned by valid Jest JSON', () => {
  for (const run of [{ status: null }, { status: '0' }, { status: 0, signal: 'SIGTERM' }, { status: 0, error: new Error('spawn failure') }])
    assert.match(jestRunError(receipt(), run), /did not complete/);
});
