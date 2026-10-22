// db dump archives its plaintext parts with tar run inside the scratch directory, relative names only: GNU tar (first on PATH
// under Git Bash on Windows) reads an absolute `C:\...` argument as a remote host, which failed every backup there.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ARCHIVE_NAME, archiveParts } from '../db/dump.mjs';

const PARTS = ['roles.sql', 'schema.sql', 'rowcounts.json'];

function scratchWithParts(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-db-dump-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scratch = path.join(root, '.plaintext');
  fs.mkdirSync(scratch);
  for (const part of PARTS) fs.writeFileSync(path.join(scratch, part), `-- ${part}\n`);
  return { root, scratch };
}

test('tar runs in the scratch directory with relative arguments only: no -C and no absolute path', (t) => {
  const { root, scratch } = scratchWithParts(t);
  const calls = [];
  const ctx = { cwd: root, env: {}, spawn: (command, args, options) => { calls.push({ command, args, cwd: options.cwd }); return { status: 0 }; } };
  const archive = archiveParts(ctx, scratch, PARTS);
  assert.equal(archive, path.join(scratch, ARCHIVE_NAME));
  assert.deepEqual(calls, [{ command: 'tar', args: ['-cf', ARCHIVE_NAME, ...PARTS], cwd: scratch }]);
  for (const arg of calls[0].args) {
    assert.ok(!path.isAbsolute(arg) && !/^[A-Za-z]:/u.test(arg), `${arg} is relative`);
    assert.notEqual(arg, '-C');
  }
});

test('the tar on PATH builds the archive from an absolute scratch path and it lists exactly the parts', (t) => {
  const { root, scratch } = scratchWithParts(t);
  const ctx = { cwd: root, env: process.env, spawn: (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8' }) };
  const archive = archiveParts(ctx, scratch, PARTS);
  assert.ok(fs.statSync(archive).size > 0, 'the archive exists');
  const listed = spawnSync('tar', ['-tf', ARCHIVE_NAME], { cwd: scratch, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(listed.stdout.split(/\r?\n/u).filter(Boolean), PARTS);
});

test('a failing tar is DB_BACKUP_TOOL_FAILED with its output withheld', (t) => {
  const { root, scratch } = scratchWithParts(t);
  const ctx = { cwd: root, env: {}, spawn: () => ({ status: 2, stderr: 'secret-looking output' }) };
  assert.throws(() => archiveParts(ctx, scratch, PARTS), (error) => error.code === 'DB_BACKUP_TOOL_FAILED' && !/secret-looking/u.test(error.message));
});
