// The host lock API (scripts/machine/host-lock.mjs): one atomic lock directory with a JSON owner file, a token-checked
// release, a takeover of a dead holder, and the legacy plain-text owner read as held. The release cut (GOVERNANCE lane,
// scripts/supervisor/release-cut.mjs) calls withHostLock({role: 'release', purpose: 'release-cut'}); the land gate calls
// withHostLock({role: 'coordinator', purpose: 'land'}) and refuses a land while another holder has the lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import {
  ROLES, HOST_LOCK_SCHEMA, hostLockDir, acquireHostLock, releaseHostLock, hostLockOwner, withHostLock,
} from '../../scripts/machine/host-lock.mjs';
import { landCommits } from '../../scripts/supervisor/land.mjs';

const T0 = Date.parse('2026-10-01T10:00:00.000Z');
const HOST = 'host-a';
const alive = () => true;
const dead = () => false;
const lockOf = (t) => path.join(mkdtemp(t, 'starci-hostlock-'), 'lock');
const base = (dir, extra = {}) => ({ dir, now: () => T0, isAlive: alive, host: HOST, env: {}, ...extra });
const names = (dir) => fs.readdirSync(path.dirname(dir)).sort();

test('hostLockDir: STARCI_HOST_LOCK_DIR wins, else host-lock under the starci local root', () => {
  assert.equal(hostLockDir({ env: { STARCI_HOST_LOCK_DIR: path.resolve('some', 'where') } }), path.resolve('some', 'where'));
  const root = path.resolve('local-root');
  assert.equal(hostLockDir({ env: { STARCI_LOCAL_ROOT: root } }), path.join(root, 'host-lock'));
});

test('acquire writes the JSON owner file; a second acquire is held and names the owner', (t) => {
  const dir = lockOf(t);
  const got = acquireHostLock({ ...base(dir), role: 'coordinator', purpose: 'land', handle: 'term_1', pid: 4242, ttlMs: 60_000 });
  assert.equal(got.ok, true);
  assert.equal(typeof got.token, 'string');
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'owner'), 'utf8'));
  assert.deepEqual(onDisk, { schema: HOST_LOCK_SCHEMA, token: got.token, pid: 4242, role: 'coordinator', purpose: 'land', handle: 'term_1', host: HOST, since: '2026-10-01T10:00:00.000Z', ttlMs: 60_000 });
  assert.deepEqual(got.owner, onDisk);
  const second = acquireHostLock({ ...base(dir), role: 'worker', purpose: 'other', pid: 7 });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'held');
  assert.equal(second.owner.token, got.token);
  assert.equal(second.owner.stale, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'owner'), 'utf8')).token, got.token, 'the holder is untouched');
});

test('the handle defaults to ORCA_TERMINAL_HANDLE of the env, else null', (t) => {
  const withHandle = acquireHostLock({ ...base(lockOf(t)), role: 'lead', purpose: 'p', env: { ORCA_TERMINAL_HANDLE: 'term_9' } });
  assert.equal(withHandle.owner.handle, 'term_9');
  const without = acquireHostLock({ ...base(lockOf(t)), role: 'lead', purpose: 'p' });
  assert.equal(without.owner.handle, null);
});

test('a role outside ROLES is refused and nothing is created', (t) => {
  assert.deepEqual([...ROLES], ['release', 'coordinator', 'lead', 'worker']);
  const dir = lockOf(t);
  const got = acquireHostLock({ ...base(dir), role: 'owner', purpose: 'x' });
  assert.equal(got.ok, false);
  assert.equal(got.reason, 'bad-role');
  assert.equal(fs.existsSync(dir), false);
});

