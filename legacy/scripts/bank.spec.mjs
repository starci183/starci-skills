// The bank of one product: what the queue means, what the hash covers and what it deliberately does
// not, and which mission is taken next. scripts/bank.mjs is the one home of all three.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  canonical, queueHash, missionDigest, enqueue, reorder, drop, markRunning, markDone, next,
  plannedOrder, currentApproval, validateMission, validateQueue, validateBank, readBank, approvalId,
} from './bank.mjs';
import { bankRefErrors } from './validate-session.mjs';

const PRODUCT = 'fixture-product';
const entry = (missionId, priority = 'P1', dependsOn = []) => ({ missionId, status: 'banked', dependsOn, priority });
const queue = (entries) => ({ schemaVersion: 9, product: PRODUCT, entries });
const BASE = queue([entry('a', 'P0'), entry('b', 'P1'), entry('c', 'P1', ['a'])]);
const mission = (missionId, patch = {}) => ({
  schemaVersion: 9, missionId, product: PRODUCT, title: `Do ${missionId}`, routes: ['fe'], env: 'dev',
  evidenceRefs: ['unchecked:u-1'],
  goalDraft: { version: 1, language: 'vi', goal: `Do ${missionId}`, includes: ['the one surface'], excludes: [], doneWhen: [{ evidence: 'a walk receipt', producedBy: 'uat.verify' }], sourceRef: 'the unchecked ledger' },
  ...patch,
});

test('canonical form ignores key order, so two files that say the same thing hash the same', () => {
  assert.equal(canonical({ b: 1, a: [2, { d: 4, c: 3 }] }), canonical({ a: [2, { c: 3, d: 4 }], b: 1 }));
  assert.notEqual(canonical({ a: 1 }), canonical({ a: '1' }));
});

test('the hash covers composition and content, never progress', () => {
  const digests = new Map([['a', 'sha256:aa'], ['b', 'sha256:bb'], ['c', 'sha256:cc']]);
  const base = queueHash(BASE, digests);
  assert.equal(queueHash(markRunning(BASE, 'a', 's-1'), digests), base, 'running a mission leaves the approval alone');
  assert.equal(queueHash(markDone(BASE, 'a', 's-1'), digests), base, 'finishing a mission leaves the approval alone');
  assert.notEqual(queueHash(reorder(BASE, ['b', 'a', 'c']), digests), base, 'reordering asks the person again');
  assert.notEqual(queueHash(enqueue(BASE, { missionId: 'd' }), digests), base, 'adding asks the person again');
  assert.notEqual(queueHash(drop(BASE, 'b'), digests), base, 'dropping asks the person again');
  assert.notEqual(queueHash(BASE, new Map([...digests, ['a', 'sha256:changed']])), base, 'correcting a mission goal asks the person again');
});

test('the next mission is one at a time, and a dependency is waited for', () => {
  assert.equal(next(BASE).missionId, 'a');
  assert.equal(next(markRunning(BASE, 'a', 's-1')), null, 'one mission per product at a time');
  assert.equal(next(markDone(BASE, 'a', 's-1')).missionId, 'b');
  const noDeps = markDone(markDone(BASE, 'a', 's-1'), 'b', 's-2');
  assert.equal(next(noDeps).missionId, 'c');
  const blocked = queue([entry('c', 'P0', ['a']), entry('a', 'P3')]);
  assert.equal(next(blocked).missionId, 'a', 'a dependency is taken before the mission that waits for it, whatever its priority');
});

test('a drafted bank comes out ordered by what a mission waits for, then priority, then id', () => {
  assert.deepEqual(plannedOrder(queue([entry('c', 'P1', ['a']), entry('b', 'P1'), entry('a', 'P0')]).entries), ['a', 'b', 'c']);
  assert.deepEqual(plannedOrder(queue([entry('z', 'P0'), entry('y', 'P0')]).entries), ['y', 'z']);
  assert.equal(plannedOrder(queue([entry('a', 'P0', ['b']), entry('b', 'P0', ['a'])]).entries), null, 'a cycle has no order');
  assert.deepEqual(plannedOrder(queue([entry('a', 'P0'), { ...entry('b'), status: 'dropped' }]).entries), ['a'], 'a dropped mission is not in the order');
});

