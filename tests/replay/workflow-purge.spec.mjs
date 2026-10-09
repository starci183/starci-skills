// Replay of the shape the owner ordered wiped and run again from scratch on 2026-10-09: a workflow stopped by the owner, whose Kernel launches had failed twice and left a dead
// Codex terminal each in the workflow's tree; its tree, its branch and its preserved work still on the host, and an Orca worker whose release Orca could not confirm.
// `starci workflow stop` names the next step; `starci workflow purge` plans (default) and then removes exactly that, through the real CLI in a child process.
// Real: the CLI, the verbs, the ledger and registry, git (the product repository and its linked worktree), worker-close and the terminal close. Stubbed: the Orca binary
// (tests/helpers/fake-orca.mjs: terminal list/show/close, worker-list/show/release, worktree ps/rm).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { git, replayWorld } from '../helpers/replay-world.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { runtimeStampOf } from '../../scripts/lib/orca-orphans.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';

const wf = 'wf-1';
const failedLaunch = (n) => ({ kind: 'kernel-start-failed', entity: wf, at: -3_600_000 + n, payload: { step: 'turn-start', error: 'turn_start_unobserved', terminal: `term-dead-${n}`, dispatch: `dsp-launch-${n}`, runId: 'run-launch', effectState: 'none' } });
const fixture = {
  schema: 'replay-fixture@1', case: 'archived-failed-launch', workflow: { id: wf, phase: 'running', goalRevision: 0 },
  jobs: [{ id: 'job-1', op: 'architecture.decide', status: 'running', provider: 'claude', owned: ['d1.sds'], extra: { managed: { runId: 'run-1', dispatchId: 'dsp-1', agentTerminalHandle: 'term-op-1' } }, at: { created: -7_200_000, updated: -600_000 } }],
  events: [failedLaunch(1), failedLaunch(2)],
};

/** The world after the owner stopped the workflow: tree, preserved ref and a foreign branch in the product repository; Orca's books seeded. */
function stoppedWorld(t) {
  const world = replayWorld(t, fixture);
  const dir = path.join(world.base, 'orca', 'product', `wf-${wf}`);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(world.repo, 'worktree', 'add', '-q', '-b', `wf-${wf}`, dir);
  fs.writeFileSync(path.join(dir, 'work.txt'), 'work\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', `checkpoint ${wf}: step-1`);
  git(world.repo, 'branch', `preserved/${wf}/gc`, `wf-${wf}`);
  git(world.repo, 'branch', 'feature/unrelated', 'main');
  registerWorkflowWorktree({ env: world.env }, { workflowId: wf, orcaWorktreeId: `repo-product::${dir}`, path: dir, branch: `wf-${wf}` });
  const terminal = (handle, cwd) => ({ handle, title: 'codex', worktree: cwd, closed: false, connected: true, agentIdentity: 'codex' });
  fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({
    sends: 0,
    terminals: { 'term-dead-1': terminal('term-dead-1', dir), 'term-dead-2': terminal('term-dead-2', dir), 'term-owner': terminal('term-owner', world.base), 'fake-terminal-1': { handle: 'fake-terminal-1', connected: false, writable: false } },
    worktreeRepos: { 'repo-product': world.repo },
    worktrees: [
      { id: `repo-product::${world.repo}`, repoId: 'repo-product', hostId: 'local', path: world.repo, branch: 'main', comment: '', isMainWorktree: true, liveTerminalCount: 0 },
      { id: `repo-product::${dir}`, repoId: 'repo-product', hostId: 'local', path: dir, branch: `wf-${wf}`, comment: runtimeStampOf({ kind: 'workflow', slot: `wf-${wf}`, owner: { workflowId: wf } }), isMainWorktree: false, liveTerminalCount: 2 },
    ],
    workerRows: [{ dispatchId: 'dsp-1', runId: 'run-1', terminalState: 'release_unknown', workerState: 'settled', resource: { terminalHandle: 'term-op-1' }, projection: { liveness: { verdict: 'exited' }, nextAction: null } }],
  }));
  return { world, dir };
}