test('release removes the lock only for its token; a stranger is refused; a missing lock is not an error', (t) => {
  const dir = lockOf(t);
  const got = acquireHostLock({ ...base(dir), role: 'lead', purpose: 'p' });
  const stranger = releaseHostLock({ ...base(dir), token: 'not-the-token' });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.reason, 'not-owner');
  assert.equal(stranger.owner.token, got.token);
  assert.equal(fs.existsSync(path.join(dir, 'owner')), true, 'the stranger removed nothing');
  assert.equal(releaseHostLock({ ...base(dir), token: undefined }).reason, 'not-owner');
  assert.deepEqual(releaseHostLock({ ...base(dir), token: got.token }), { ok: true, released: true });
  assert.deepEqual(names(dir), []);
  assert.deepEqual(releaseHostLock({ ...base(dir), token: got.token }), { ok: true, released: false });
});

test('hostLockOwner: null when free, the owner when held, stale:true for a dead holder', (t) => {
  const dir = lockOf(t);
  assert.equal(hostLockOwner(base(dir)), null);
  const got = acquireHostLock({ ...base(dir), role: 'release', purpose: 'release-cut', pid: 31337 });
  const live = hostLockOwner(base(dir));
  assert.equal(live.token, got.token);
  assert.equal(live.stale, false);
  const gone = hostLockOwner(base(dir, { isAlive: (pid) => { assert.equal(pid, 31337); return false; } }));
  assert.equal(gone.stale, true);
  assert.equal(gone.role, 'release');
  assert.equal(gone.pid, 31337);
});

test('a dead holder is taken over atomically and the takeover is reported; no aside directory is left', (t) => {
  const dir = lockOf(t);
  const first = acquireHostLock({ ...base(dir), role: 'worker', purpose: 'old', pid: 111 });
  const second = acquireHostLock({ ...base(dir, { isAlive: dead }), role: 'coordinator', purpose: 'land', pid: 222 });
  assert.equal(second.ok, true);
  assert.notEqual(second.token, first.token);
  assert.equal(second.tookOverFrom.token, first.token);
  assert.equal(second.tookOverFrom.pid, 111);
  assert.equal(hostLockOwner(base(dir)).token, second.token);
  assert.deepEqual(names(dir), ['lock']);
  assert.equal(releaseHostLock({ ...base(dir), token: first.token }).reason, 'not-owner', 'the old token no longer releases anything');
});

test('a live holder, or one on another host (no pid to test), is never taken over', (t) => {
  const dir = lockOf(t);
  const mine = acquireHostLock({ ...base(dir), role: 'worker', purpose: 'p', pid: 1 });
  assert.equal(acquireHostLock({ ...base(dir), role: 'lead', purpose: 'q' }).reason, 'held');
  const elsewhere = acquireHostLock({ ...base(dir, { isAlive: dead, host: 'host-b' }), role: 'lead', purpose: 'q' });
  assert.equal(elsewhere.ok, false);
  assert.equal(elsewhere.owner.token, mine.token);
  assert.equal(elsewhere.owner.stale, false);
});

test('a ttl that ran out makes a live holder stale', (t) => {
  const dir = lockOf(t);
  acquireHostLock({ ...base(dir), role: 'worker', purpose: 'p', ttlMs: 1000 });
  assert.equal(acquireHostLock({ ...base(dir, { now: () => T0 + 999 }), role: 'lead', purpose: 'q' }).reason, 'held');
  const late = acquireHostLock({ ...base(dir, { now: () => T0 + 1000 }), role: 'lead', purpose: 'q' });
  assert.equal(late.ok, true);
  assert.equal(late.tookOverFrom.purpose, 'p');
});

test('a legacy plain-text owner is held, never stale by pid, and stale only past legacyStaleMs', (t) => {
  const dir = lockOf(t);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'owner'), 'term_7 preverify 2026-10-01\n');
  const mtime = new Date(T0 - 1000);
  fs.utimesSync(path.join(dir, 'owner'), mtime, mtime);
  fs.utimesSync(dir, mtime, mtime);
  const owner = hostLockOwner(base(dir, { isAlive: dead }));
  assert.equal(owner.legacy, true);
  assert.match(owner.text, /term_7 preverify/);
  assert.equal(owner.stale, false);
  assert.equal(acquireHostLock({ ...base(dir, { isAlive: dead }), role: 'lead', purpose: 'p' }).reason, 'held');
  assert.equal(releaseHostLock({ ...base(dir), token: 'x' }).reason, 'not-owner');
  const old = acquireHostLock({ ...base(dir, { isAlive: dead, now: () => T0 + 7 * 3_600_000 }), role: 'lead', purpose: 'p' });
  assert.equal(old.ok, true);
  assert.equal(old.tookOverFrom.legacy, true);
});