test('a mission with no evidence ref is refused', async () => {
  assert.deepEqual(await validateMission(mission('a'), 'at'), []);
  const errors = await validateMission({ ...mission('a'), evidenceRefs: [] }, 'at');
  assert.ok(errors.some((e) => e.includes('evidenceRefs')), errors.join('\n'));
  const bad = await validateMission({ ...mission('a'), evidenceRefs: ['a plausible reason'] }, 'at');
  assert.ok(bad.some((e) => e.includes('evidenceRefs')), 'an evidence ref is one of the closed schemes, not prose');
});

test('the queue answers for its own entries', async () => {
  assert.deepEqual(await validateQueue(BASE, 'at'), []);
  const cyclic = await validateQueue(queue([entry('a', 'P0', ['zz'])]), 'at');
  assert.ok(cyclic.some((e) => e.includes('depends on zz')), cyclic.join('\n'));
  const two = await validateQueue(queue([{ ...entry('a'), status: 'running:s-1' }, { ...entry('b'), status: 'running:s-2' }]), 'at');
  assert.ok(two.some((e) => e.includes('one mission of a product runs at a time')), two.join('\n'));
});

test('a bank on disk reads back whole, and its approval is current only for the queue it approved', async () => {
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const dir = path.join(hostRoot, '.worktrees', 'banked', PRODUCT);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(BASE));
  for (const id of ['a', 'b', 'c']) {
    mkdirSync(path.join(dir, id), { recursive: true });
    writeFileSync(path.join(dir, id, 'mission.json'), JSON.stringify(mission(id)));
    writeFileSync(path.join(dir, id, 'mission.md'), `# Do ${id}\n`);
  }
  const bank = await readBank(hostRoot, PRODUCT);
  assert.equal(bank.digests.get('a'), missionDigest(mission('a')));
  assert.deepEqual((await validateBank(hostRoot, PRODUCT)).errors, []);

  const approvals = { schemaVersion: 9, product: PRODUCT, approvals: [{ choice: approvalId(PRODUCT, 1), who: 'the owner', at: '2026-09-05T10:00:00Z', queueHash: bank.hash, missionIds: ['a', 'b', 'c'] }] };
  assert.ok(currentApproval(approvals, bank.hash), 'the approval covers the queue it was taken over');
  writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(markRunning(BASE, 'a', 's-1')));
  const running = await readBank(hostRoot, PRODUCT);
  assert.ok(currentApproval(approvals, running.hash), 'taking a mission does not invalidate the approval');
  writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(reorder(BASE, ['b', 'a', 'c'])));
  const reordered = await readBank(hostRoot, PRODUCT);
  assert.equal(currentApproval(approvals, reordered.hash), null, 'reordering does');
  rmSync(hostRoot, { recursive: true, force: true });
});

test('a bank is swept for secret-shaped values, like any receipt', async () => {
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const dir = path.join(hostRoot, '.worktrees', 'banked', PRODUCT);
  mkdirSync(path.join(dir, 'a'), { recursive: true });
  writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(queue([entry('a', 'P0')])));
  writeFileSync(path.join(dir, 'a', 'mission.json'), JSON.stringify(mission('a')));
  writeFileSync(path.join(dir, 'a', 'mission.md'), '# Do a\n\nSign in with password: "not-a-real-one"\n');
  const { errors } = await validateBank(hostRoot, PRODUCT);
  assert.ok(errors.some((e) => e.includes('shaped value')), errors.join('\n'));
  rmSync(hostRoot, { recursive: true, force: true });
});

