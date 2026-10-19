import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tempRoot} from '../runtime/engine/temp-root.mjs';
import {normalizeRelease, releaseGate} from '../release/gate.mjs';

test('native release sends selected Sonar credentials only to its scanner and keeps them out of other gate logs', async t => {
  const root = fs.mkdtempSync(path.join(tempRoot(), 'hfs-sonar-boundary-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
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
  const scanner = calls.find(call => call.command === 'npx');
  assert.equal(scanner.env.SONAR_TOKEN, secret);
  assert.equal(Object.hasOwn(scanner.env, 'SONAR_NIVO_TOKEN'), false);
  assert.equal(scanner.env.SONAR_SCANNER_JSON_PARAMS, '{"sonar.qualitygate.wait":"true"}');
  assert.ok(calls.some(call => call.command === 'git' && call.args[0] === 'tag' && call.args[1] === '-a'));
  const record = JSON.parse(fs.readFileSync(result.data.record, 'utf8'));
  assert.equal(record.schema, 'starci-app-l4-record/1');
  assert.equal(record.head, head);
  assert.deepEqual(record.gates.map(row => row.name), ['build', 'lint', 'sonar']);
  for (const row of record.gates) assert.equal(fs.readFileSync(row.log, 'utf8').includes(secret), false);
});
