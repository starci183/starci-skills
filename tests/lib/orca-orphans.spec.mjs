// Orphan worktrees after a crash (lane ORPHAN2, deep map REPLACE #5 WT4). Orca's `worktree ps` is the source of truth
// for the trees Orca made; the runtime's ownership stamp (`--comment starci:<kind>:<slot>...`, written by the same call
// that creates the tree) tells the runtime's trees from everyone else's. The worktree GC (scripts/machine/worktrees.mjs
// gcWorktrees) adopts a stamped tree with no registry row while its owner lives, or preserves its work to
// preserved/orphan/<id> and removes it link-safely once its owner ended or is unknown, creating and closing the registry
// row and logging an incident. An unstamped tree is never touched. A registered tree Orca no longer lists is reported,
// never removed by other means. Every Orca call goes to the fake client (tests/helpers/fake-orca-worktrees.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { withMachine } from '../../engine/db/machine.mjs';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { reserveOrcaSlot, createOrcaWorktree } from '../../scripts/machine/worktree-orca.mjs';
import { ENDED_WORKFLOW_PHASES } from '../../scripts/machine/worktree-registry.mjs';
import { ensureWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { runtimeStampOf, parseRuntimeStamp, psCoverage, orphanVerdict, orphanPreserveName } from '../../scripts/lib/orca-orphans.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';

const HOUR = 3_600_000;
const posix = (p) => String(p).replace(/\\/g, '/');
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

/** A product repo on main, a machine registry of its own and a fake Orca. */
function fixture(t, orcaOpts = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-orphan2-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'shop');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'spec@starci.test');
  git(repo, 'config', 'user.name', 'spec');
  git(repo, 'config', 'core.autocrlf', 'false');
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'src/a.ts', 'export const a = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca'), ...orcaOpts });
  return { base, repo, env, orca };
}

/** What a crash between Orca's create and the registry bind leaves: the slot reserved, the stamped tree made, no bind. */
function crashAfterCreate({ repo, env, orca, workflowId, staleSlot = true }) {
  const name = `wf-${workflowId}`;
  const slot = reserveOrcaSlot({ repoRoot: repo, kind: 'workflow', slotKey: name, owner: { workflowId }, env });
  assert.ok(slot.ok, JSON.stringify(slot));
  if (staleSlot) withMachine((m) => m.db.prepare('UPDATE worktrees SET created_at=? WHERE path=?').run(1, slot.pending), { env });
  const made = orca.create({ repo: `path:${posix(repo)}`, name, baseBranch: 'main', setup: 'run', comment: runtimeStampOf({ kind: 'workflow', slot: name, owner: { workflowId } }) });
  assert.ok(made.ok);
  return { slot, tree: made.worktree, dir: path.resolve(made.worktree.path) };
}

const rowsAt = (env, dir) => withMachine((m) => m.db.prepare('SELECT * FROM worktrees WHERE path=?').all(path.resolve(dir)), { env });
const incidents = (env) => withMachine((m) => m.db.prepare("SELECT level, msg, data_json, workflow_id FROM machine_logs WHERE kind='worktree.orphan' ORDER BY at, rowid").all(), { env });
const phases = (map) => Object.assign(() => null, { workflowPhase: (_, id) => map[id] ?? null });
const at = (items, dir) => items.filter((i) => i.path && path.resolve(i.path) === path.resolve(dir));

/* ------------------------------------------------------------ pure */

test('the ownership stamp round-trips, and any other comment is foreign', () => {
  const stamp = runtimeStampOf({ kind: 'critic', slot: 'draw-critic-ab12', owner: { workflowId: 'wf-shop-k2', jobId: 'job:7/x', ledgerId: 'shop' } });
  assert.equal(stamp, 'starci:critic:draw-critic-ab12;wf=wf-shop-k2;job=job%3A7%2Fx;ledger=shop');
  assert.deepEqual(parseRuntimeStamp(stamp), { kind: 'critic', slot: 'draw-critic-ab12', workflowId: 'wf-shop-k2', jobId: 'job:7/x', ledgerId: 'shop', supJobId: null });
  assert.deepEqual(parseRuntimeStamp(runtimeStampOf({ kind: 'workflow', slot: 'wf-a', owner: {} })), { kind: 'workflow', slot: 'wf-a', workflowId: null, jobId: null, ledgerId: null, supJobId: null });
  for (const foreign of ['', null, 'lane notes', 'starci:lane:x', 'starci:workflow:', 'starci:workflow:a b', 'starci:workflow:a;zz=1', 'prefix starci:workflow:a', 'STARCI:workflow:a'])
    assert.equal(parseRuntimeStamp(foreign), null, `foreign: ${foreign}`);
  assert.throws(() => runtimeStampOf({ kind: 'lane', slot: 'x' }), /not a stamped Orca kind/);
  const staging = runtimeStampOf({ kind: 'supervisor-staging', slot: 'sup-42', owner: { supJobId: 'sup-42' } });
  assert.equal(staging, 'starci:supervisor-staging:sup-42;sup=sup-42');
  assert.equal(parseRuntimeStamp(staging).supJobId, 'sup-42');
  assert.match(orphanPreserveName({ slot: 'wf-a/b', orcaId: `repo::${path.join(os.tmpdir(), 'x')}`, digest: (x) => crypto.createHash('sha1').update(x).digest('hex') }), /^orphan\/wf-a_b-[0-9a-f]{10}$/);
});

