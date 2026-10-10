// `starci workflow purge`: what an archived workflow leaves on the host is planned (the default, nothing changes) and then removed through the house mechanics
// only. Real: git (repository, worktrees, branches, refs), the worktree registry, the ledger, the verb. Faked: Orca (tests/helpers/fake-orca-worktrees.mjs for the
// worktree home, the world's reads for terminals and workers, recording seams for worker-close and terminal close).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { workflowPurge } from '../../scripts/kernel/workflow-purge.mjs';
import { purgeFactsOf } from '../../scripts/machine/workflow-purge-facts.mjs';
import { guardsRoot } from '../../scripts/guards/guards-root.mjs';
import { starciLocalRoot } from '../../engine/runtime-root.mjs';
import { blobPath } from '../../engine/db/blob.mjs';
import { purgedWorkflowIds } from '../../scripts/machine/workflow-purged.mjs';
import { machineFacts } from '../../scripts/reconciler/debug-digest-machine.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { ARCHIVED, OTHER, archive, git, purgeWorld, terminalRow, workerRow } from '../helpers/workflow-purge-world.mjs';

const refsOf = (app) => git(app, 'for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads').split(/\r?\n/).sort();
const hasRef = (app, name) => refsOf(app).some((line) => line.startsWith(`${name} `));
const eventsOf = (machine) => machine.db.prepare("SELECT payload_json FROM sup_events WHERE kind='workflow-purged' ORDER BY seq").all().map((row) => JSON.parse(row.payload_json));

/** The verb as the CLI runs it: ctx.args from the flags, the world's seams as deps. */
function run(world, args, extra = {}) {
  const { closed } = world;
  const deps = {
    orca: world.reads, orcaTree: world.orca, lockOwner: () => null,
    closeTerminal: (handle) => { closed.terminals.push(handle); world.terminals = world.terminals.filter((t) => t.handle !== handle); return { ok: true, proof: 'gone' }; },
    closeWorker: ({ dispatch, handle }) => { closed.workers.push(dispatch); world.workers = world.workers.filter((w) => w.dispatchId !== dispatch); world.terminals = world.terminals.filter((t) => t.handle !== handle); return { ok: true, processes: { verdict: 'none' } }; },
    ...extra,
  };
  return workflowPurge({ args: { repo: world.repoRoot, workflow: ARCHIVED, ...args }, env: process.env, cwd: world.repoRoot }, deps);
}

/** Terminals and workers the live shape leaves: two dead Codex terminals of failed Kernel launches in the second tree, a worker whose release Orca could not confirm, and strangers. */
function leftovers(world, { unknownInTree = false } = {}) {
  const tree = world.trees.second.path;
  const strangerHome = unknownInTree ? tree : path.join(world.base, 'elsewhere');
  world.terminals = [terminalRow('term-dead-1', tree), terminalRow('term-dead-2', tree), terminalRow('term-owner-shell', strangerHome, { agentIdentity: null }),
    terminalRow('term-elsewhere', path.join(world.base, 'elsewhere')), terminalRow('term-other-wf', world.trees.other.path)];
  world.workers = [workerRow('dsp-op', 'run-old', 'term-op-old', 'release_unknown'), workerRow('dsp-launch-1', 'run-launch', 'term-dead-1', 'reclaimable'), workerRow('dsp-stranger', 'run-stranger', 'term-x', 'release_unknown'), workerRow('dsp-in-tree', 'run-x', 'term-y', 'retained', 'live', strangerHome)];
}

const snapshot = (world) => ({ refs: refsOf(world.app), effects: world.orca.names().filter((name) => name === 'create' || name === 'remove'), disk: fs.readdirSync(world.orca.root).sort(), registry: world.machine.db.prepare('SELECT path, removed_at FROM worktrees ORDER BY path').all(),
  events: world.machine.db.prepare('SELECT count(*) n FROM sup_events').get().n, closed: structuredClone(world.closed) });

const contextWorker = (runId = 'run-history') => ({ dispatchId: 'dsp-context', runId, workerState: 'unsupervised', terminalState: 'retained', agentTerminalHandle: 'term-context', resource: null,
  projection: { resource: { state: 'absent', reason: 'unsupervised' }, workspace: null, liveness: { verdict: 'unverifiable', reason: 'unsupervised_settled' }, nextAction: { kind: 'none', argv: [] } } });

