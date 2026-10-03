import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { removeToolWrappers, writeRuntimeShim } from '../../packages/cli/src/shim.mjs';

const TOOL_WRAPPERS = ['git', 'npm', 'npx', 'node', 'docker', 'supabase', 'gh', 'schtasks'];

const fixture = (platform) => {
  const root = path.resolve('runtime with spaces');
  const home = path.resolve('home with spaces');
  const node = path.resolve('node with spaces', platform === 'win32' ? 'node.exe' : 'node');
  const writes = new Map();
  const chmods = [];
  const result = writeRuntimeShim({ root, home }, {
    platform,
    node,
    mkdir: () => {},
    write: (file, text) => writes.set(file, text),
    chmod: (file, mode) => chmods.push({ file, mode }),
  });
  return { root, home, node, writes, chmods, result };
};

test('writeRuntimeShim writes the exact Windows launcher and guarded tool wrappers', () => {
  const { root, home, node, writes, chmods, result } = fixture('win32');
  const bin = path.join(home, '.starci', 'bin');
  const cli = path.join(root, 'packages', 'cli', 'bin', 'starci.mjs');
  assert.deepEqual(result, {
    root,
    runtimeJson: path.join(home, '.starci', 'runtime.json'),
    shim: path.join(bin, 'starci.cmd'),
  });
  assert.equal(writes.get(result.shim), `@echo off\r\n"${node}" "${cli}" %*\r\n`);
  for (const program of TOOL_WRAPPERS) {
    assert.equal(writes.get(path.join(bin, `${program}.cmd`)), `@echo off\r\n"${node}" "${cli}" guard raw ${program} -- %*\r\n`);
  }
  assert.deepEqual(chmods, []);
});

test('writeRuntimeShim writes exact executable POSIX wrappers and rewrites them idempotently', () => {
  const { root, home, node, writes, chmods } = fixture('linux');
  const bin = path.join(home, '.starci', 'bin');
  const cli = path.join(root, 'packages', 'cli', 'bin', 'starci.mjs');
  assert.equal(writes.get(path.join(bin, 'starci')), `#!/bin/sh\nexec "${node}" "${cli}" "$@"\n`);
  for (const program of TOOL_WRAPPERS) {
    assert.equal(writes.get(path.join(bin, program)), `#!/bin/sh\nexec "${node}" "${cli}" guard raw ${program} -- "$@"\n`);
  }
  assert.deepEqual(chmods, ['starci', ...TOOL_WRAPPERS].map((name) => ({ file: path.join(bin, name), mode: 0o755 })));

  const before = new Map(writes);
  writeRuntimeShim({ root, home }, {
    platform: 'linux', node, mkdir: () => {}, write: (file, text) => writes.set(file, text), chmod: () => {},
  });
  assert.deepEqual(writes, before);
});

test('removeToolWrappers removes only tool wrappers and tolerates an already absent wrapper', () => {
  const home = path.resolve('fake-home');
  const bin = path.join(home, '.starci', 'bin');
  const calls = [];
  const missing = path.join(bin, 'node.cmd');
  const removed = removeToolWrappers({ home }, {
    platform: 'win32',
    unlink: (file) => {
      calls.push(file);
      if (file === missing) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
  });
  assert.deepEqual(calls, TOOL_WRAPPERS.map((program) => path.join(bin, `${program}.cmd`)));
  assert.deepEqual(removed, calls.filter((file) => file !== missing));
  assert.ok(!calls.includes(path.join(bin, 'starci.cmd')));
});

test('runtimeEnv removes only the wrapper directory from PATH, whatever the case, and keeps the rest', async () => {
  const { runtimeEnv } = await import('../../packages/cli/src/shim.mjs');
  const home = path.resolve('home');
  const shim = path.join(home, '.starci', 'bin');
  const other = path.resolve('tools');
  const env = { Path: [shim, other, shim.toUpperCase()].join(';'), KEEP: '1' };
  assert.deepEqual(runtimeEnv(env, { home, platform: 'win32' }), { Path: other, KEEP: '1' });
  assert.deepEqual(runtimeEnv({ PATH: '/h/.starci/bin:/usr/bin' }, { home: '/h', platform: 'linux' }), { PATH: '/usr/bin' });
  assert.deepEqual(runtimeEnv({ KEEP: '1' }, { home }), { KEEP: '1' });
});