test('orphanVerdict: foreign never touched, in-flight left, a live owner adopted, an ended or long-unknown owner collected', () => {
  const v = (o) => orphanVerdict({ ownerGoneMs: HOUR, endedPhases: new Set(ENDED_WORKFLOW_PHASES), settledStatuses: new Set(SETTLED_JOB_LIST), ageMs: 2 * HOUR, ...o });
  const wf = parseRuntimeStamp('starci:workflow:wf-a;wf=a');
  const critic = parseRuntimeStamp('starci:critic:draw-critic-1;job=j1');
  assert.deepEqual(v({ stamp: null, workflowPhase: 'finished' }), { verdict: 'foreign' });
  assert.deepEqual(v({ stamp: wf, inFlight: true, workflowPhase: 'finished' }), { verdict: 'in-flight' });
  assert.deepEqual(v({ stamp: wf, workflowPhase: 'finished', liveTerminals: 1 }), { verdict: 'adopt', owner: 'live' }, 'an agent still works in it');
  assert.deepEqual(v({ stamp: wf, workflowPhase: 'finished' }), { verdict: 'collect', owner: 'ended' });
  assert.deepEqual(v({ stamp: wf, workflowPhase: 'running' }), { verdict: 'adopt', owner: 'live' });
  assert.deepEqual(v({ stamp: wf }), { verdict: 'collect', owner: 'unknown' });
  assert.deepEqual(v({ stamp: wf, ageMs: HOUR / 2 }), { verdict: 'keep', owner: 'unknown' }, 'an unknown owner gets the grace');
  assert.deepEqual(v({ stamp: critic, jobStatus: SETTLED_JOB_LIST[0] }), { verdict: 'collect', owner: 'ended' });
  assert.deepEqual(v({ stamp: critic, jobStatus: 'running' }), { verdict: 'adopt', owner: 'live' });
  const staging = parseRuntimeStamp('starci:supervisor-staging:sup-42;sup=sup-42');
  const sup = (o) => v({ stamp: staging, ...o });
  assert.deepEqual(sup({ jobStatus: 'succeeded' }), { verdict: 'collect', owner: 'ended' }, 'a staging tree follows its Supervisor job');
  assert.deepEqual(sup({ jobStatus: 'running' }), { verdict: 'adopt', owner: 'live' });
  assert.deepEqual(v({ stamp: critic, ageMs: 0 }), { verdict: 'keep', owner: 'unknown' });
});

test('psCoverage: only a complete page of every host proves a tree is gone', () => {
  assert.deepEqual([psCoverage({ ok: true, truncated: false, omittedHostIds: [] }).complete], [true]);
  assert.equal(psCoverage({ ok: true, truncated: true, omittedHostIds: [] }).complete, false);
  const remote = psCoverage({ ok: true, truncated: false, omittedHostIds: ['ssh-box'] });
  assert.deepEqual([remote.complete, remote.covered('local'), remote.covered('ssh-box')], [false, true, false]);
  assert.deepEqual([psCoverage({ ok: false }).ok, psCoverage(null).complete], [false, false]);
});

/* ------------------------------------------------------------ stamp at create */

