import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReleaseStore, lfOnly } from '../../packages/hfs/stack/release-store.mjs';
import { releaseSsh, testConfig } from '../helpers/stack-fakes-B.mjs';

const ONE = '0123456789abcdef';
const TWO = 'fedcba9876543210';
let work;
let remote;

before(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-store-')); });
after(() => fs.rmSync(work, { recursive: true, force: true }));
afterEach(() => remote?.dispose());

/** A rendered release directory with CRLF bytes in stack.yaml, to prove the stored bytes are not touched. */
function release(name, stack = 'services:\r\n  api:\r\n    image: x\r\n') {
  const dir = path.join(work, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'stack.yaml'), stack);
  fs.writeFileSync(path.join(dir, 'release.json'), `{"id":"${name}"}\n`);
  return dir;
}

function open(config = testConfig()) {
  remote = releaseSsh();
  return createReleaseStore(config, remote.ssh);
}

test('lfOnly removes every carriage return', () => {
  assert.equal(lfOnly('set -e\r\nls\r\n'), 'set -e\nls\n');
  assert.equal(lfOnly(5), '5');
});

test('store uploads both files as text, then makes the release read-only', async () => {
  const store = open();
  const dir = release('one');
  await store.store(dir, ONE);
  const base = `/srv/app/releases/${ONE}`;
  assert.equal(fs.readFileSync(remote.real(`${base}/stack.yaml`), 'utf8'), 'services:\r\n  api:\r\n    image: x\r\n');
  assert.equal(fs.readFileSync(remote.real(`${base}/release.json`), 'utf8'), '{"id":"one"}\n');
  assert.equal(remote.modes.get(`${base}/stack.yaml`), '440');
  assert.equal(remote.modes.get(base), '550');
  assert.equal(remote.calls.length, 4);
  assert.equal(remote.calls[1].command, `set -e; d="${base}"; cat > "$d/stack.yaml"`);
  assert.equal(remote.calls[1].input, 'services:\r\n  api:\r\n    image: x\r\n');
  for (const call of remote.calls) assert.equal(call.command.includes('\r'), false);
});

test('a release can be stored again: the read-only record is made writable first', async () => {
  const store = open();
  await store.store(release('one'), ONE);
  await store.store(release('one', 'services: {}\n'), ONE);
  assert.equal(fs.readFileSync(remote.real(`/srv/app/releases/${ONE}/stack.yaml`), 'utf8'), 'services: {}\n');
  assert.equal(remote.modes.get(`/srv/app/releases/${ONE}`), '550');
});

test('accept moves current to previous and the new release to current', async () => {
  const store = open();
  assert.equal(await store.current(), '');
  assert.equal(await store.previous(), '');
  await store.store(release('one'), ONE);
  await store.accept(ONE);
  assert.equal(await store.current(), ONE);
  assert.equal(await store.previous(), '');
  await store.store(release('two'), TWO);
  await store.accept(TWO);
  assert.equal(await store.current(), TWO);
  assert.equal(await store.previous(), ONE);
  await store.accept(TWO);
  assert.equal(await store.previous(), ONE);
  await store.accept(ONE);
  assert.equal(await store.current(), ONE);
  assert.equal(await store.previous(), TWO);
});

test('accepting a release that was never stored fails and moves nothing', async () => {
  const store = open();
  await assert.rejects(store.accept(ONE), { code: 'STACK_RELEASE_SSH' });
  assert.equal(await store.current(), '');
});

test('fetch downloads both stored files byte for byte', async () => {
  const store = open();
  await store.store(release('one'), ONE);
  const target = path.join(work, 'fetched', 'deep');
  assert.equal(await store.fetch(ONE, target), target);
  assert.equal(fs.readFileSync(path.join(target, 'stack.yaml'), 'utf8'), 'services:\r\n  api:\r\n    image: x\r\n');
  assert.equal(fs.readFileSync(path.join(target, 'release.json'), 'utf8'), '{"id":"one"}\n');
  await assert.rejects(store.fetch(TWO, path.join(work, 'nothing')), { code: 'STACK_RELEASE_SSH' });
});

test('list shows the stored releases newest first and marks current and previous', async () => {
  const store = open();
  assert.deepEqual(await store.list(), []);
  await store.store(release('one'), ONE);
  await store.accept(ONE);
  await store.store(release('two'), TWO);
  await store.accept(TWO);
  await store.store(release('three'), '1111111111111111');
  assert.deepEqual(await store.list(), [
    { id: '1111111111111111', current: false, previous: false },
    { id: TWO, current: true, previous: false },
    { id: ONE, current: false, previous: true },
  ]);
});

test('a hostile or malformed release id is refused before any ssh call', async () => {
  const store = open();
  const dir = release('one');
  const hostile = ['$(id)', '../x', '0123456789ABCDEF', `${ONE}; rm -rf /`, '', undefined, 42];
  const calls = hostile.flatMap((id) => [() => store.store(dir, id), () => store.accept(id), () => store.fetch(id, path.join(work, 'x'))]);
  await Promise.all(calls.map((call) => assert.rejects(call(), { code: 'STACK_RELEASE_ID' })));
  assert.equal(remote.calls.length, 0);
});

test('the releases base comes from the configuration and must be a safe absolute path', async () => {
  remote = releaseSsh({ base: '/srv/custom' });
  const store = createReleaseStore(testConfig({ remote: { host: 'vps', releasesBase: '/srv/custom', sealed: null } }), remote.ssh);
  await store.store(release('one'), ONE);
  assert.ok(fs.existsSync(remote.real(`/srv/custom/releases/${ONE}/stack.yaml`)));
  for (const releasesBase of ['srv/x', '/srv/a b', '/srv/../etc', '/srv/$(id)', '/srv/x;y', '/']) {
    assert.throws(() => createReleaseStore(testConfig({ remote: { host: 'vps', releasesBase, sealed: null } }), remote.ssh), { code: 'STACK_RELEASE_BASE' });
  }
  assert.throws(() => createReleaseStore(testConfig({ stack: 'bad stack' }), remote.ssh), { code: 'STACK_RELEASE_BASE' });
});

test('a configuration without a remote block falls back to /srv/<stack>', async () => {
  remote = releaseSsh({ base: '/srv/shop' });
  const store = createReleaseStore(testConfig({ remote: undefined, stack: 'shop' }), remote.ssh);
  await store.store(release('one'), ONE);
  assert.ok(fs.existsSync(remote.real(`/srv/shop/releases/${ONE}/release.json`)));
});

test('a missing local file is a failure before any ssh call', async () => {
  const store = open();
  const empty = path.join(work, 'empty');
  fs.mkdirSync(empty, { recursive: true });
  await assert.rejects(store.store(empty, ONE), { code: 'STACK_RELEASE_STORE' });
  assert.equal(remote.calls.length, 0);
});

test('a failing remote command reports its first stderr line', async () => {
  const store = createReleaseStore(testConfig(), async () => ({ status: 255, stdout: '', stderr: 'ssh: connect to host vps port 22: Connection refused\nmore' }));
  await assert.rejects(store.current(), (error) => error.code === 'STACK_RELEASE_SSH' && error.message.endsWith('Connection refused'));
});

test('pointer and listing output that is not a release id is ignored', async () => {
  const store = createReleaseStore(testConfig(), async (command) => ({ status: 0, stdout: command.includes('ls -1t') ? `junk\n${ONE}\n../x\n` : 'not-an-id\n', stderr: '' }));
  assert.equal(await store.current(), '');
  assert.deepEqual(await store.list(), [{ id: ONE, current: false, previous: false }]);
});
