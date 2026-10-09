// Replay of a person's draft in the Kernel's input box (registry: draft-stuck-refusal-reaches-no-owner-item). Owner ruling 2026-10-09: a person typing in a seat always wins. The wake is refused
// (foreign-input), recorded once, and is not a missed wake: the seat is never replaced, rotated or cleared while the draft stands. After the seat's wake-repeat bound ONE Supervisor item
// says the seat cannot be woken; it closes when the draft is gone and the next wake is delivered.
// Real: the watchdog, the wake delivery with its draft probe, the ledger, the Workflow controller's planner and the mirror. Stubbed: the Orca binary (a terminal that holds a draft).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadFixture, replayWorld, ROOT } from '../helpers/replay-world.mjs';
import { draftEpisode, draftFactsOf } from '../../scripts/kernel/draft-hold.mjs';
import { planWorkflow } from '../../scripts/reconciler/workflow-plan.mjs';
import { workflowSettings } from '../../scripts/reconciler/controllers/workflow.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { seatCostConfig } from '../../scripts/kernel/seat-wakes.mjs';

const WATCHDOG = path.join(ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs');
const CHROME = ['─────', '❯', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const IDLE = ['● Waiting on the code.refactor report.', '✻ Brewed for 3m 2s', ...CHROME].join('\n');
const DRAFT = 'please look at the lint first, I am still typing';

function world(t, { draft }) {
  const w = replayWorld(t, loadFixture('leg-ready'), { tree: true, launch: true });
  const state = (extra) => fs.writeFileSync(w.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({ terminals: {
    'term-runtime-shell': { handle: 'term-runtime-shell', worktree: ROOT, title: 'shell' },
    'term-kernel-current': { handle: 'term-kernel-current', worktree: w.tree.dir, title: '[Kernel] wf-1', screen: IDLE, ...extra } } }));
  state(draft ? { draft } : {});
  assert.equal(w.ack([]).status, 0);
  return { w, state };
}
const watchdog = (w) => {
  const run = spawnSync(process.execPath, [WATCHDOG, '--repo', w.repo, '--workflow', w.wf, '--once', '--repair', '--json'],
    { cwd: ROOT, encoding: 'utf8', env: { ...w.env, ORCA_TERMINAL_HANDLE: 'term-kernel-current' }, timeout: 300_000 });
  assert.ok(run.stdout.trim(), `watchdog said nothing (exit ${run.status}): ${run.stderr.slice(0, 800)}`);
  return JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1));
};
const count = (w, kind) => w.ledger((ledger) => ledger.db.prepare('SELECT COUNT(*) AS n FROM events WHERE kind=?').get(kind).n);

test('a wake refused for a person\'s draft is recorded once, is not a missed wake, and the seat is neither replaced nor closed', (t) => {
  const { w } = world(t, { draft: DRAFT });
  const first = watchdog(w);
  assert.equal(first.delivery, 'foreign-input');
  assert.equal(first.ok, false);
  assert.equal(watchdog(w).delivery, 'foreign-input');
  assert.equal(watchdog(w).delivery, 'foreign-input');
  assert.equal(count(w, 'kernel-wake-draft-held'), 1, 'recorded once per episode, not once per refused wake');
  assert.equal(count(w, 'kernel-wake-failed'), 0, 'a draft is not a missed wake');
  assert.equal(count(w, 'kernel-rotated') + count(w, 'kernel-restarted') + count(w, 'kernel-replaced-idle'), 0, 'the seat is never replaced');
  assert.equal(w.orca().terminals['term-kernel-current'].closed, undefined, 'and never closed');
  assert.equal(w.orca().terminals['term-kernel-current'].draft, DRAFT, 'the person\'s words are still in the box');
  assert.deepEqual(w.orca().terminals['term-kernel-current'].keys ?? [], [], 'no probe, restore, Enter or wake keys are sent');
});

test('a person\'s draft also holds a rotation that was due: the contract change waits until the draft is gone', (t) => {
  const { w } = world(t, { draft: DRAFT });
  w.reviseRuntime({ 'modules/kernel/kernel-prompt.md': 'Kernel prompt, a rule reversed\n' }, 'a revision that reverses a rule of the Kernel contract');
  const answer = watchdog(w);
  assert.equal(answer.delivery, 'foreign-input', 'the wake is tried and refused; no replacement is started');
  assert.equal(count(w, 'kernel-rotated'), 0);
  assert.equal(w.orca().terminals['term-kernel-current'].closed, undefined);
  assert.deepEqual(w.orca().terminals['term-kernel-current'].keys ?? [], []);
});

