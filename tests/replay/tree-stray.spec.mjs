// Replay of the StarCi stall of 2026-10-09 (registry: stray-file-in-a-workflow-tree-root-is-never-collected): a Kernel's shell left a file named `0` in the root of the
// workflow tree; it blocked a settle, the settle was made tolerant and the guard refuses the redirect, and nothing collected the leftover. The real GC controller, run by
// the real engine over the world's registry and ledger, collects it (an old, untracked, unowned, small file in the root) and nothing else.
// Real: the engine, the GC controller (key gc:tree-strays), the worktree registry, the ledger's live jobs. Stubbed: Orca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const fixture = loadFixture('handed-over');
const OLD = new Date(Date.now() - 3_600_000);

test('the GC controller collects the file named 0 from the workflow tree root and leaves the op\'s records and tracked files alone', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  const stray = path.join(world.tree.dir, '0');
  fs.writeFileSync(stray, 'x\n');
  fs.utimesSync(stray, OLD, OLD);
  const record = path.join(world.tree.dir, world.tree.records[0]);
  assert.equal(fs.existsSync(record), true);

  const out = world.engine({ controllers: ['gc'], passes: 1 });
  assert.equal(out.ok, true, JSON.stringify(out).slice(0, 400));
  assert.equal(fs.existsSync(stray), false, 'the stray file is collected');
  assert.equal(fs.existsSync(record), true, 'the op\'s record (owned by a live job) stays');
  assert.equal(fs.existsSync(path.join(world.tree.dir, '.gitignore')), true, 'a tracked file stays');
});