test('a queue entry with no mission, and a mission with no entry, are both refused', async () => {
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const dir = path.join(hostRoot, '.worktrees', 'banked', PRODUCT);
  mkdirSync(path.join(dir, 'a'), { recursive: true });
  writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(queue([entry('a', 'P0'), entry('b')])));
  writeFileSync(path.join(dir, 'a', 'mission.json'), JSON.stringify(mission('a')));
  writeFileSync(path.join(dir, 'a', 'mission.md'), '# Do a\n');
  const { errors } = await validateBank(hostRoot, PRODUCT);
  assert.ok(errors.some((e) => e.includes('b has no b/mission.json')), errors.join('\n'));
  rmSync(hostRoot, { recursive: true, force: true });
});

test('a session opened from a bank names an entry that is there, is its own, and is still covered', async () => {
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'bank-'));
  const dir = path.join(hostRoot, '.worktrees', 'banked', PRODUCT);
  mkdirSync(dir, { recursive: true });
  const write = (q) => writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(q));
  write(markRunning(BASE, 'a', 's-1'));
  for (const id of ['a', 'b', 'c']) {
    mkdirSync(path.join(dir, id), { recursive: true });
    writeFileSync(path.join(dir, id, 'mission.json'), JSON.stringify(mission(id)));
    writeFileSync(path.join(dir, id, 'mission.md'), `# Do ${id}\n`);
  }
  const hash = (await readBank(hostRoot, PRODUCT)).hash;
  const choice = approvalId(PRODUCT, 1);
  writeFileSync(path.join(dir, 'approvals.json'), JSON.stringify({ schemaVersion: 9, product: PRODUCT, approvals: [{ choice, who: 'the owner', at: '2026-09-05T10:00:00Z', queueHash: hash, missionIds: ['a', 'b', 'c'] }] }));
  const draft = mission('a').goalDraft;
  const state = (patch = {}) => ({
    id: 's-1', choices: { 'goal:s-1:v1': { selected: 'as-stated', selectedBy: 'user', sourceRef: `@worktrees/banked/${PRODUCT}/approvals.json#${choice}` } },
    mission: { version: 1, language: draft.language, goal: draft.goal, includes: draft.includes, excludes: draft.excludes, doneWhen: draft.doneWhen, sourceRef: 'the bank', bankRef: { product: PRODUCT, missionId: 'a', approval: choice }, ...patch },
  });
  assert.deepEqual(await bankRefErrors(state(), { hostRoot }), []);
  assert.ok((await bankRefErrors(state({ goal: 'something else entirely' }), { hostRoot })).some((e) => e.includes('is not what')), 'a goal the bank did not carry');
  assert.ok((await bankRefErrors({ ...state(), id: 's-2' }, { hostRoot })).some((e) => e.includes('names the session that took it')), 'a session that took a mission another session holds');
  assert.ok((await bankRefErrors(state({ bankRef: { product: PRODUCT, missionId: 'zz', approval: choice } }), { hostRoot })).some((e) => e.includes('does not list')), 'an entry that is not in the queue');
  write(reorder(markRunning(BASE, 'a', 's-1'), ['b', 'a', 'c']));
  assert.ok((await bankRefErrors(state(), { hostRoot })).some((e) => e.includes('no approval covers the bank as it stands')), 'a queue reordered since it was approved');
  assert.deepEqual(await bankRefErrors({ id: 's-1', mission: { version: 1 } }, { hostRoot }), [], 'a mission that was never banked answers to none of this');
  rmSync(hostRoot, { recursive: true, force: true });
});

test('enqueue, reorder and drop refuse what they cannot mean', () => {
  assert.throws(() => enqueue(BASE, { missionId: 'a' }), /already banked/);
  assert.throws(() => reorder(BASE, ['a', 'b']), /exactly the missions/);
  assert.throws(() => markDone(BASE, 'zz', 's-1'), /is not banked/);
  assert.equal(enqueue(BASE, { missionId: 'd' }, { at: 0 }).entries[0].missionId, 'd');
});