test('positive context-only resource absence is not a worker holder or a close target, while liveness stays unverifiable', t => purgeWorld(t, async world => {
  for (const runId of ['run-history', 'run-old']) {
    const historical = contextWorker(runId);
    world.workers = [historical];
    const before = snapshot(world);
    const planned = await run(world, { plan: true });
    assert.equal(planned.code, 0, planned.text);
    assert.deepEqual(planned.data.workers, []);
    assert.deepEqual(planned.data.blockers, []);
    assert.equal(historical.projection.liveness.verdict, 'unverifiable');
    assert.deepEqual(snapshot(world), before);
  }
}));

test('resource absence never hides a foreign terminal in the workflow tree', t => purgeWorld(t, async world => {
  world.workers = [contextWorker()];
  world.terminals = [terminalRow('term-context', world.trees.second.path)];
  const before = snapshot(world);
  const refused = await run(world, { apply: true, ledger: true });
  assert.equal(refused.code, 1);
  assert.ok(refused.data.blockers.some(item => item.code === 'workflow-purge-custody-unknown'));
  assert.deepEqual(refused.data.listed.map(item => item.id), ['term-context']);
  assert.deepEqual(snapshot(world), before);
}));

test('missing or contradictory resource absence keeps unplaced custody held', t => purgeWorld(t, async world => {
  for (const damage of ['missing-resource', 'resource-present', 'unknown-projection', 'workspace', 'next-action', 'worker-state']) {
    const historical = contextWorker();
    if (damage === 'missing-resource') delete historical.resource;
    if (damage === 'resource-present') historical.resource = { terminalHandle: 'term-context' };
    if (damage === 'unknown-projection') historical.projection.resource.state = 'unknown';
    if (damage === 'workspace') historical.projection.workspace = { id: 'repo::' + world.trees.second.path };
    if (damage === 'next-action') historical.projection.nextAction = { kind: 'release', argv: [] };
    if (damage === 'worker-state') historical.workerState = 'abandoned';
    world.workers = [historical];
    const before = snapshot(world);
    const refused = await run(world, { apply: true, ledger: true });
    assert.equal(refused.code, 1, damage);
    assert.ok(refused.data.blockers.some(item => item.code === 'workflow-purge-custody-unknown'), damage);
    assert.deepEqual(snapshot(world), before, damage);
  }
}));

test('bound, missing and contradictory worker scopes cannot authorize purge', t => purgeWorld(t, async world => {
  for (const scope of [null, { source: 'bound', run: 'run-old' }, { source: 'flag', run: 'run-old' }, { source: 'all', run: 'run-old' }]) {
    const before = snapshot(world);
    const orca = { ...world.reads, workers: runId => runId == null ? { ok: true, workers: [], scope } : world.reads.workers(runId) };
    const refused = await run(world, { apply: true, ledger: true }, { orca });
    assert.equal(refused.code, 1, JSON.stringify(scope));
    assert.ok(refused.data.blockers.some(item => item.code === 'workflow-purge-orca-unreadable'));
    assert.deepEqual(snapshot(world), before);
  }
  const orca = { ...world.reads, workers: runId => runId == null ? world.reads.workers(runId) : { ok: true, workers: [], scope: { source: 'flag', run: 'wrong-run' } } };
  const refused = await run(world, { apply: true }, { orca });
  assert.equal(refused.code, 1);
  assert.ok(refused.data.blockers.some(item => item.code === 'workflow-purge-orca-unreadable'));
}));

test('the plan is the default and changes nothing: it prints custody blockers, trees, refs, proved leftovers and unknown holders', (t) => {
  return purgeWorld(t, async (world) => {
    leftovers(world, { unknownInTree: true });
    const before = snapshot(world);
    const out = await run(world, {});
    assert.equal(out.code, 1, out.text);
    assert.deepEqual(snapshot(world), before, 'a plan changes nothing');
    const plan = out.data;
    assert.deepEqual(plan.blockers.map((blocker) => blocker.code), ['workflow-purge-custody-unknown']);
    assert.deepEqual(plan.trees.map((tree) => path.basename(tree.path)), [path.basename(world.trees.second.path)]);
    const deleted = plan.refs.filter((ref) => ref.action === 'delete').map((ref) => ref.name).sort();
    assert.deepEqual(deleted, [world.trees.first.branch, world.trees.second.branch, `preserved/${ARCHIVED}/gc`, `preserved/${ARCHIVED}/wrong-tree`, 'preserved/op-architecture.decide-8da14f299d'].sort());
    for (const ref of plan.refs) assert.match(ref.tip, /^[0-9a-f]{40}$/);
    assert.equal(plan.refs.find((ref) => ref.name === `ghost/wf-${ARCHIVED}`).action, 'keep');
    assert.deepEqual(plan.workers.map((w) => w.dispatchId).sort(), ['dsp-launch-1', 'dsp-op']);
    assert.deepEqual(plan.terminals.map((c) => c.handle), ['term-dead-2'], 'term-dead-1 closes with its worker');
    assert.deepEqual(plan.listed.map((l) => l.id).sort(), ['dsp-in-tree', 'term-owner-shell'], 'a terminal and a worker in the tree that the ledger does not name are listed');
    assert.match(out.text, /refs to delete/);
    assert.doesNotMatch(out.text, /apply: starci workflow purge/, 'a refused plan cannot advertise an apply command');
    assert.equal((await run(world, {})).data.sha, plan.sha, 'the same world gives the same plan sha');
  });
});

