// Trees under a runtime-managed root that no workflow owns reach the Supervisor as ONE item per repository; the runtime removes nothing; the purge plan says the same words.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { untiedGroups, untiedDecision, untiedTreesDecision, staleItems } from '../../scripts/reconciler/untied-tree-item.mjs';
import { UNTIED, untiedTreeFacts, untiedTreeLine } from '../../scripts/machine/untied-tree.mjs';
import { listStrangerWorkers } from '../../scripts/machine/workflow-purge-orca.mjs';

const IDENT = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test' };
const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, ...IDENT } });
function tree(t, { dirty }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-untied-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(dir, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git(dir, 'add', '-A');
  git(dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'first');
  if (dirty) fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
  return dir;
}
const review = (repoRoot, p, branch = 'feature') => ({ path: p, repoRoot, reason: 'unstamped-orphan', action: 'review', home: 'git', branch, ok: true });

test('the facts of a tree are its path, branch, last commit time and dirty or clean', (t) => {
  const clean = untiedTreeFacts({ path: tree(t, { dirty: false }), branch: 'feature' });
  const dirty = untiedTreeFacts({ path: tree(t, { dirty: true }), branch: null });
  assert.deepEqual([clean.dirty, dirty.dirty], [false, true]);
  assert.ok(clean.lastCommitAt > 1_000_000_000_000);
  assert.match(untiedTreeLine(clean), /\(branch feature, last commit \d{4}-.*, clean\)$/);
  assert.match(untiedTreeLine(dirty), /branch none, .*, dirty\)$/);
});

test('one item per repository, keyed by the set of paths; other reasons are not listed', () => {
  const groups = untiedGroups([review('/r/one', '/r/one/a'), review('/r/one', '/r/one/b'), review('/r/two', '/r/two/c'), { ...review('/r/two', '/r/two/d'), reason: 'owner-settled' }, { path: 'x', reason: 'unstamped-orphan' }]);
  assert.deepEqual(groups.map((g) => [g.repo.replaceAll('\\', '/').split('/').pop(), g.trees.length]), [['one', 2], ['two', 1]]);
  assert.notEqual(groups[0].key, groups[1].key);
  const again = untiedGroups([review('/r/one', '/r/one/b'), review('/r/one', '/r/one/a')]);
  assert.equal(again[0].key, groups[0].key, 'the order of the pass does not change the key');
});

test('the item names K trees with their facts, goes to the Supervisor, and says the runtime removes nothing', (t) => {
  const a = tree(t, { dirty: true });
  const [group] = untiedGroups([review('/r/one', a)]);
  const di = untiedDecision(group, group.trees.map(untiedTreeFacts));
  assert.deepEqual([di.kind, di.decider, di.ledger], ['unregistered-trees', 'supervisor', 'supervisor']);
  assert.match(di.summary, /^1 unregistered tree\(s\) under .*one: .*\(branch feature, last commit .*, dirty\)/);
  assert.match(di.summary, /removes nothing it did not create/);
});

test('the pass opens the item through ctx.openDecision and removes nothing', async (t) => {
  const a = tree(t, { dirty: false });
  const opened = [];
  const n = await untiedTreesDecision({ mode: 'shadow', now: () => 1, openDecision: async (di) => opened.push(di) }, [review(path.dirname(a), a)]);
  assert.deepEqual([n, opened.length, fs.existsSync(a)], [1, 1, true]);
});

test('an item whose set changed or whose trees are gone is stale; the current one, the answered one and other kinds are not (violating: a stale item stood forever)', () => {
  const dis = [{ id: 'd1', kind: 'unregistered-trees', status: 'open', idempotencyKey: 'k-old' }, { id: 'd2', kind: 'unregistered-trees', status: 'open', idempotencyKey: 'k-now' },
    { id: 'd3', kind: 'unregistered-trees', status: 'resolved', idempotencyKey: 'k-older' }, { id: 'd4', kind: 'runtime-defect', status: 'open', idempotencyKey: 'k-x' }];
  assert.deepEqual(staleItems(dis, new Set(['k-now'])).map((d) => d.id), ['d1']);
  assert.deepEqual(staleItems(dis, new Set()).map((d) => d.id), ['d1', 'd2'], 'no trees left: every live item closes');
});

test('the purge plan lists a thing it cannot tie to a workflow with the same phrase (passing)', () => {
  assert.equal(UNTIED, 'the runtime cannot tie it to a workflow');
  const [listed] = listStrangerWorkers({ rows: [{ dispatchId: 'd1', runId: 'run-9', terminalState: 'ready', worktreePath: '/t/wf', terminalHandle: 'h' }], treePaths: ['/t/wf'] });
  if (listed) assert.ok(listed.why.startsWith(UNTIED), listed.why);
});
