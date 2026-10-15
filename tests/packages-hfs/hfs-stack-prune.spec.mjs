import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pruneStack } from '../../packages/hfs/stack/prune.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { testConfig } from '../helpers/stack-swarm-fakes.mjs';

const config = testConfig();
let dir;
let accepted;
let previous;
let bare;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-prune-'));
  const write = (name, release) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(release));
    return file;
  };
  accepted = write('accepted.json', { secrets: [{ key: 'TOKEN', runtimeName: 'app-token-v2' }], configs: [{ logical: 'routes', name: 'app-routes-c2' }] });
  previous = write('previous.json', { secrets: [{ key: 'TOKEN', runtimeName: 'app-token-v1' }], configs: [] });
  bare = write('bare.json', {});
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const managed = ['app.managed=true'];
function seeded() {
  const host = fakeHost();
  for (const name of ['app-token-v1', 'app-token-v2', 'app-token-v0']) host.state.secrets.set(name, { labels: managed, value: '' });
  for (const name of ['app-routes-c1', 'app-routes-c2']) host.state.configs.set(name, { labels: managed, value: '' });
  host.state.secrets.set('other-secret', { labels: ['other.managed=true'], value: '' });
  return host;
}

test('at least one release.json must be kept', async () => {
  const host = seeded();
  await assert.rejects(pruneStack(host.ctx(), config, { keepFiles: [] }), { code: 'STACK_PRUNE_NO_KEEP' });
  await assert.rejects(pruneStack(host.ctx(), config), { code: 'STACK_PRUNE_NO_KEEP' });
  assert.equal(host.calls.length, 0);
});

test('an unreadable keep file is refused before docker is asked', async () => {
  const host = seeded();
  await assert.rejects(pruneStack(host.ctx(), config, { keepFiles: [path.join(dir, 'missing.json')] }), { code: 'STACK_PRUNE_KEEP_INVALID' });
  assert.equal(host.calls.length, 0);
});

test('without execute it lists the superseded objects and removes nothing', async () => {
  const host = seeded();
  const result = await pruneStack(host.ctx(), config, { keepFiles: [accepted] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, [
    'dry run: would remove secret app-token-v1',
    'dry run: would remove secret app-token-v0',
    'dry run: would remove config app-routes-c1',
    'dry run: 3 superseded objects would be removed',
  ]);
  assert.deepEqual(result.data, { kept: 2, candidates: 3, removed: 0, inUse: 0 });
  assert.deepEqual(host.state.removed, []);
  const listing = host.calls[0].args;
  assert.deepEqual(listing, ['secret', 'ls', '--filter', 'label=app.managed=true', '--format', '{{.Name}}']);
});

test('with execute it removes what no kept release names and keeps both releases objects', async () => {
  const host = seeded();
  const result = await pruneStack(host.ctx(), config, { keepFiles: [accepted, previous], execute: true });
  assert.deepEqual(host.state.removed, [{ kind: 'secret', name: 'app-token-v0' }, { kind: 'config', name: 'app-routes-c1' }]);
  assert.deepEqual(result.lines, ['prune: removed 2 superseded objects, 0 still in use']);
  assert.ok(host.state.secrets.has('other-secret'));
  assert.ok(host.state.secrets.has('app-token-v1'));
});

test('an object a service still uses is reported and never forced', async () => {
  const host = seeded();
  host.state.busy.add('app-token-v1');
  const result = await pruneStack(host.ctx(), config, { keepFiles: [accepted], execute: true });
  assert.deepEqual(result.data, { kept: 2, candidates: 3, removed: 2, inUse: 1 });
  assert.deepEqual(result.lines, ['secret app-token-v1 is still in use; left alone', 'prune: removed 2 superseded objects, 1 still in use']);
  assert.ok(host.state.secrets.has('app-token-v1'));
  assert.equal(host.calls.some((call) => call.args.includes('--force') || call.args.includes('-f')), false);
});

test('a release record without secrets or configs keeps nothing', async () => {
  const host = seeded();
  const result = await pruneStack(host.ctx(), config, { keepFiles: [bare] });
  assert.equal(result.data.kept, 0);
  assert.equal(result.data.candidates, 5);
});

test('a failed docker listing is a failure naming the first stderr line', async () => {
  const host = fakeHost({ overrides: { docker: { 'config ls': () => ({ status: 1, stdout: '', stderr: 'permission denied\nmore' }) } } });
  await assert.rejects(pruneStack(host.ctx(), config, { keepFiles: [accepted] }), (error) => error.code === 'STACK_PRUNE_LIST' && /docker config ls failed: permission denied$/u.test(error.message));
});