for (const [name, code, setup] of [
  ['an unknown workflow', 'workflow-purge-unknown', { workflow: 'wf-missing' }],
  ['a running workflow', 'workflow-purge-not-archived', { workflow: OTHER }],
]) {
  test(`${name} is refused ${code}`, (t) => {
    purgeWorld(t, async (world) => {
      const before = snapshot(world);
      const out = await run(world, { ...setup, apply: true });
      assert.equal(out.code, 1);
      assert.equal(out.data.blockers?.[0]?.code ?? out.data.refusal.code, code);
      assert.deepEqual(snapshot(world), before);
    });
  });
}

test('a job, a seat, a worker, an unreadable Orca and a held host lock each refuse the purge by their code', (t) => {
  return purgeWorld(t, async (world) => {
    const codeOf = async (extra, args = {}) => (await run(world, { apply: true, ...args }, extra)).data.blockers?.map((b) => b.code) ?? [];
    world.machine.db.prepare("INSERT INTO seats(seat_id, role, workflow_id, state) VALUES('kernel:x:wf-old-one','kernel',?,'live')").run(ARCHIVED);
    assert.deepEqual(await codeOf({}), ['workflow-purge-live-seat']);
    world.machine.db.prepare('DELETE FROM seats').run();
    world.workers = [workerRow('dsp-op', 'run-old', 'term-op-old', 'active', 'live')];
    assert.deepEqual(await codeOf({}), ['workflow-purge-worker-live']);
    world.workers = [];
    assert.deepEqual(await codeOf({ orca: { ...world.reads, ps: () => ({ ok: false, worktrees: [], error: 'orca runtime not reachable' }) } }), ['workflow-purge-orca-unreadable']);
    assert.deepEqual(await codeOf({ lockOwner: () => ({ role: 'release', purpose: 'release-cut', pid: 1, stale: false }) }), ['workflow-purge-host-busy']);
    assert.ok(fs.existsSync(world.trees.second.path), 'nothing was removed by any refusal');
  });
});

test('a job that is still live refuses the purge (a stopped phase does not prove the jobs ended)', (t) => {
  return purgeWorld(t, async (world) => {
    seedWorkflow(world.ledger, { id: 'wf-live-job', state: { phase: 'running' }, jobs: [{ jobId: 'op-live-1', opId: 'architecture.decide', status: 'running', payload: { opId: 'architecture.decide' } }] });
    archive(world.ledger, 'wf-live-job');
    const out = await run(world, { workflow: 'wf-live-job' });
    assert.deepEqual(out.data.blockers.map((b) => b.code), ['workflow-purge-live-job']);
    assert.equal(out.code, 1);
  });
});

