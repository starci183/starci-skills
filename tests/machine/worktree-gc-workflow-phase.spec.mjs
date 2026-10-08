// The worktree GC judges a workflow's tree by the workflow's phase in its ledger (ledger authority), through the real
// ledger lookup of scripts/machine/worktree-ledger-lookup.mjs - not by whether its Kernel seat or terminal looks alive.
// Shape of the 2026-10-08 loss: after a host restart Orca listed no terminal in the trees of two running workflows, and the
// lookup answered "no phase" for every workflow, so the GC collected both as owner-unknown.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { ensureWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { LEDGER_UNREADABLE } from '../../scripts/machine/worktree-ledger-lookup.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';
import { seedWorkflow, withLedger } from '../helpers/ledger-fixture.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const LATER = 4 * 3_600_000;

/** A workflow in `phase` in a real ledger, its worktree registered, and a fake Orca that lists no live terminal (a host restart). */
function world(t, fn, phase) {
  withLedger(t, ({ ledger, machine, track }) => {
    const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gcphase-')));
    t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
    const app = path.join(base, 'app');
    fs.mkdirSync(app);
    git(app, 'init', '-q', '-b', 'main');
    git(app, 'config', 'user.email', 'spec@starci.test');
    git(app, 'config', 'user.name', 'spec');
    fs.writeFileSync(path.join(app, 'a.txt'), 'a\n');
    git(app, 'add', '-A');
    git(app, 'commit', '-q', '-m', 'init');
    const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
    const workflowId = 'wf-running-one';
    seedWorkflow(ledger, { id: workflowId, state: { phase } });
    const made = ensureWorkflowWorktree({ env: process.env, orca }, { workflowId, appRepo: app, ledgerId: ledger.ledgerId });
    assert.ok(made.ok, JSON.stringify(made));
    track(ledger);
    return fn({ app, orca, machine, ledger, rec: made.record });
  });
}
const itemOf = (items, rec) => items.find((i) => i.path && path.resolve(i.path) === rec.path);

for (const phase of ['running', 'paused']) {
  test(`a ${phase} workflow's tree is never collected: the ledger phase guards it with no live terminal and an old row`, (t) => {
    world(t, ({ app, orca, rec }) => {
      const items = gcWorktrees({ env: process.env, repos: [app], orca, now: Date.now() + LATER });
      assert.equal(itemOf(items, rec), undefined, JSON.stringify(items));
      assert.ok(fs.existsSync(rec.path));
      assert.ok(!orca.names().includes('remove'));
    }, phase);
  });
}

test('a stopped workflow\'s tree is collected owner-settled by the same lookup', (t) => {
  world(t, ({ app, orca, rec }) => {
    const item = itemOf(gcWorktrees({ env: process.env, repos: [app], orca, now: Date.now() + LATER }), rec);
    assert.deepEqual([item?.reason, item?.ok], ['owner-settled', true], JSON.stringify(item));
    assert.ok(!fs.existsSync(rec.path));
  }, 'stopped');
});

test('a ledger that cannot be read is no proof of an absent owner: the tree stays', (t) => {
  world(t, ({ app, orca, machine, ledger, rec }) => {
    machine.db.prepare('UPDATE ledgers SET file=? WHERE ledger_id=?').run(path.join(path.dirname(ledger.path ?? app), 'gone', 'runtime.sqlite'), ledger.ledgerId);
    const items = gcWorktrees({ env: process.env, repos: [app], orca, now: Date.now() + LATER });
    assert.equal(itemOf(items, rec), undefined, JSON.stringify(items));
    assert.ok(fs.existsSync(rec.path));
    assert.equal(LEDGER_UNREADABLE, 'ledger-unreadable');
  }, 'running');
});

test('a workflow no registered ledger holds is still owner-unknown once old (the finding the lookup exists to make)', (t) => {
  world(t, ({ app, orca, machine, rec }) => {
    machine.db.prepare("UPDATE worktrees SET workflow_id='wf-never-seeded' WHERE workflow_id='wf-running-one'").run();
    const item = itemOf(gcWorktrees({ env: process.env, repos: [app], orca, now: Date.now() + LATER }), rec);
    assert.deepEqual([item?.reason, item?.ok], ['owner-unknown', true], JSON.stringify(item));
  }, 'running');
});
