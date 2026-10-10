// Project-local Jest tool edge: assertions execute in a real child before its receipt is emitted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { installBoundLintCanons, lintFixtureDeclaration } from './lint-canon-fixture.mjs';

const put = (root, rel, body) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

const runner = `const fs = require('node:fs');
const path = require('node:path');
const cwd = process.cwd();
const args = process.argv.slice(2);
fs.appendFileSync(path.join(cwd, 'calls.jsonl'), JSON.stringify({ cwd, args }) + '\\n');
const startTime = Date.now();
let failure = null;
try { require(path.join(cwd, 'scenario.cjs'))(); } catch (error) { failure = error.stack; }
const failed = failure ? 1 : 0;
const report = {
  success: !failed, wasInterrupted: false, startTime,
  numTotalTests: 1, numPassedTests: 1 - failed, numFailedTests: failed,
  numPendingTests: 0, numTodoTests: 0,
  numTotalTestSuites: 1, numPassedTestSuites: 1 - failed,
  numFailedTestSuites: failed, numPendingTestSuites: 0, numRuntimeErrorTestSuites: 0,
  testResults: [{ name: path.join(cwd, 'scenario.cjs'), status: failed ? 'failed' : 'passed',
    startTime, endTime: Date.now(), message: failure || '',
    assertionResults: [{ title: 'fixture scenario', fullName: 'fixture scenario',
      ancestorTitles: [], status: failed ? 'failed' : 'passed', duration: Date.now() - startTime,
      failureMessages: failure ? [failure] : [] }] }]
};
const output = args.find(arg => arg.startsWith('--outputFile='));
if (!output) throw new Error('missing gate outputFile');
fs.writeFileSync(output.slice('--outputFile='.length), JSON.stringify(report));
process.exitCode = failed;
`;

/** Build one private app with a root-installed exported Jest bin and keep every tool call in that app. */
export function gateJestExportsFixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-jest-exports-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  put(root, '.gitignore', 'node_modules/\nbe/calls.jsonl\nbe/scenario-input.json\n');
  put(root, 'package.json', JSON.stringify({ name: 'jest-exports-app', private: true }));
  put(root, 'hfs.json', JSON.stringify(lintFixtureDeclaration('jest-exports-app')));
  put(root, 'be/jest.config.cjs', 'module.exports = {}\n');
  put(root, 'be/scenario.cjs', "module.exports = () => { const input = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, 'scenario-input.json'), 'utf8')); require('node:assert/strict').equal(2 + 2, input.expected); };\n");
  put(root, 'be/scenario-input.json', JSON.stringify({ expected: 4 }));
  installBoundLintCanons(root);
  // Jest v29.7.0's exported bin spelling; verified from official package manifest on 2026-10-10.
  put(root, 'node_modules/jest/package.json', JSON.stringify({ name: 'jest', version: '29.7.0',
    exports: { './package.json': './package.json', './bin/jest': './bin/jest.js' }, bin: './bin/jest.js' }));
  put(root, 'node_modules/jest/bin/jest.js', runner);
  const git = (...args) => {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'spec');
  git('config', 'user.email', 'spec@starci.test');
  git('config', 'commit.gpgsign', 'false');
  git('add', '-A');
  git('commit', '-qm', 'one-app Jest exports fixture');
  return { root, base: git('rev-parse', 'HEAD'),
    calls: () => fs.readFileSync(path.join(root, 'be/calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse),
    fail: () => put(root, 'be/scenario-input.json', JSON.stringify({ expected: 5 })),
    removeJest: () => fs.rmSync(path.join(root, 'node_modules/jest'), { recursive: true, force: true }) };
}