test('apply removes exactly the planned set: the second workflow, the foreign branch, the product main and the strangers survive', (t) => {
  return purgeWorld(t, async (world) => {
    leftovers(world);
    const shown = await run(world, {});
    assert.match(shown.text, /apply: starci workflow purge/, 'a safe plan names the authorized apply');
    const planned = shown.data;
    const mainBefore = world.refs.main, otherTip = world.refs.tipOf(world.trees.other.branch), otherGc = world.refs.tipOf(`preserved/${OTHER}/gc`);
    const out = await run(world, { apply: true, expect: planned.sha.slice(0, 12) });
    assert.equal(out.code, 0, out.text);
    assert.equal(out.data.ok, true);
    // gone: the workflow's tree, its branches and its preserved refs, its leftovers
    assert.equal(fs.existsSync(world.trees.second.path), false);
    for (const name of [world.trees.first.branch, world.trees.second.branch, `preserved/${ARCHIVED}/gc`, `preserved/${ARCHIVED}/wrong-tree`, 'preserved/op-architecture.decide-8da14f299d']) assert.equal(hasRef(world.app, name), false, name);
    assert.deepEqual(world.closed.terminals, ['term-dead-2']);
    assert.deepEqual(world.closed.workers.sort(), ['dsp-launch-1', 'dsp-op']);
    // kept: main, the foreign branch, the other workflow's tree and refs, the terminals that are not the workflow's
    assert.equal(world.refs.tipOf('main'), mainBefore);
    assert.equal(world.refs.tipOf(`ghost/wf-${ARCHIVED}`), world.refs.ghost);
    assert.equal(world.refs.tipOf(world.trees.other.branch), otherTip);
    assert.equal(world.refs.tipOf(`preserved/${OTHER}/gc`), otherGc);
    assert.equal(fs.existsSync(world.trees.other.path), true);
    assert.deepEqual(world.terminals.map((c) => c.handle).sort(), ['term-elsewhere', 'term-other-wf', 'term-owner-shell']);
    assert.deepEqual(world.workers.map((w) => w.dispatchId).sort(), ['dsp-in-tree', 'dsp-stranger'], 'the workers the ledger does not name are never released');
    // the registry: the workflow's rows are closed, the other workflow's row stands live
    const live = world.machine.db.prepare('SELECT workflow_id FROM worktrees WHERE removed_at IS NULL').all().map((row) => row.workflow_id);
    assert.deepEqual(live, [OTHER]);
    // the journal: one event with the counts, the plan sha and every deleted ref with its tip
    const [event, ...rest] = eventsOf(world.machine);
    assert.equal(rest.length, 0);
    assert.equal(event.planSha, planned.sha);
    assert.equal(event.resumed, false);
    assert.equal(event.counts.refsDeleted, 5);
    assert.ok(event.refs.every((ref) => /^[0-9a-f]{40}$/.test(ref.tip)));
    assert.ok(purgedWorkflowIds(world.machine).has(ARCHIVED));
    assert.equal(world.machine.db.prepare("SELECT count(*) n FROM machine_meta WHERE key LIKE 'workflow-purge:%'").get().n, 0);
  });
});

test('a deleted ref is recoverable by the sha the plan and the event printed', (t) => {
  return purgeWorld(t, async (world) => {
    const tip = world.refs.tipOf(`preserved/${ARCHIVED}/gc`);
    await run(world, { apply: true });
    assert.equal(hasRef(world.app, `preserved/${ARCHIVED}/gc`), false);
    git(world.app, 'branch', 'recovered', tip);
    assert.equal(world.refs.tipOf('recovered'), tip);
  });
});

test('a second apply is a no-op: nothing is removed and no second event is written', (t) => {
  return purgeWorld(t, async (world) => {
    await run(world, { apply: true });
    const after = snapshot(world);
    const again = await run(world, { apply: true });
    assert.equal(again.code, 0, again.text);
    assert.match(again.text, /already purged/);
    assert.deepEqual(snapshot(world), after);
    assert.equal(eventsOf(world.machine).length, 1);
  });
});

test('a crash in the middle resumes: the failed step leaves the plan stored and no event; the next apply finishes and journals the whole run', (t) => {
  return purgeWorld(t, async (world) => {
    leftovers(world);
    const first = await run(world, { apply: true }, { closeTerminal: () => ({ ok: false, reason: 'terminal_close_refused' }) });
    assert.equal(first.code, 1);
    assert.match(first.text, /INCOMPLETE/);
    assert.equal(eventsOf(world.machine).length, 0);
    assert.equal(world.machine.db.prepare("SELECT count(*) n FROM machine_meta WHERE key LIKE 'workflow-purge:%'").get().n, 1, 'the plan of the unfinished purge is stored');
    const second = await run(world, { apply: true });
    assert.equal(second.code, 0, second.text);
    assert.equal(second.data.resumed, true);
    const [event] = eventsOf(world.machine);
    assert.equal(event.resumed, true);
    assert.equal(event.counts.refsDeleted, 5, 'the event counts the whole run, not the resumed remainder');
    assert.equal(fs.existsSync(world.trees.second.path), false);
  });
});

test('a ref that moved after the plan is left, and the purge reports it instead of deleting work', (t) => {
  return purgeWorld(t, async (world) => {
    const planned = (await run(world, {})).data;
    git(world.app, 'branch', '-f', `preserved/${ARCHIVED}/gc`, world.refs.ghost);
    const out = await run(world, { apply: true, expect: planned.sha.slice(0, 12) });
    assert.equal(out.code, 1);
    assert.equal(out.data.refusal.code, 'workflow-purge-plan-changed');
    assert.equal(world.refs.tipOf(`preserved/${ARCHIVED}/gc`), world.refs.ghost);
    assert.equal(fs.existsSync(world.trees.second.path), true, 'a changed plan removes nothing');
  });
});