test('every Orca tree the runtime creates carries its ownership stamp', (t) => {
  const { repo, env, orca } = fixture(t);
  assert.ok(ensureWorkflowWorktree({ env, orca }, { workflowId: 'wf-shop-s1', appRepo: repo, ledgerId: 'shop' }).ok);
  const critic = createOrcaWorktree({ repoRoot: repo, kind: 'critic', name: 'draw-critic-9f', base: 'main', cap: null, owner: { workflowId: 'wf-shop-s1', jobId: 'job-3' }, env, orca });
  assert.ok(critic.ok);
  const comments = orca.calls.filter(([verb]) => verb === 'create').map(([, a]) => a.comment);
  assert.deepEqual(comments, ['starci:workflow:wf-wf-shop-s1;wf=wf-shop-s1;ledger=shop', 'starci:critic:draw-critic-9f;wf=wf-shop-s1;job=job-3']);
});

/* ------------------------------------------------------------ crash between create and bind */

test('a crash between create and bind: the slot goes back, the stamped tree\'s work is preserved, it is removed and its row closed, with an incident', (t) => {
  const { repo, env, orca } = fixture(t);
  const { slot, tree, dir } = crashAfterCreate({ repo, env, orca, workflowId: 'wf-shop-c1' });
  write(dir, 'src/wip.ts', 'export const wip = 1;\n');
  write(dir, 'src/done.ts', 'export const done = 1;\n');
  git(dir, 'add', 'src/done.ts'); git(dir, 'commit', '-qm', 'unlanded');
  write(dir, 'node_modules/x/index.js', 'never preserved\n');
  const items = gcWorktrees({ env, now: Date.now() + 2 * HOUR, repos: [repo], jobStatusOf: phases({ 'wf-shop-c1': 'stopped' }), ownerAlive: () => false, orca });
  assert.equal(at(items, slot.pending)[0]?.reason, 'slot-never-bound', JSON.stringify(items));
  const [item] = at(items, dir);
  assert.deepEqual([item?.reason, item?.action, item?.owner, item?.home, item?.ok], ['orca-orphan', 'remove', 'ended', 'orca', true], JSON.stringify(items));
  // preserved before removal: the uncommitted file and the unlanded commit, never node_modules
  assert.match(item.preserved, /^refs\/heads\/preserved\/orphan\/wf-wf-shop-c1-[0-9a-f]{10}$/);
  const ref = item.preserved.replace('refs/heads/', '');
  assert.equal(git(repo, 'show', `${ref}:src/wip.ts`), 'export const wip = 1;');
  assert.equal(git(repo, 'show', `${ref}:src/done.ts`), 'export const done = 1;');
  assert.equal(spawnSync('git', ['cat-file', '-e', `${ref}:node_modules/x/index.js`], { cwd: repo }).status === 0, false);
  // removed link-safely through Orca, the branch gone after the preserve, the row created then closed
  assert.ok(orca.calls.some(([verb, a]) => verb === 'remove' && a.worktree === `id:${tree.id}`));
  assert.ok(!fs.existsSync(dir));
  assert.equal(spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${tree.branch}`], { cwd: repo }).status, 1);
  const rows = rowsAt(env, dir);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].kind, rows[0].orca_id, rows[0].workflow_id, rows[0].removed_at != null, rows[0].archived_ref], ['workflow', tree.id, 'wf-shop-c1', true, item.preserved]);
  const log = incidents(env);
  assert.equal(log.length, 1);
  assert.deepEqual([log[0].level, log[0].workflow_id, JSON.parse(log[0].data_json).preserved], ['warn', 'wf-shop-c1', item.preserved]);
});

test('a crash between create and bind while the workflow still runs: the tree is adopted, and the Kernel\'s next start reuses it', (t) => {
  const { repo, env, orca } = fixture(t);
  const { dir, tree } = crashAfterCreate({ repo, env, orca, workflowId: 'wf-shop-c2' });
  const items = gcWorktrees({ env, now: Date.now() + 2 * HOUR, repos: [repo], jobStatusOf: phases({ 'wf-shop-c2': 'running' }), orca });
  assert.deepEqual(at(items, dir).map((i) => [i.reason, i.action, i.ok]), [['orca-orphan-adopted', 'adopt', true]], JSON.stringify(items));
  assert.ok(fs.existsSync(dir));
  assert.equal(workflowWorktreeOf({ env }, 'wf-shop-c2')?.orcaWorktreeId, tree.id);
  const again = ensureWorkflowWorktree({ env, orca }, { workflowId: 'wf-shop-c2', appRepo: repo });
  assert.deepEqual([again.ok, again.created, again.record.path], [true, false, dir], 'no second tree is created');
  assert.equal(incidents(env).length, 1);
  const next = gcWorktrees({ env, now: Date.now() + 2 * HOUR, repos: [repo], jobStatusOf: phases({ 'wf-shop-c2': 'running' }), orca });
  assert.deepEqual(at(next, dir), [], 'an adopted tree is a registered tree: nothing more to do');
});

test('a creation still in flight (a fresh pending slot) and an unknown owner within its grace are left alone', (t) => {
  const { repo, env, orca } = fixture(t);
  const { dir } = crashAfterCreate({ repo, env, orca, workflowId: 'wf-shop-c3', staleSlot: false });
  const items = gcWorktrees({ env, now: Date.now(), repos: [repo], jobStatusOf: phases({ 'wf-shop-c3': 'finished' }), orca });
  assert.deepEqual(at(items, dir), [], JSON.stringify(items));
  const young = crashAfterCreate({ repo, env, orca, workflowId: 'wf-shop-c4' });
  const later = gcWorktrees({ env, now: Date.now(), repos: [repo], jobStatusOf: phases({}), orca });
  assert.deepEqual(at(later, young.dir), [], 'an unknown owner is not judged gone before ownerGoneMs');
  assert.ok(fs.existsSync(dir) && fs.existsSync(young.dir));
});

/* ------------------------------------------------------------ Orca tree without a row */

test('an Orca tree with no row: runtime-owned is reclaimed, foreign is only listed for review and never touched, and nothing is judged when ps cannot be read', (t) => {
  const { repo, env, orca } = fixture(t);
  const critic = orca.create({ repo: `path:${posix(repo)}`, name: 'draw-critic-old', baseBranch: 'main', comment: runtimeStampOf({ kind: 'critic', slot: 'draw-critic-old', owner: {} }) }).worktree;
  const lane = orca.create({ repo: `path:${posix(repo)}`, name: 'lane/human', baseBranch: 'main' }).worktree;
  const noted = orca.create({ repo: `path:${posix(repo)}`, name: 'notes', baseBranch: 'main', comment: 'starci:lane:mine (a human note)' }).worktree;
  write(lane.path, 'src/human.ts', 'export const h = 1;\n');
  const down = gcWorktrees({ env, now: Date.now() + 9 * HOUR, repos: [repo], jobStatusOf: phases({}), orca: { ...orca, ps: () => ({ ok: false, worktrees: [], hostUnavailable: true }) } });
  assert.deepEqual(down.filter((i) => i.home === 'orca'), [], 'an unreadable ps proves nothing');
  const plan = gcWorktrees({ env, now: Date.now() + 9 * HOUR, apply: false, repos: [repo], jobStatusOf: phases({}), orca });
  assert.deepEqual(at(plan, critic.path).map((i) => i.action), ['would-remove']);
  assert.ok(fs.existsSync(critic.path), 'a plan changes nothing');
  const items = gcWorktrees({ env, now: Date.now() + 9 * HOUR, repos: [repo], jobStatusOf: phases({}), orca });
  assert.deepEqual(at(items, critic.path).map((i) => [i.reason, i.owner, i.ok]), [['orca-orphan', 'unknown', true]], JSON.stringify(items));
  assert.ok(!fs.existsSync(critic.path));
  for (const foreign of [lane, noted]) {
    assert.deepEqual(at(items, foreign.path).map((i) => [i.action, i.reason, i.ok]), [['review', 'unstamped-orphan', true]], `${foreign.path} is only listed for the owner's review`);
    assert.ok(fs.existsSync(foreign.path));
    assert.equal(rowsAt(env, foreign.path).length, 0, 'no row is ever made for a foreign tree');
  }
  assert.ok(!orca.calls.some(([verb, a]) => verb === 'remove' && [lane.id, noted.id].includes(String(a.worktree).replace(/^id:/, ''))));
  assert.equal(fs.readFileSync(path.join(lane.path, 'src', 'human.ts'), 'utf8'), 'export const h = 1;\n');
});

