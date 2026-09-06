import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { replaceFile } from './session-lock.mjs';

test('Windows atomic replacement retries transient sharing denial and preserves both files on persistent denial', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'starci-atomic-replace-'));
  const temp = path.join(dir, 'state.tmp'); const file = path.join(dir, 'state.json');
  const denied = () => Object.assign(new Error('sharing violation'), { code: 'EPERM' });
  try {
    await writeFile(file, 'original'); await writeFile(temp, 'next');
    let calls = 0; const pauses = [];
    await replaceFile(temp, file, { platform: 'win32', pause: async ms => pauses.push(ms), renameFile: async (...args) => {
      calls += 1;
      if (calls < 3) { assert.equal(await readFile(file, 'utf8'), 'original'); assert.equal(await readFile(temp, 'utf8'), 'next'); throw denied(); }
      return rename(...args);
    } });
    assert.equal(await readFile(file, 'utf8'), 'next'); assert.equal(calls, 3); assert.deepEqual(pauses, [25, 25]);
    await writeFile(temp, 'later'); calls = 0;
    await assert.rejects(() => replaceFile(temp, file, { platform: 'win32', pause: async () => {}, renameFile: async () => { calls += 1; throw denied(); } }), { code: 'EPERM' });
    assert.equal(calls, 20); assert.equal(await readFile(file, 'utf8'), 'next'); assert.equal(await readFile(temp, 'utf8'), 'later');
    calls = 0;
    await assert.rejects(() => replaceFile(temp, file, { platform: 'linux', renameFile: async () => { calls += 1; throw denied(); } }), { code: 'EPERM' });
    assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