test('the held-file refusal of Orca is retried by the Orca home, and a tree Orca refuses for good is reported and keeps the journal closed', (t) => {
  return purgeWorld(t, async (world) => {
    world.orca.refuseRm(true);
    const out = await run(world, { apply: true });
    assert.equal(out.code, 1, out.text);
    assert.match(out.text, /FAILED/);
    assert.equal(fs.existsSync(world.trees.second.path), true);
    assert.equal(eventsOf(world.machine).length, 0);
    world.orca.refuseRm(false);
    const done = await run(world, { apply: true });
    assert.equal(done.code, 0, done.text);
    assert.equal(fs.existsSync(world.trees.second.path), false);
  });
});

test('job guards and dispatch prompts that name the workflow go with it; those of another workflow stay', (t) => {
  return purgeWorld(t, async (world) => {
    const { guardsRoot } = await import('../../scripts/guards/guards-root.mjs');
    const { starciLocalRoot } = await import('../../engine/runtime-root.mjs');
    const guards = path.join(guardsRoot(), 'jobs'), prompts = path.join(starciLocalRoot(), 'dispatch-prompts');
    fs.mkdirSync(guards, { recursive: true });
    fs.mkdirSync(prompts, { recursive: true });
    const files = { own: path.join(guards, 'op-own.json'), foreign: path.join(guards, 'op-foreign.json'), ownPrompt: path.join(prompts, 'a.md'), foreignPrompt: path.join(prompts, 'b.md') };
    fs.writeFileSync(files.own, JSON.stringify({ jobId: 'op-own', workflowId: ARCHIVED }));
    fs.writeFileSync(files.foreign, JSON.stringify({ jobId: 'op-foreign', workflowId: OTHER }));
    fs.writeFileSync(files.ownPrompt, `kernel prompt for ${ARCHIVED}\n`);
    fs.writeFileSync(files.foreignPrompt, `kernel prompt for ${OTHER}\n`);
    const out = await run(world, { apply: true });
    assert.equal(out.code, 0, out.text);
    assert.deepEqual([files.own, files.ownPrompt].map((f) => fs.existsSync(f)), [false, false]);
    assert.deepEqual([files.foreign, files.foreignPrompt].map((f) => fs.existsSync(f)), [true, true]);
  });
});

test('--ledger archives the workflow rows to a verified zip and drops them; without it the rows stay; a re-run after the drop is already purged', (t) => {
  return purgeWorld(t, async (world) => {
    const archiveRoot = path.join(world.base, 'archive');
    const saved = process.env.STARCI_ARCHIVE_ROOT;
    process.env.STARCI_ARCHIVE_ROOT = archiveRoot;
    t.after(() => { if (saved === undefined) delete process.env.STARCI_ARCHIVE_ROOT; else process.env.STARCI_ARCHIVE_ROOT = saved; });
    const kept = await run(world, { apply: true });
    assert.equal(kept.code, 0, kept.text);
    assert.equal(world.ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get(ARCHIVED).n, 1, 'the ledger rows are kept by default');
    const dropped = await run(world, { apply: true, ledger: true });
    assert.equal(dropped.code, 0, dropped.text);
    assert.equal(dropped.data.results.ledger.ok, true, JSON.stringify(dropped.data.results.ledger));
    assert.ok(fs.existsSync(dropped.data.results.ledger.archive), 'the verified zip exists');
    assert.equal(world.ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get(ARCHIVED).n, 0);
    const again = await run(world, { apply: true, ledger: true });
    assert.equal(again.code, 0, again.text);
    assert.match(again.text, /already purged/);
  });
});

test('the digest stops counting a purged workflow: its open Decision Items are resolved and its reservations are not read', (t) => {
  return purgeWorld(t, async (world) => {
    world.machine.openSupDecision({ keyParts: { kind: 'kernel-start-custody', entity: 'abc', signature: 'def' }, kind: 'runtime-defect', decider: 'supervisor', openedBy: 'kernel-start',
      ledgerId: world.ledger.ledgerId, workflowId: ARCHIVED, entityType: 'kernel', entityId: ARCHIVED, summary: 'A retired workflow has an unresolved Kernel launch.', evidence: {}, payload: {} });
    const digestOf = () => machineFacts({ env: process.env }).supervisor.decisions.filter((d) => d.workflowId === ARCHIVED);
    assert.equal(digestOf().length, 1);
    const out = await run(world, { apply: true });
    assert.equal(out.code, 0, out.text);
    assert.equal(out.data.results.decisions.length, 1);
    assert.equal(digestOf().length, 0);
  });
});