// 3.8: an unstamped orphan tree (no runtime stamp, no registry row, no live terminal, owner grace spent) is an owner-reviewed
// incident list, never auto-removed: ONE worktree.orphan-review incident per tree for good, a `review` item on every pass.
const reviews = (env) => withMachine((m) => m.db.prepare("SELECT level, msg, data_json FROM machine_logs WHERE kind='worktree.orphan-review' ORDER BY at, rowid").all(), { env });

test('an unstamped orphan tree becomes one owner-review incident and is never removed, however many passes run', (t) => {
  const { repo, env, orca } = fixture(t);
  const lane = orca.create({ repo: `path:${posix(repo)}`, name: 'lane/unstamped', baseBranch: 'main' }).worktree;
  const fresh = orca.create({ repo: `path:${posix(repo)}`, name: 'lane/fresh', baseBranch: 'main' }).worktree;
  write(lane.path, 'src/work.ts', 'export const w = 1;\n');
  const pass = (now, apply = true) => gcWorktrees({ env, now, apply, repos: [repo], jobStatusOf: phases({}), orca });
  // Within the owner grace nothing is an orphan yet (passing).
  assert.deepEqual(at(pass(Date.now()), lane.path), []);
  assert.deepEqual(reviews(env), []);
  // A plan logs nothing; the real pass logs one incident; a second pass lists it again and logs nothing more.
  assert.deepEqual(at(pass(Date.now() + 9 * HOUR, false), lane.path).map((i) => i.action), ['review']);
  assert.deepEqual(reviews(env), [], 'a plan writes no incident');
  for (let n = 0; n < 3; n += 1) assert.deepEqual(at(pass(Date.now() + (10 + n) * HOUR), lane.path).map((i) => [i.action, i.home]), [['review', 'orca']]);
  const rows = reviews(env).map((r) => ({ ...r, data: JSON.parse(r.data_json) }));
  assert.equal(rows.length, 2, 'one incident per tree, however many passes: the two idle unstamped trees');
  assert.deepEqual(new Set(rows.map((r) => path.resolve(r.data.path))), new Set([path.resolve(lane.path), path.resolve(fresh.path)]));
  assert.ok(rows.every((r) => r.level === 'warn' && /never removed/.test(r.msg)));
  // Never removed, never given a row, never touched.
  for (const tree of [lane, fresh]) { assert.ok(fs.existsSync(tree.path)); assert.equal(rowsAt(env, tree.path).length, 0); }
  assert.ok(!orca.calls.some(([verb]) => verb === 'remove'));
  assert.equal(fs.readFileSync(path.join(lane.path, 'src', 'work.ts'), 'utf8'), 'export const w = 1;\n');
});

