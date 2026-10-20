import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tempRoot} from '../runtime/engine/temp-root.mjs';
import {normalizeRelease, releaseGate} from '../release/gate.mjs';

const lintFixture = (t, name) => {
  const root = fs.mkdtempSync(path.join(tempRoot(), name));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'be'));
  fs.mkdirSync(path.join(root, 'fe'));
  return root;
};
let lintExit = 0;

test('native release sends selected Sonar credentials only to its scanner and keeps them out of other gate logs', async t => {
  lintExit = 0;
  const root = lintFixture(t, 'hfs-sonar-boundary-');
  const head = 'a'.repeat(40), secret = 'fixture-private-analysis-value', common = path.join(root, '.git');
  const calls = [];
  const spawn = (command, args, options = {}) => {
    calls.push({command, args, env: options.env});
    if (command === 'git') {
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return {status: 0, stdout: head};
      if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') return {status: 0, stdout: 'main'};
      if (args[0] === 'rev-parse' && args[1] === '--git-common-dir') return {status: 0, stdout: common};
      if (['status', 'tag', 'ls-remote'].includes(args[0])) return {status: 0, stdout: ''};
      throw new Error('Unexpected native git query');
    }
    if (command === 'build-probe' || command === 'lint-probe') return {status: 0, stdout: JSON.stringify(options.env)};
    if (command === 'npx' && args[0] === 'starci') {
      const file = path.join(options.cwd, args[args.indexOf('--sonar') + 1]), side = args[args.indexOf('--side') + 1];
      if (lintExit !== 0) return {status: lintExit, stdout: `lint ${side} findings`};
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, JSON.stringify({rules: [{id: 'shared', side}, {id: `only-${side}`}], issues: [{ruleId: `only-${side}`}]}));
      return {status: 0, stdout: `lint ${side} ok`};
    }
    if (command === 'npx') return {status: 0, stdout: `scanner output ${options.env.SONAR_TOKEN}`};
    throw new Error('Unexpected native gate command');
  };
  const services = {audit: {mode: 'disabled'}, sonar: {provider: 'sonarqube', mode: 'hosted', optional: false,
    host: {public: 'https://quality.example.invalid'}, ci: {token: 'SONAR_NIVO_TOKEN'}}};
  const normalized = normalizeRelease({gates: [
    {name: 'build', command: ['build-probe'], env: {SONAR_TOKEN: 'attempted-reintroduction', SONAR_NIVO_TOKEN: 'attempted-reintroduction'}},
    {name: 'lint', command: ['lint-probe']},
  ]}, {}, services);
  assert.ok(normalized.config);
  const result = await releaseGate({cwd: root, spawn, now: () => 1000, fetch: async () => ({ok: true, json: async () => ({status: 'UP'})}),
    get sops() {throw new Error('A release gate must not open unrelated stack custody');},
    env: {SONAR_TOKEN: secret, SONAR_NIVO_TOKEN: secret, KEEP_PUBLIC: 'retained', SONAR_SCANNER_JSON_PARAMS: '{"sonar.qualitygate.wait":"true"}'}},
  {...normalized.config, version: '1.0.0'}, {execute: true, sonar: true, platform: 'linux'});
  assert.equal(result.ok, true);
  const ordinary = calls.filter(call => ['build-probe', 'lint-probe'].includes(call.command));
  assert.equal(ordinary.length, 2);
  for (const call of ordinary) {
    assert.equal(Object.hasOwn(call.env, 'SONAR_TOKEN'), false);
    assert.equal(Object.hasOwn(call.env, 'SONAR_NIVO_TOKEN'), false);
    assert.equal(call.env.KEEP_PUBLIC, 'retained');
  }
  for (const call of calls.filter(row => row.command === 'git')) {
    assert.equal(Object.hasOwn(call.env, 'SONAR_TOKEN'), false);
    assert.equal(Object.hasOwn(call.env, 'SONAR_NIVO_TOKEN'), false);
    assert.equal(call.env.KEEP_PUBLIC, 'retained');
  }
  const scanner = calls.find(call => call.command === 'npx' && call.args[0] !== 'starci');
  assert.equal(scanner.env.SONAR_TOKEN, secret);
  assert.equal(Object.hasOwn(scanner.env, 'SONAR_NIVO_TOKEN'), false);
  assert.equal(scanner.env.SONAR_SCANNER_JSON_PARAMS, '{"sonar.qualitygate.wait":"true"}');
  assert.ok(calls.some(call => call.command === 'git' && call.args[0] === 'tag' && call.args[1] === '-a'));
  const record = JSON.parse(fs.readFileSync(result.data.record, 'utf8'));
  assert.equal(record.schema, 'starci-app-l4-record/1');
  assert.equal(record.head, head);
  assert.deepEqual(record.gates.map(row => row.name), ['build', 'lint', 'sonar']);
  for (const row of record.gates) assert.equal(fs.readFileSync(row.log, 'utf8').includes(secret), false);
  const merged = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'lint.sonar.json'), 'utf8'));
  assert.deepEqual(merged.rules.map(rule => rule.id), ['shared', 'only-be', 'only-fe']);
  assert.equal(merged.rules[0].side, 'fe');
  assert.equal(merged.issues.length, 2);
  const order = calls.filter(call => call.command === 'npx').map(call => call.args.includes('starci') ? `lint-${call.args[call.args.indexOf('--side') + 1]}` : 'scan');
  assert.deepEqual(order, ['lint-be', 'lint-fe', 'scan']);
  assert.match(fs.readFileSync(record.gates.find(row => row.name === 'sonar').log, 'utf8'), /\$ npx starci app lint --side be --sonar reports\/lint\.be\.sonar\.json[\s\S]*wrote reports\/lint\.sonar\.json/u);
});

test('a failing lint fails the sonar row and the scanner never runs', async t => {
  lintExit = 1;
  t.after(() => { lintExit = 0; });
  const root = lintFixture(t, 'hfs-sonar-lint-red-');
  const head = 'b'.repeat(40), calls = [];
  const spawn = (command, args, options = {}) => {
    calls.push({command, args});
    if (command === 'git') {
      if (args[1] === 'HEAD') return {status: 0, stdout: head};
      if (args[1] === '--abbrev-ref') return {status: 0, stdout: 'main'};
      if (args[1] === '--git-common-dir') return {status: 0, stdout: path.join(root, '.git')};
      return {status: 0, stdout: ''};
    }
    return command === 'npx' ? {status: lintExit, stdout: 'lint findings'} : {status: 0, stdout: ''};
  };
  const services = {audit: {mode: 'disabled'}, sonar: {provider: 'sonarqube', mode: 'hosted', optional: false,
    host: {public: 'https://quality.example.invalid'}, ci: {token: 'SONAR_NIVO_TOKEN'}}};
  const normalized = normalizeRelease({gates: [{name: 'build', command: ['build-probe']}]}, {}, services);
  const result = await releaseGate({cwd: root, spawn, now: () => 1000, fetch: async () => ({ok: true, json: async () => ({status: 'UP'})}),
    env: {SONAR_NIVO_TOKEN: 'fixture-private-analysis-value'}}, {...normalized.config, version: '1.0.0'}, {execute: true, sonar: true, platform: 'linux'});
  assert.equal(result.ok, false, result.lines.join(' | '));
  const sonar = result.data.results.find(row => row.name === 'sonar');
  assert.equal(sonar.pass, false);
  assert.match(fs.readFileSync(sonar.log, 'utf8'), /lint be failed: exit 1; the scanner was not run/u);
  assert.equal(calls.some(call => call.command === 'npx' && !call.args.includes('starci')), false);
});