test('archive then purge: a workflow stopped after the fact is the same shape (archive helper)', (t) => {
  return purgeWorld(t, async (world) => {
    const out = await run(world, { workflow: OTHER });
    assert.equal(out.data.blockers[0].code, 'workflow-purge-not-archived');
    archive(world.ledger, OTHER);
    const planned = await run(world, { workflow: OTHER });
    assert.deepEqual(planned.data.blockers, []);
    assert.deepEqual(planned.data.trees.map((tree) => path.basename(tree.path)), [path.basename(world.trees.other.path)]);
  }, { archiveIt: true });
});

test('a Kernel launch that failed after the stop is journalled in the machine store, and its Run and terminal tie to the workflow from there', (t) => {
  return purgeWorld(t, async (world) => {
    world.machine.supEvent({ entityType: 'kernel', entityId: ARCHIVED, kind: 'kernel-start-failed',
      payload: { ledgerId: world.ledger.ledgerId, workflowId: ARCHIVED, step: 'turn-start', terminal: 'term-late-1', dispatch: 'dsp-late', runId: 'run-late', effectState: 'unknown' } });
    world.terminals = [terminalRow('term-late-1', world.trees.second.path), terminalRow('term-late-2', world.trees.second.path)];
    world.workers = [workerRow('dsp-late', 'run-late', 'term-late-1', 'release_unknown')];
    const plan = (await run(world, {})).data;
    assert.deepEqual(plan.workers.map((w) => w.dispatchId), ['dsp-late']);
    assert.deepEqual(plan.listed.map((l) => l.id), ['term-late-2'], 'the terminal no event names is listed, not closed');
    const refused = await run(world, { apply: true, ledger: true });
    assert.equal(refused.code, 1);
    assert.ok(refused.data.blockers.some((blocker) => blocker.code === 'workflow-purge-custody-unknown'));
    assert.deepEqual(world.closed, { terminals: [], workers: [] });
    assert.equal(fs.existsSync(world.trees.second.path), true);
    world.terminals[1].worktreePath = path.join(world.base, 'elsewhere');
    const out = await run(world, { apply: true });
    assert.equal(out.code, 0, out.text);
    assert.deepEqual(world.closed.workers, ['dsp-late']);
    assert.deepEqual(world.terminals.map((c) => c.handle), ['term-late-2']);
  });
});

for (const read of ['global-workers', 'truncated-trees', 'omitted-host']) test(`${read} cannot authorize a purge from incomplete custody reads`, (t) => purgeWorld(t, async (world) => {
  const before = snapshot(world);
  const orca = { ...world.reads };
  if (read === 'global-workers') orca.workers = (runId) => runId == null ? { ok: false, error: 'private fixture no census' } : world.reads.workers(runId);
  else orca.ps = () => ({ ...world.reads.ps(), ...(read === 'truncated-trees' ? { truncated: true } : { omittedHostIds: ['remote'] }) });
  const out = await run(world, { apply: true, ledger: true }, { orca });
  assert.equal(out.code, 1);
  assert.ok(out.data.blockers.some((blocker) => blocker.code === 'workflow-purge-orca-unreadable'));
  assert.deepEqual(snapshot(world), before, 'no effect from a partial census');
}));

for (const state of [null, 'unknown', 'active']) test(`unknown live worker custody (${state}) without a location holds workflow removal`, (t) => purgeWorld(t, async (world) => {
  world.workers = [workerRow('dsp-unplaced', 'run-unproved', 'term-unplaced', state, 'unknown')];
  const before = snapshot(world);
  const out = await run(world, { apply: true });
  assert.equal(out.code, 1);
  assert.ok(out.data.blockers.some((blocker) => blocker.code === 'workflow-purge-custody-unknown'));
  assert.deepEqual(snapshot(world), before);
}));