const machineOf = (world) => openMachine({ file: world.machineFile });
const orcaCalls = (world) => fs.readFileSync(world.env.STARCI_FAKE_ORCA_LOG, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).argv.join(' '));

test('stop names the next step; the plan lists the tree, the refs with their tips and the dead launch terminals; apply removes them and leaves the rest', (t) => {
  const { world, dir } = stoppedWorld(t);
  const stop = world.cli('archive', ['--workflow', wf, '--reason', 'owner stop', '--by', 'owner'], { as: 'owner' });
  assert.equal(stop.status, 0, stop.stderr || stop.stdout);
  assert.match(stop.json.next.purge, /^starci workflow purge --repo .+ --workflow wf-1 --plan$/);

  const planned = world.starci(['workflow', 'purge', '--repo', world.repo, '--workflow', wf]);
  assert.equal(planned.status, 0, planned.stderr || planned.stdout);
  const plan = planned.json;
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(plan.trees.map((tree) => tree.path), [path.resolve(dir)]);
  assert.deepEqual(plan.refs.filter((ref) => ref.action === 'delete').map((ref) => ref.name).sort(), [`preserved/${wf}/gc`, `wf-${wf}`]);
  assert.deepEqual(plan.terminals.map((c) => c.handle).sort(), ['term-dead-1', 'term-dead-2']);
  assert.deepEqual(plan.workers.map((w) => w.dispatchId), ['dsp-1']);
  assert.ok(plan.listed.length === 0, 'the owner shell is outside the tree and is not even listed');
  assert.equal(fs.existsSync(dir), true, 'the plan removed nothing');

  const applied = world.starci(['workflow', 'purge', '--repo', world.repo, '--workflow', wf, '--apply', '--expect', plan.sha.slice(0, 12)]);
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  assert.equal(fs.existsSync(dir), false);
  const branches = git(world.repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split(/\r?\n/).sort();
  assert.deepEqual(branches, ['feature/unrelated', 'main'], 'the workflow branch and its preserved ref are gone; main and the foreign branch stay');
  const calls = orcaCalls(world);
  assert.ok(calls.some((call) => /orchestration worker-release .*dsp-1/.test(call)), 'the worker is released through worker-close');
  for (const handle of ['term-dead-1', 'term-dead-2']) assert.ok(calls.some((call) => call.startsWith('terminal close') && call.includes(handle)), `${handle} is closed`);
  assert.equal(calls.some((call) => call.startsWith('terminal close') && call.includes('term-owner')), false, 'a terminal the ledger does not name is never closed');
  const machine = machineOf(world);
  try {
    assert.equal(machine.db.prepare("SELECT count(*) n FROM sup_events WHERE kind='workflow-purged' AND entity_id=?").get(wf).n, 1);
    assert.equal(machine.db.prepare('SELECT count(*) n FROM worktrees WHERE workflow_id=? AND removed_at IS NULL').get(wf).n, 0);
  } finally { machine.close(); }

  // Orca's books now show the worker released (the stub keeps the seeded row): the second purge finds nothing left.
  const books = JSON.parse(fs.readFileSync(world.env.STARCI_FAKE_ORCA_STATE, 'utf8'));
  fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify({ ...books, workerRows: [] }));
  const again = world.starci(['workflow', 'purge', '--repo', world.repo, '--workflow', wf, '--apply']);
  assert.equal(again.status, 0, again.stderr || again.stdout);
  assert.equal(again.json.already, true, 'a second purge finds it done');
});

test('a workflow that is not archived is refused by the real CLI and nothing moves', (t) => {
  const { world, dir } = stoppedWorld(t);
  const refused = world.starci(['workflow', 'purge', '--repo', world.repo, '--workflow', wf, '--apply']);
  assert.equal(refused.status, 1);
  assert.ok(refused.json.blockers.some((b) => b.code === 'workflow-purge-not-archived' || b.code === 'workflow-purge-live-job'));
  assert.equal(fs.existsSync(dir), true);
});