test('a multiline draft holds a queued-input Enter without altering either row', (t) => {
  const draft = `${DRAFT}\nI have not finished the second row`;
  const { w, state } = world(t, { draft });
  assert.equal(watchdog(w).delivery, 'foreign-input');
  state({ draft, screen: ['Press Enter to send queued messages', ...CHROME].join('\n') });
  assert.equal(watchdog(w).delivery, 'foreign-input');
  assert.deepEqual(w.orca().terminals['term-kernel-current'].keys ?? [], []);
  assert.equal(w.orca().terminals['term-kernel-current'].draft, draft);
  assert.equal(w.orca().terminals['term-kernel-current'].closed, undefined);
  assert.equal(count(w, 'kernel-wake-draft-held'), 1);
});

test('the real Workflow controller opens one Supervisor item and closes both copies when the draft is gone', (t) => {
  const { w, state } = world(t, { draft: DRAFT });
  const boundMs = seatCostConfig().kernel.wakeRepeatMs;
  w.ledger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId: w.wf, entityType: 'kernel', entityId: w.wf,
    kind: 'kernel-wake-draft-held', createdAt: Date.now() - boundMs - 1000, payload: { terminal: 'term-kernel-current', delivery: 'foreign-input', draft: DRAFT } })));
  watchdog(w);
  const items = () => withMachine((m) => m.db.prepare("SELECT status FROM sup_decision_items WHERE kind='seat-draft-held'").all(), { env: w.env });
  w.engine({ controllers: ['workflow'], unbound: true });
  w.engine({ controllers: ['workflow'], unbound: true });
  assert.deepEqual(items().map((di) => di.status), ['open'], 'one Supervisor item through repeated real passes');
  state({});
  watchdog(w);
  w.engine({ controllers: ['workflow'], unbound: true });
  assert.deepEqual(items().map((di) => di.status), ['resolved'], 'its Supervisor twin closes automatically');
  assert.equal(w.ledger((ledger) => ledger.db.prepare("SELECT COUNT(*) AS n FROM decision_items WHERE kind='seat-draft-held' AND status IN ('open','claimed')").get().n), 0);
});

test('ONE Supervisor item opens after the seat\'s wake-repeat bound, not before; it does not repeat while open', (t) => {
  const { w } = world(t, { draft: DRAFT });
  watchdog(w);
  const facts = w.ledger((ledger) => draftFactsOf(ledger.db, w.wf));
  assert.equal(facts.boundMs, 300_000, 'the bound is kernel.wakeRepeatMs of seat-cost.yaml');
  const settings = workflowSettings();
  const plan = (now) => planWorkflow({ ledgerId: 'shop', workflowId: w.wf, draft: facts, now, settings }).decisions.filter((d) => d.kind === 'seat-draft-held');
  assert.deepEqual(plan(facts.episode.since + 299_000), []);
  const [item, ...rest] = plan(facts.episode.since + 301_000);
  assert.equal(rest.length, 0);
  assert.deepEqual([item.decider, item.escalateTo], ['supervisor', 'owner']);
  assert.match(item.summary, /a draft has stood in the Kernel's input of .* for 5 minutes; the seat cannot be woken/);
  assert.equal(plan(facts.episode.since + 400_000)[0].idempotencyKey, item.idempotencyKey, 'the same key while the episode stands: one item');
  const snoozed = planWorkflow({ ledgerId: 'shop', workflowId: w.wf, draft: { ...facts, answered: 1 }, now: facts.episode.since + 400_000, settings }).decisions;
  assert.deepEqual(snoozed.filter((d) => d.kind === 'seat-draft-held'), [], 'a wait answer snoozes it for another bound');
});

test('when the draft is gone the next wake is delivered, the episode ends and the item has nothing left to stand on', (t) => {
  const { w, state } = world(t, { draft: DRAFT });
  watchdog(w);
  assert.ok(w.ledger((ledger) => draftEpisode(ledger.db, w.wf)));
  state({});
  const answer = watchdog(w);
  assert.notEqual(answer.delivery, 'foreign-input');
  assert.equal(w.ledger((ledger) => draftEpisode(ledger.db, w.wf)), null, 'a delivered wake ends the episode');
});
