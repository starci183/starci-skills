// Replay of the wake churn of 2026-10-09 (registry: kernel-wake-rotation-counts-wakes-the-runtime-caused): the Nivo Kernel went through 16 attempts in a day because every
// delivered wake counted toward the rotation by wakes (8), whether the menu it was typed for held anything, and the watchdog typed a new liveness wake every minute for a menu the Kernel
// was still working on (a boot reads for ~19 turns). Counted from the ledger since 10:15 local: Nivo 60 liveness wakes with no decision in the hour windows of a stuck settle loop, StarCi
// 13 wakes in the two boots (idleWakes 1..7 a minute apart, half of them delivered `queued` into a busy turn).
// Sequence: a workflow with nothing to decide and a quiet stretch of ticks; a workflow with one item and a Kernel that does not answer; the rotation bound over wakes typed for an empty menu.
// Real: the watchdog pass the Host controller runs (--once --repair), the status projection and menu, the wake record, the rotation rule. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadFixture, replayWorld, ROOT } from '../helpers/replay-world.mjs';

const HANGS = pathToFileURL(path.join(ROOT, 'tests', 'helpers', 'replay-start-hangs.mjs')).href;
const WATCHDOG = path.join(ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs');

/** The Orca stub as a Kernel that finished its turn leaves it: its terminal at the idle prompt (a typed wake starts a turn in the stub, which stays active until this is rewritten). */
const idleKernel = (world) => fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({ terminals: {
  'term-runtime-shell': { handle: 'term-runtime-shell', worktree: ROOT, title: 'shell' },
  'term-kernel-current': { handle: 'term-kernel-current', worktree: world.tree.dir, title: '[Kernel] wf-1' } } }));

function worldOf(t, name) {
  const world = replayWorld(t, loadFixture(name), { tree: true, launch: true });
  idleKernel(world);
  assert.equal(world.ack([]).status, 0, 'the Kernel stands at the current revision');
  return world;
}
const tick = (world) => {
  idleKernel(world);
  const run = spawnSync(process.execPath, ['--import', HANGS, WATCHDOG, '--repo', world.repo, '--workflow', world.wf, '--once', '--repair', '--json'],
    { cwd: ROOT, encoding: 'utf8', env: { ...world.env, ORCA_TERMINAL_HANDLE: 'term-kernel-current' }, timeout: 300_000 });
  assert.ok(run.stdout.trim(), `watchdog said nothing: ${run.stderr.slice(0, 600)}`);
  return JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
};
const wakes = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT created_at, payload_json FROM events WHERE kind='kernel-woken' ORDER BY seq").all().map((row) => ({ at: row.created_at, ...JSON.parse(row.payload_json) })));
const fingerprint = (menu) => crypto.createHash('sha1').update(menu.map((item) => item.id).toSorted().join('|')).digest('hex').slice(0, 12);
const seedWake = (world, payload, ageMs) => world.ledger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId: world.wf, entityType: 'kernel', entityId: world.wf, kind: 'kernel-woken',
  createdAt: Date.now() - ageMs, payload: { terminal: 'term-kernel-current', delivery: 'delivered', ...payload } })));

test('a quiet stretch of ticks for a workflow with nothing to decide types no wake at all', (t) => {
  const world = worldOf(t, 'read-plan');
  assert.deepEqual(world.status().menu, [], 'nothing to decide');
  const actions = Array.from({ length: 2 }, () => tick(world).action);
  assert.deepEqual([...new Set(actions)], ['idle-waiting'], 'every tick leaves the Kernel alone');
  assert.deepEqual(wakes(world), [], 'no wake was typed or recorded');
});

test('a Kernel woken for a menu and not yet answering is not woken again for the same menu inside the repeat bound, and is after it', (t) => {
  const world = worldOf(t, 'leg-ready');
  const menu = world.status().menu;
  assert.equal(menu.length, 1);
  assert.equal(tick(world).action, 'woken');
  const [recorded] = wakes(world);
  assert.deepEqual([recorded.menuItems, recorded.menuFp], [1, fingerprint(menu)], 'the wake records the menu it was typed for');

  // The live pattern: the Kernel reads idle between its reads, a minute after the last wake, and the same menu stands.
  seedWake(world, { idleWakes: 2, menuItems: 1, menuFp: fingerprint(menu) }, 60_000);
  const again = tick(world);
  assert.deepEqual([again.action, again.reason], ['wake-withheld', 'unanswered']);
  const typed = wakes(world).length;

  seedWake(world, { idleWakes: 3, menuItems: 1, menuFp: fingerprint(menu) }, 6 * 60_000);
  assert.equal(tick(world).action, 'woken', 'a menu left unanswered past the bound is woken again');
  assert.equal(wakes(world).length, typed + 2, 'the seeded wake and the new one');

  // A Kernel that booted a minute ago is reading its files and its first status inside the boot turn: no liveness wake lands in it.
  world.ledger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId: world.wf, entityType: 'kernel', entityId: world.wf, kind: 'kernel-restarted', createdAt: Date.now() - 60_000,
    payload: { terminal: 'term-kernel-current', host: 'orca' } })));
  const booting = tick(world);
  assert.deepEqual([booting.action, booting.reason], ['wake-withheld', 'booting']);
});

test('wakes typed for an empty menu never rotate the seat; wakes typed for a menu the seat left unanswered do', (t) => {
  const world = worldOf(t, 'leg-ready');
  for (let i = 0; i < 8; i += 1) seedWake(world, { idleWakes: i + 1, menuItems: 0, menuFp: 'none' }, (9 - i) * 60_000 * 20);
  const kept = tick(world);
  assert.equal(kept.rotation, undefined, `eight wakes of the runtime's own are no reason to replace the seat: ${kept.action}`);
  assert.ok(['woken', 'wake-withheld'].includes(kept.action), kept.action);
  for (let i = 0; i < 8; i += 1) seedWake(world, { idleWakes: i + 1, menuItems: 1, menuFp: `fp${i}` }, (9 - i) * 60_000 * 10);
  const rotated = tick(world);
  assert.match(rotated.rotation?.reason ?? '', /wakes since its boot \(bound 8\)/, 'eight wakes the seat left unanswered replace it, as before');
});