test('the full spilled event outranks clipped Run and terminal scalars in the inline summary', (t) => purgeWorld(t, async (world) => {
  const runId = `run-${'r'.repeat(230)}`, handle = `term-${'t'.repeat(230)}`;
  const row = world.ledger.appendEvent({ workflowId: ARCHIVED, entityType: 'kernel', entityId: ARCHIVED, kind: 'kernel-start-failed',
    payload: { runId, terminal: handle, detail: 'private fixture'.repeat(2000) } });
  assert.ok(row.payload_sha);
  assert.notEqual(JSON.parse(row.payload_json).runId, runId, 'the real event writer clips the scalar summary');
  archive(world.ledger, ARCHIVED);
  world.workers = [workerRow('dsp-unclipped', runId, 'term-worker', 'release_unknown')];
  world.terminals = [terminalRow(handle, world.trees.second.path)];
  const planned = await run(world, {});
  assert.equal(planned.code, 0, planned.text);
  assert.deepEqual(planned.data.workers.map((worker) => worker.runId), [runId]);
  assert.deepEqual(planned.data.terminals.map((terminal) => terminal.handle), [handle]);
}, { archiveIt: false }));

for (const damage of ['missing', 'corrupt']) test(`${damage} event custody evidence refuses without any host effect`, (t) => purgeWorld(t, async (world) => {
  const blob = world.ledger.write.storeBlob({ content: Buffer.from(JSON.stringify({ terminal: 'term-private', runId: 'run-private' })), mediaType: 'application/json' });
  world.ledger.appendEvent({ workflowId: ARCHIVED, entityType: 'kernel', entityId: ARCHIVED, kind: 'kernel-start-failed', payloadSha: blob.sha256 });
  archive(world.ledger, ARCHIVED);
  const file = blobPath(blob.sha256);
  const bytes = fs.readFileSync(file);
  if (damage === 'missing') fs.rmSync(file); else fs.writeFileSync(file, Buffer.alloc(bytes.length));
  const before = snapshot(world);
  try { await assert.rejects(() => run(world, { apply: true, ledger: true }), /blob (not found|hash mismatch)/); }
  finally { fs.writeFileSync(file, bytes); }
  assert.deepEqual(snapshot(world), before);
}, { archiveIt: false }));

test('spilled machine custody reads the caller artifact root through the storage owner', (t) => purgeWorld(t, (world) => {
  world.machine.supEvent({ entityType: 'kernel', entityId: ARCHIVED, kind: 'kernel-start-failed',
    payload: { terminal: 'term-root-scoped', runId: 'run-root-scoped', detail: 'private root fixture'.repeat(2000) } });
  const sha = world.machine.db.prepare("SELECT payload_sha FROM sup_events WHERE kind='kernel-start-failed' ORDER BY seq DESC LIMIT 1").get().payload_sha;
  const original = blobPath(sha), bytes = fs.readFileSync(original), root = path.join(world.root, 'read-blobs');
  const scoped = path.join(root, sha.slice(0, 2), sha);
  fs.mkdirSync(path.dirname(scoped), { recursive: true });
  fs.writeFileSync(scoped, bytes);
  fs.copyFileSync(`${original}.json`, `${scoped}.json`);
  fs.rmSync(original);
  try {
    const facts = purgeFactsOf({ repo: world.repoRoot, workflowId: ARCHIVED, guardsDir: path.join(world.root, 'guards'),
      env: { ...process.env, STARCI_ARTIFACT_ROOT: root }, deps: { orca: world.reads, lockOwner: () => null } });
    assert.ok(facts.evidence.runIds.includes('run-root-scoped'));
    assert.ok(facts.evidence.handles.includes('term-root-scoped'));
  } finally { fs.writeFileSync(original, bytes); }
}));


function citationArtifact(world, workflowId = ARCHIVED) {
  const blob = world.ledger.write.storeBlob({ content: Buffer.from('private FK fixture evidence'), mediaType: 'text/plain' });
  return world.ledger.write.recordArtifact({ workflowId, name: 'fixture-FK-evidence', sha256: blob.sha256, role: 'other', kind: 'file', origin: 'kernel' });
}

function citeArtifact(world, artifact) {
  world.ledger.write.citeBlob({ recordId: 'fixture.kept', recordPath: 'owned/index.yaml', field: 'asset', artifactId: artifact.artifact_id, sha256: artifact.sha256 });
}

function dependencyEffects(world) {
  return { host: snapshot(world), terminals: structuredClone(world.terminals), workers: structuredClone(world.workers),
    decisions: world.machine.db.prepare('SELECT * FROM sup_decision_items ORDER BY di_id').all(),
    progress: world.machine.db.prepare("SELECT * FROM machine_meta WHERE key LIKE 'workflow-purge:%' ORDER BY key").all(),
    purges: world.ledger.db.prepare('SELECT * FROM workflow_purges ORDER BY workflow_id').all(),
    archive: fs.existsSync(world.fkArchive),
    files: world.fkFiles.map(file => ({ file, bytes: fs.existsSync(file) ? fs.readFileSync(file).toString('base64') : null })) };
}

