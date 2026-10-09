// Harness self-test (registry: replay-engine-detached-push-races-the-spec): a replay pass is deterministic by construction. The live engine hands the parallelism push to a detached
// `dispatch-ready` child that outlives the pass and leases the ready job about a second later, so a spec that pushed itself after the pass found `allowed 0 / queuedReady 0` or a job
// already taken (shape-guard-retry, ready-not-dispatched h, dispatch-owners b were red or flaky for it). The replay engine therefore runs the push in the foreground by default, and
// every process of a world carries a trap (tests/helpers/replay-child-trap.mjs) that records each detached child it starts; the world fails a pass that leaves one alive.
// Real: the engine pass, the dispatch-ready verb, the trap. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadFixture, replayWorld, ROOT } from '../helpers/replay-world.mjs';

const TRAP = pathToFileURL(path.join(ROOT, 'tests', 'helpers', 'replay-child-trap.mjs')).href;
const pushes = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-dispatch-push' ORDER BY seq").all().map((row) => JSON.parse(row.payload_json)));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };

test('the trap records a detached child a process starts, and only a detached one', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-child-trap-'));
  const log = path.join(dir, 'children.jsonl');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const script = "const cp = require('node:child_process'); const idle = ['-e', 'setTimeout(() => {}, 60000)'];"
    + " const kept = cp.spawn(process.execPath, idle, { detached: true, stdio: 'ignore', windowsHide: true }); const plain = cp.spawn(process.execPath, ['-e', '0'], { stdio: 'ignore', windowsHide: true });"
    + " console.log(JSON.stringify({ kept: kept.pid, plain: plain.pid })); kept.unref();";
  const run = spawnSync(process.execPath, ['--import', TRAP, '-e', script], { encoding: 'utf8', windowsHide: true, env: { ...process.env, STARCI_REPLAY_CHILDREN: log } });
  const { kept, plain } = JSON.parse(run.stdout.trim());
  t.after(() => { try { process.kill(kept); } catch { /* gone */ } });
  const rows = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(rows.map((row) => row.pid), [kept], 'the detached child is logged, the attached one is not');
  assert.notEqual(rows[0].pid, plain);
  assert.ok(alive(kept), 'and it outlives the process that started it, which is what the world reads');
});

test('a replay engine pass runs the parallelism push in the foreground: it ends with the pass and leaves no child behind', (t) => {
  const fixture = loadFixture('grammar-in-tree');
  const draw = fixture.jobs.find((job) => job.op === 'interface.draw');
  const world = replayWorld(t, fixture, { tree: true, launch: true });
  assert.equal(world.ack([draw.op]).status, 0);
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true);
  assert.deepEqual(world.leakedChildren(), [], 'no child is alive after the pass');
  const results = pushes(world).flatMap((push) => push.results).filter((result) => result.jobId === draw.id);
  assert.equal(results.length, 1, 'the push of the pass has already run when the pass returns: nothing is left for a detached child to do a second later');
});

test('the live shape is asked for by name, and a pass that leaves its detached push alive fails the spec', (t) => {
  const fixture = loadFixture('grammar-in-tree');
  const draw = fixture.jobs.find((job) => job.op === 'interface.draw');
  const world = replayWorld(t, fixture, { tree: true, launch: true });
  assert.equal(world.ack([draw.op]).status, 0);
  assert.throws(() => world.engine({ controllers: ['job', 'workflow'], passes: 1, detachedPush: true }), /left a detached child alive/);
  const [leaked] = world.leakedChildren();
  assert.match(leaked?.argv ?? '', /dispatch-ready/, 'the child it names is the push');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 0, detachedPush: true, expectLeaked: true }).ok, true, 'a spec that tests detachment says it expects one');
});