test('a tree with a live terminal, and a stamped tree, are not on the review list (passing)', (t) => {
  const { repo, env, orca } = fixture(t);
  const busy = orca.create({ repo: `path:${posix(repo)}`, name: 'lane/busy', baseBranch: 'main' }).worktree;
  const stamped = orca.create({ repo: `path:${posix(repo)}`, name: 'draw-critic-x', baseBranch: 'main', comment: runtimeStampOf({ kind: 'critic', slot: 'draw-critic-x', owner: {} }) }).worktree;
  const live = { ...orca, ps: () => { const page = orca.ps(); return { ...page, worktrees: page.worktrees.map((w) => (w.id === busy.id ? { ...w, liveTerminalCount: 1 } : w)) }; } };
  const items = gcWorktrees({ env, now: Date.now() + 9 * HOUR, repos: [repo], jobStatusOf: phases({}), orca: live });
  assert.deepEqual(at(items, busy.path), [], 'an agent works in it');
  assert.deepEqual(at(items, stamped.path).map((i) => i.reason), ['orca-orphan'], 'a stamped tree follows the stamped rules, not the review list');
  assert.deepEqual(reviews(env).filter((r) => JSON.parse(r.data_json).path.includes('draw-critic-x')), []);
});

/* ------------------------------------------------------------ registry row without an Orca tree */

test('a registry row whose tree Orca no longer lists: reported, marked and left in place; a truncated page judges nothing', (t) => {
  const { repo, env, orca } = fixture(t);
  const rec = ensureWorkflowWorktree({ env, orca }, { workflowId: 'wf-shop-u1', appRepo: repo }).record;
  orca.forget(rec.orcaWorktreeId);
  const lookup = phases({ 'wf-shop-u1': 'finished' });
  const truncated = gcWorktrees({ env, repos: [repo], jobStatusOf: lookup, orca: { ...orca, ps: () => ({ ...orca.ps(), truncated: true }) } });
  assert.deepEqual(at(truncated, rec.path), [], 'an incomplete page proves nothing about a tree it does not list');
  const items = gcWorktrees({ env, repos: [repo], jobStatusOf: lookup, orca });
  assert.deepEqual(at(items, rec.path).map((i) => [i.reason, i.action, i.ok]), [['orca-tree-unlisted', 'keep', false]], JSON.stringify(items));
  assert.ok(fs.existsSync(rec.path), 'never removed by other means');
  assert.ok(!orca.calls.some(([verb]) => verb === 'remove'));
  const [row] = rowsAt(env, rec.path);
  assert.deepEqual([row.removed_at, row.remove_error], [null, 'orca-tree-unlisted']);
  assert.deepEqual(incidents(env).map((l) => l.level), ['error']);
  // Its directory gone too: the row is simply closed.
  fs.rmSync(rec.path, { recursive: true, force: true });
  git(repo, 'worktree', 'prune');
  const closed = gcWorktrees({ env, repos: [repo], jobStatusOf: lookup, orca });
  assert.deepEqual(at(closed, rec.path).map((i) => [i.reason, i.action]), [['directory-gone', 'unregister']]);
  assert.notEqual(rowsAt(env, rec.path)[0].removed_at, null);
});