// The bank actually run: three missions, taken one at a time in the order the queue holds, with the
// entry marked when the session opens and again when it ends. `next` is what the orchestrator takes
// from, `markRunning`/`markDone` are what it writes back, and the session gate is what refuses a queue
// that reads the opposite of what happened.
test('three banked missions run in order, and one that stops for the person pauses the bank', async () => {
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'bank-run-'));
  const dir = path.join(hostRoot, '.worktrees', 'banked', PRODUCT);
  mkdirSync(dir, { recursive: true });
  for (const id of ['a', 'b', 'c']) {
    mkdirSync(path.join(dir, id), { recursive: true });
    writeFileSync(path.join(dir, id, 'mission.json'), JSON.stringify(mission(id)));
    writeFileSync(path.join(dir, id, 'mission.md'), `# Do ${id}\n`);
  }
  let q = BASE;
  const write = () => writeFileSync(path.join(dir, 'queue.json'), JSON.stringify(q));
  write();
  const hash = (await readBank(hostRoot, PRODUCT)).hash;
  const choice = approvalId(PRODUCT, 1);
  writeFileSync(path.join(dir, 'approvals.json'), JSON.stringify({ schemaVersion: 9, product: PRODUCT, approvals: [{ choice, who: 'the owner', at: '2026-09-05T10:00:00Z', queueHash: hash, missionIds: ['a', 'b', 'c'] }] }));
  const opened = (missionId, sessionId, status) => {
    const draft = mission(missionId).goalDraft;
    return { id: sessionId, status, choices: { [`goal:${sessionId}:v1`]: { selected: 'as-stated', selectedBy: 'user', sourceRef: `@worktrees/banked/${PRODUCT}/approvals.json#${choice}` } }, mission: { version: 1, language: draft.language, goal: draft.goal, includes: draft.includes, excludes: draft.excludes, doneWhen: draft.doneWhen, sourceRef: 'the bank', bankRef: { product: PRODUCT, missionId, approval: choice } } };
  };
  const taken = [];

  // Mission 1: taken, opened, ended done.
  let pick = next(q);
  assert.equal(pick.missionId, 'a');
  taken.push(pick.missionId);
  q = markRunning(q, 'a', 's-1'); write();
  assert.deepEqual(await bankRefErrors(opened('a', 's-1', 'running'), { hostRoot }), []);
  assert.equal(next(q), null, 'nothing is taken while a sibling of the same product is running');
  assert.ok((await bankRefErrors(opened('a', 's-1', 'done'), { hostRoot })).some((e) => e.includes('stays running and pauses the bank')), 'a done session over an entry still marked running');
  q = markDone(q, 'a', 's-1'); write();
  assert.deepEqual(await bankRefErrors(opened('a', 's-1', 'done'), { hostRoot }), []);
  assert.equal(queueHash(q, (await readBank(hostRoot, PRODUCT)).digests), hash, 'running and finishing left the approval alone');

  // Mission 2: taken next, and it stops for the person. The entry stays running, so nothing else opens.
  pick = next(q);
  assert.equal(pick.missionId, 'b');
  taken.push(pick.missionId);
  q = markRunning(q, 'b', 's-2'); write();
  assert.deepEqual(await bankRefErrors(opened('b', 's-2', 'blocked'), { hostRoot }), [], 'a session that stopped for the person leaves its entry running');
  assert.ok((await bankRefErrors({ ...opened('b', 's-2', 'blocked'), id: 's-2' }, { hostRoot: hostRoot })).length === 0);
  assert.equal(next(q), null, 'the bank is paused while the blocked mission holds its entry');
  q = markDone(markDone(q, 'b', 's-2'), 'a', 's-1'); write();

  // Mission 3 waited for mission 1 and is taken only now.
  pick = next(q);
  assert.equal(pick.missionId, 'c');
  taken.push(pick.missionId);
  assert.deepEqual(taken, ['a', 'b', 'c']);
  assert.deepEqual((await validateBank(hostRoot, PRODUCT)).errors, []);
  rmSync(hostRoot, { recursive: true, force: true });
});
