import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './nested-return-fixture.mjs';

test('architecture CLI settles resumed waiting migration validation and reports genuine gate failures', async t => {
  const f = await fixture(t, { migration: true });
  const branch = f.branch('3/1'), file = path.join(branch, 'request/request.json');
  const request = JSON.parse(await readFile(file));
  assert.ok(request.resume); assert.equal((await f.read()).choices[request.decisionId].selectedBy, 'user');
  const model = JSON.parse(await readFile(path.join(branch, 'response/data/stack-model.json')));
  assert.ok(model.operations.some(operation => operation.transport === 'migration'));
  assert.equal(JSON.parse(await readFile(path.join(branch, 'response/response.json'))).status, 'waiting');
  const cli = () => spawnSync(process.execPath, [path.join(f.root, 'operators/architecture-decide/validate.mjs'), branch], { encoding: 'utf8', timeout: 30000 });
  const result = cli();
  assert.equal(result.status, 0, result.stderr); assert.equal(result.signal, null);
  assert.match(result.stdout, /valid architecture.decide branch/); assert.doesNotMatch(result.stderr, /unsettled top-level await/);
  await writeFile(file, JSON.stringify({ ...request, selectedOption: 'corrected' }));
  const rejected = cli();
  assert.equal(rejected.status, 1, rejected.stderr); assert.ok(rejected.stderr.trim());
  assert.doesNotMatch(rejected.stdout, /valid architecture.decide branch/); assert.doesNotMatch(rejected.stderr, /unsettled top-level await/);
});