test('a stamped [Worker] staging tree with no row: its Supervisor job settled -> preserved and removed; live -> adopted; unknown -> waits out the grace, then collected', (t) => {
  const { repo, env, orca } = fixture(t);
  const staged = (job) => {
    const made = orca.create({ repo: `path:${posix(repo)}`, name: `sup-${job}`, baseBranch: 'main', comment: runtimeStampOf({ kind: 'supervisor-staging', slot: `sup-${job}`, owner: { supJobId: job } }) });
    assert.ok(made.ok);
    return { tree: made.worktree, dir: path.resolve(made.worktree.path) };
  };
  const done = staged('fix-done-1'), live = staged('fix-live-2'), lost = staged('fix-lost-3');
  write(done.dir, 'src/wip.ts', 'export const wip = 1;\n');
  const sup = { 'fix-done-1': 'succeeded', 'fix-live-2': 'running' };
  const supStatusOf = (jobId) => sup[jobId] ?? null;
  const items = gcWorktrees({ env, now: Date.now(), repos: [repo], jobStatusOf: phases({}), supStatusOf, orca });
  // settled: the row created, the work preserved to preserved/orphan/<id>, removed through Orca, the row closed
  const [gone] = at(items, done.dir);
  assert.deepEqual([gone?.reason, gone?.action, gone?.owner, gone?.home, gone?.ok], ['orca-orphan', 'remove', 'ended', 'orca', true], JSON.stringify(items));
  assert.match(gone.preserved, /^refs\/heads\/preserved\/orphan\/sup-fix-done-1-[0-9a-f]{10}$/);
  assert.equal(git(repo, 'show', `${gone.preserved.replace('refs/heads/', '')}:src/wip.ts`), 'export const wip = 1;');
  assert.ok(!fs.existsSync(done.dir));
  assert.ok(orca.calls.some(([verb, a]) => verb === 'remove' && a.worktree === `id:${done.tree.id}`));
  assert.deepEqual(rowsAt(env, done.dir).map((r) => [r.kind, r.lane, r.orca_id, r.removed_at != null]), [['supervisor-staging', 'fix-done-1', done.tree.id, true]]);
  // live: adopted as a registered supervisor-staging row of its job, the tree untouched
  assert.deepEqual(at(items, live.dir).map((i) => [i.reason, i.action, i.owner, i.ok]), [['orca-orphan-adopted', 'adopt', 'live', true]]);
  assert.ok(fs.existsSync(live.dir));
  assert.deepEqual(rowsAt(env, live.dir).map((r) => [r.kind, r.lane, r.orca_id, r.removed_at]), [['supervisor-staging', 'fix-live-2', live.tree.id, null]]);
  // unknown job within ownerGoneMs: not judged
  assert.deepEqual(at(items, lost.dir), [], 'an unknown Supervisor job is not judged gone before ownerGoneMs');
  assert.ok(fs.existsSync(lost.dir));
  assert.equal(rowsAt(env, lost.dir).length, 0);
  // past the grace: collected as owner unknown, preserved first
  const later = gcWorktrees({ env, now: Date.now() + 9 * HOUR, repos: [repo], jobStatusOf: phases({}), supStatusOf, orca });
  assert.deepEqual(at(later, lost.dir).map((i) => [i.reason, i.owner, i.ok]), [['orca-orphan', 'unknown', true]], JSON.stringify(later));
  assert.ok(!fs.existsSync(lost.dir));
  assert.ok(fs.existsSync(live.dir), 'the adopted tree of a running job stays: its job still owns it');
  assert.equal(incidents(env).length, 3, 'one incident per adopted or removed tree');
});