function dependencyLeftovers(t, world) {
  leftovers(world);
  const previousArchiveRoot = process.env.STARCI_ARCHIVE_ROOT;
  world.fkArchive = path.join(world.root, 'fixture-fk-archives');
  process.env.STARCI_ARCHIVE_ROOT = world.fkArchive;
  t.after(() => {
    if (previousArchiveRoot === undefined) delete process.env.STARCI_ARCHIVE_ROOT;
    else process.env.STARCI_ARCHIVE_ROOT = previousArchiveRoot;
  });
  const guard = path.join(guardsRoot(), 'jobs', 'fixture-fk.json');
  const prompt = path.join(starciLocalRoot(), 'dispatch-prompts', 'fixture-fk.md');
  for (const file of [guard, prompt]) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(guard, JSON.stringify({ workflowId: ARCHIVED }));
  fs.writeFileSync(prompt, `private fixture prompt ${ARCHIVED}`);
  world.fkFiles = [guard, prompt];
  world.machine.openSupDecision({ keyParts: { kind: 'fixture-fk', entity: ARCHIVED, signature: 'held' }, kind: 'runtime-defect', decider: 'supervisor', openedBy: 'spec',
    ledgerId: world.ledger.ledgerId, workflowId: ARCHIVED, entityType: 'workflow', entityId: ARCHIVED,
    summary: 'Private dependency fixture', evidence: {}, payload: {} });
}

test('a Work citation holds public ledger plan and apply before every host effect', t => purgeWorld(t, async world => {
  dependencyLeftovers(t, world);
  const artifact = citationArtifact(world);
  citeArtifact(world, artifact);
  const before = dependencyEffects(world);
  for (const args of [{ plan: true, ledger: true }, { apply: true, ledger: true }]) {
    const out = await run(world, args);
    assert.equal(out.code, 1, out.text);
    assert.ok(out.data.blockers.some(item => item.code === 'workflow-purge-ledger-dependency'), out.text);
    assert.deepEqual(dependencyEffects(world), before);
  }
  assert.equal(world.ledger.db.prepare('SELECT count(*) n FROM work_citations WHERE artifact_id=?').get(artifact.artifact_id).n, 1);
}));

test('foreign Work citations and a host-only purge do not create ledger-drop false blockers', t => purgeWorld(t, async world => {
  citeArtifact(world, citationArtifact(world, OTHER));
  const foreignPlan = await run(world, { plan: true, ledger: true });
  assert.equal(foreignPlan.code, 0, foreignPlan.text);
  assert.deepEqual(foreignPlan.data.blockers, []);
  const own = citationArtifact(world);
  // A second field keeps both foreign and own citations; no fixture replacement hides the foreign row.
  world.ledger.write.citeBlob({ recordId: 'fixture.own', recordPath: 'own/index.yaml', field: 'asset', artifactId: own.artifact_id, sha256: own.sha256 });
  const hostPlan = await run(world, { plan: true });
  assert.equal(hostPlan.code, 0, hostPlan.text);
  const hostApply = await run(world, { apply: true, expect: hostPlan.data.sha });
  assert.equal(hostApply.code, 0, hostApply.text);
  assert.equal(world.ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get(ARCHIVED).n, 1);
  assert.equal(world.ledger.db.prepare('SELECT count(*) n FROM work_citations').get().n, 2);
}));

test('a dependency arriving at the GC lock is held by the fresh plan before host effects', t => purgeWorld(t, async world => {
  dependencyLeftovers(t, world);
  const artifact = citationArtifact(world);
  const shown = await run(world, { plan: true, ledger: true });
  assert.equal(shown.code, 0, shown.text);
  let locked = false, afterMutation;
  const out = await run(world, { apply: true, ledger: true, expect: shown.data.sha }, {
    acquireGcLock: () => {
      locked = true;
      citeArtifact(world, artifact);
      afterMutation = dependencyEffects(world);
      return { ok: true, release() {} };
    }
  });
  assert.equal(locked, true);
  assert.equal(out.code, 1, out.text);
  assert.deepEqual(dependencyEffects(world), afterMutation);
  assert.ok(out.data.blockers.some(item => item.code === 'workflow-purge-ledger-dependency'), out.text);
}));
