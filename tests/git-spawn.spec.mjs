import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitSpawn, runGit, gitResult } from '../scripts/lib/git.mjs';

// Guard/kernel scripts each spelt the same git spawn by hand: encoding utf8, windowsHide, a cwd
// here, a `-C` there. scripts/lib/git.mjs is the one helper; gitSpawn keeps the
// (file, args, options) signature so injected runners and spec fakes take the same arguments.

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('gitSpawn runs the binary with utf8 output and options pass through', () => {
  const r = gitSpawn('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT, timeout: 20_000 });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'true');
});

test('runGit composes -C dir before the args; the cwd form spawns inside the dir', () => {
  const r = runGit(['rev-parse', '--show-toplevel'], { dir: ROOT });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().replace(/\\/g, '/'), path.resolve(ROOT).replace(/\\/g, '/'));
  const inCwd = runGit(['rev-parse', '--is-inside-work-tree'], { cwd: ROOT });
  assert.equal(inCwd.stdout.trim(), 'true');
});

test('gitResult folds the result into {ok, stdout, error}', () => {
  const ok = gitResult(['rev-parse', '--verify', 'HEAD'], { dir: ROOT });
  assert.equal(ok.ok, true);
  assert.match(ok.stdout.trim(), /^[0-9a-f]{40}$/);
  // The settle-landed copy this replaces named a clean exit 'exit 0' in error; callers read
  // error only when ok is false, and the quirk is preserved verbatim.
  assert.equal(ok.error, 'exit 0');
  const bad = gitResult(['rev-parse', '--verify', 'no-such-ref-starci'], { dir: ROOT });
  assert.equal(bad.ok, false);
  assert.ok(bad.error.length > 0, 'stderr is named in error');
  const gone = gitResult(['--version'], { git: 'definitely-not-git-binary-xyz' });
  assert.equal(gone.ok, false);
  assert.ok(gone.error.length > 0, 'a spawn error is named, never thrown');
});
