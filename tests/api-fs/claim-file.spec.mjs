// claim-file.spec.mjs - scripts/api/fs/claim-file.mjs: one writer at a time per file, and a claim of a process that is gone is replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claimFile } from '../../scripts/api/fs/claim-file.mjs';

const scratch = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-claim-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const lockOf = (file) => path.join(path.dirname(file), `.${path.basename(file)}.lock`);

test('a second claim of the same file is refused until the first releases, and the lock leaves nothing behind', (t) => {
  const file = path.join(scratch(t), 'sub', 'token.enc');
  const first = claimFile(file);
  assert.equal(first.ok, true);
  assert.deepEqual(claimFile(file), { ok: false, holder: process.pid });
  first.release();
  assert.equal(fs.existsSync(lockOf(file)), false);
  const again = claimFile(file);
  assert.equal(again.ok, true);
  again.release();
});

test('the claim of a process that no longer exists is replaced, and a release never drops another claimant', (t) => {
  const file = path.join(scratch(t), 'token.enc');
  const dead = 2 ** 22 + 12345;
  fs.writeFileSync(lockOf(file), JSON.stringify({ pid: dead }));
  const taken = claimFile(file);
  assert.equal(taken.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(lockOf(file), 'utf8')).pid, process.pid);
  fs.writeFileSync(lockOf(file), JSON.stringify({ pid: dead }));
  taken.release();
  assert.equal(fs.existsSync(lockOf(file)), true, 'a lock that names another claimant stays');
});
