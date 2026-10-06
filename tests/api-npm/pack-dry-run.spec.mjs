import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { packDryRun } from '../../scripts/api/npm/pack-dry-run.mjs';

test('packDryRun asks the npm runner for the fixed argument array in the package directory', () => {
  const seen = [];
  const r = packDryRun('/pkg', { spawn: (args, options) => { seen.push({ args, options }); return { status: 0, stdout: '[]', stderr: '' }; } });
  assert.deepEqual(seen, [{ args: ['pack', '--dry-run', '--json', '--ignore-scripts'], options: { cwd: '/pkg' } }]);
  assert.deepEqual(r, { status: 0, stdout: '[]', stderr: '', error: null });
});

test('packDryRun runs the real npm of this node install (an absolute target, no shell) in a temp package', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-npm-pack-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'spec-pack', version: '1.0.0', files: ['a.txt'] }));
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  const r = packDryRun(dir);
  assert.equal(r.status, 0, r.stderr);
  const files = JSON.parse(r.stdout)[0].files.map((f) => f.path);
  assert.ok(files.includes('a.txt') && files.includes('package.json'), files.join(', '));
});
