import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextBuildEnv, swcCacheDir } from '../../scripts/gates/build-env.mjs';

test('the SWC cache is under the home unless STARCI_SWC_CACHE names one', () => {
  assert.equal(swcCacheDir({}, 'home-dir'), path.join('home-dir', 'starci-swc-cache'));
  assert.equal(swcCacheDir({ STARCI_SWC_CACHE: 'elsewhere' }, 'home-dir'), 'elsewhere');
});

test('the next build env keeps the caller env, switches telemetry off and creates the named cache', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-build-env-'));
  try {
    const cache = path.join(root, 'swc');
    const env = nextBuildEnv({ KEEP: '1', STARCI_SWC_CACHE: cache });
    assert.deepEqual([env.KEEP, env.NEXT_TELEMETRY_DISABLED, env.SWC_NATIVE_BINDING_CACHE], ['1', '1', cache]);
    assert.ok(fs.statSync(cache).isDirectory());
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
