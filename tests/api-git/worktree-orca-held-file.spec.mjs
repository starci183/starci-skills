// alpha.6 full run: the GC pass over an ended workflow's Orca tree failed once under load (tests/api-git/worktree-lifecycle.spec.mjs, the removal item came back
// ok:false after an 18 s pass). The git home of a removal retries a file another process holds open (safe-remove.mjs); the Orca home asked Orca once and recorded
// the refusal, so a transient hold on a file of the tree (an indexer, a scanner, a child process still exiting) turned a pass red. The Orca home now asks again,
// bounded by worktrees.removeRetries, when the refusal is Orca's untyped one that names a held file; a typed refusal and a persistent hold are not retried further.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { worktreeSettings } from '../../scripts/machine/worktree-registry.mjs';
import { ensureWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const HOUR = 3_600_000;
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wt-held-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'shop-fe');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'spec@starci.test');
  git(repo, 'config', 'user.name', 'spec');
  fs.writeFileSync(path.join(repo, 'a.ts'), 'export const a = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  return { base, repo, env: { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite'), STARCI_SLEEP_SCALE: '0' } };
}

/** The fake Orca whose first removals answer `refusals` (each {ok:false, ...}) before the real fake removes the tree; every ask is counted. */
function orcaRefusing(base, refusals) {
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const queue = [...refusals];
  const asks = [];
  const remove = (args) => {
    asks.push(args.worktree);
    const next = queue.shift();
    return next ?? orca.remove(args);
  };
  return Object.assign(Object.create(orca), { remove, asks, calls: orca.calls });
}

const endedPass = (t, refusals) => {
  const { base, repo, env } = fixture(t);
  const orca = orcaRefusing(base, refusals);
  const ended = ensureWorkflowWorktree({ env, orca: Object.assign(Object.create(orca), { remove: orca.remove }) }, { workflowId: 'wf-shop-fe-ended-1a', appRepo: repo }).record;
  fs.writeFileSync(path.join(ended.path, 'wip.ts'), 'export const wip = 1;\n');
  const lookup = Object.assign(() => null, { workflowPhase: () => 'finished' });
  const items = gcWorktrees({ env, now: Date.now() + 2 * HOUR, repos: [repo], jobStatusOf: lookup, ownerAlive: () => false, orca });
  return { item: items.find((i) => i.path && path.resolve(i.path) === path.resolve(ended.path)), orca, ended };
};

const HELD = { ok: false, outcome: 'failed', removed: false, error: 'error: failed to delete \'wip.ts\': Permission denied' };

test('a transient hold on a file of the tree does not turn the pass red: Orca is asked again and the tree goes', (t) => {
  const { item, orca, ended } = endedPass(t, [HELD, HELD]);
  assert.equal(item.ok, true, JSON.stringify(item));
  assert.equal(orca.asks.length, 3, 'two refusals for a held file, then the removal');
  assert.ok(!fs.existsSync(ended.path));
});

test('a hold that does not pass is asked removeRetries more times and then recorded as the refusal of the pass', (t) => {
  const { removeRetries } = worktreeSettings();
  const { item, orca } = endedPass(t, Array.from({ length: removeRetries + 2 }, () => HELD));
  assert.equal(item.ok, false);
  assert.equal(item.error, 'orca-worktree-rm-failed');
  assert.equal(orca.asks.length, 1 + removeRetries, 'bounded: the first ask and removeRetries more');
});

test('a typed Orca refusal is not a held file and is asked once', (t) => {
  const { item, orca } = endedPass(t, [{ ok: false, outcome: 'failed', removed: false, errorCode: 'worktree_has_live_terminals', error: 'the worktree still has a live terminal: Permission denied' }]);
  assert.equal(item.ok, false);
  assert.equal(orca.asks.length, 1);
});