test('a takeover that finds a live lock where the stale one was puts it back and reports held', (t) => {
  const dir = lockOf(t);
  const dead1 = acquireHostLock({ ...base(dir), role: 'worker', purpose: 'old', pid: 5 });
  const real = fs;
  let interfered = false;
  // between the contender's judgement (stale) and its rename, another actor takes the stale lock over and holds it live
  const racing = { ...real, renameSync: (from, to) => {
    if (!interfered && from === dir) {
      interfered = true;
      const winner = acquireHostLock({ ...base(dir, { isAlive: dead }), role: 'coordinator', purpose: 'land', pid: 6 });
      assert.equal(winner.ok, true);
    }
    return real.renameSync(from, to);
  } };
  const loser = acquireHostLock({ ...base(dir, { isAlive: (pid) => pid !== 5, fs: racing }), role: 'lead', purpose: 'late', pid: 7 });
  assert.equal(loser.ok, false);
  assert.equal(loser.reason, 'held');
  assert.equal(loser.owner.pid, 6);
  assert.equal(hostLockOwner(base(dir)).purpose, 'land', 'the live lock was restored in place');
  assert.notEqual(dead1.token, hostLockOwner(base(dir)).token);
});

test('withHostLock runs fn under the lock, releases on return and on throw, and refuses without running fn when held', async (t) => {
  const dir = lockOf(t);
  const seen = withHostLock({ ...base(dir), role: 'coordinator', purpose: 'land' }, ({ token, owner }) => ({ inside: hostLockOwner(base(dir)).token === token, role: owner.role }));
  assert.deepEqual(seen, { inside: true, role: 'coordinator' });
  assert.equal(hostLockOwner(base(dir)), null);
  assert.throws(() => withHostLock({ ...base(dir), role: 'lead', purpose: 'p' }, () => { throw new Error('boom'); }), /boom/);
  assert.equal(hostLockOwner(base(dir)), null, 'released after the throw');
  const held = acquireHostLock({ ...base(dir), role: 'release', purpose: 'release-cut' });
  let ran = false;
  const refused = withHostLock({ ...base(dir), role: 'coordinator', purpose: 'land' }, () => { ran = true; });
  assert.equal(ran, false);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'held');
  assert.equal(refused.owner.token, held.token);
  releaseHostLock({ ...base(dir), token: held.token });
  const later = await withHostLock({ ...base(dir), role: 'worker', purpose: 'p' }, async () => { await Promise.resolve(); return hostLockOwner(base(dir)).purpose; });
  assert.equal(later, 'p');
  assert.equal(hostLockOwner(base(dir)), null, 'an async fn releases when it settles');
});

test('land: the heavy part runs under role coordinator purpose land; a held lock refuses the land naming the holder', () => {
  let asked = null;
  const stub = (options, fn) => { asked = options; return { ok: false, reason: 'held', owner: { role: 'release', purpose: 'release-cut', pid: 99, since: '2026-10-01T10:00:00.000Z' } }; };
  const r = landCommits({ commits: ['abc1234'], root: path.resolve('no-such-root'), env: {}, deps: { hostLock: stub } });
  assert.equal(asked.role, 'coordinator');
  assert.equal(asked.purpose, 'land');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'host-lock-held');
  assert.deepEqual(r.commits, ['abc1234']);
  assert.match(r.detail, /release/);
  assert.match(r.detail, /release-cut/);
  assert.match(r.detail, /pid 99/);
  assert.equal(r.owner.role, 'release');
  const passed = landCommits({ commits: ['abc1234'], env: {}, deps: { hostLock: (options, fn) => ({ ok: true, ran: typeof fn }) } });
  assert.deepEqual(passed, { ok: true, ran: 'function' });
});
