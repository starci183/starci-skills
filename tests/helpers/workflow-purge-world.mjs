// workflow-purge-world.mjs - the world of the workflow purge specs: a product repository with real worktrees, branches and preserved refs (git), a fake Orca for the
// worktree home (tests/helpers/fake-orca-worktrees.mjs) and for the reads of the purge (terminals, workers), and a real ledger and machine registry in which one
// workflow is archived (its jobs dropped, as `starci workflow stop` leaves them) and another is running in the same repository.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { changeWorkflowPhase } from '../../engine/db/ledger.mjs';
import { createOrcaWorktree, removeOrcaWorktree } from '../../scripts/machine/worktree-orca.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { fakeOrcaWorktrees } from './fake-orca-worktrees.mjs';
import { seedWorkflow, withLedger } from './ledger-fixture.mjs';

export const ARCHIVED = 'wf-old-one';
export const OTHER = 'wf-other-two';
export const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_AUTHOR_NAME: 'spec', GIT_AUTHOR_EMAIL: 'spec@starci.test', GIT_COMMITTER_NAME: 'spec', GIT_COMMITTER_EMAIL: 'spec@starci.test' } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

const tick = { n: 0 };
/** One commit with its own file on a branch checked out in `dir`; answers the sha. */
export function commitIn(dir, message) {
  tick.n += 1;
  fs.writeFileSync(path.join(dir, `file-${tick.n}.txt`), `${tick.n}\n`);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

const initRepo = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) git(dir, 'config', key, value);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
};

const killed = (job) => ({ status: 'cancelled', ...job });
const archivedJobs = () => [
  killed({ jobId: `kernel-${ARCHIVED}`, kind: 'kernel', payload: { managed: { runId: 'run-old', agentTerminalHandle: 'term-kernel-old', dispatchId: 'dsp-kernel' } } }),
  killed({ jobId: 'op-architecture.decide-8da14f299d', opId: 'architecture.decide', payload: { opId: 'architecture.decide', managed: { runId: 'run-old', dispatchId: 'dsp-op', agentTerminalHandle: 'term-op-old' } } }),
];
const failedLaunch = (terminal, dispatch) => ({ kind: 'kernel-start-failed', entityType: 'kernel', entityId: ARCHIVED, payload: { step: 'turn-start', error: 'turn_start_unobserved', terminal, dispatch, runId: 'run-launch', effectState: 'none' } });

/** The workflow stopped the way `starci workflow stop` leaves it: its phase archived (a stopped phase first), after its last event. */
export function archive(ledger, workflowId) {
  ledger.transaction((db) => {
    changeWorkflowPhase(db, { workflowId, to: 'stopped', by: 'spec', reason: 'owner stop' });
    changeWorkflowPhase(db, { workflowId, to: 'archived', by: 'spec', reason: 'owner stop' });
  });
}

function treeAt(world, workflowId) {
  const made = createOrcaWorktree({ repoRoot: world.app, kind: 'workflow', name: `wf-${workflowId}`, base: 'main', owner: { workflowId, ledgerId: world.ledger.ledgerId }, orca: world.orca, env: process.env });
  assert.ok(made.ok, JSON.stringify(made));
  registerWorkflowWorktree({ env: process.env }, { workflowId, orcaWorktreeId: made.id, path: made.path, branch: made.branch, ledgerId: world.ledger.ledgerId });
  return made;
}

/**
 * The world, passed to `fn(world)`: app (the product repo), orca (fake worktree client), reads (the purge's Orca seam), terminals / workers (arrays a spec edits),
 * trees {archived: [first (removed, branch kept), second], other}, and the git refs of both workflows. Everything lives under one temp dir removed after the test.
 */
export function purgeWorld(t, fn, { archiveIt = true } = {}) {
  return withLedger(t, ({ ledger, machine, repoRoot, track, root }) => {
    const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-purge-')));
    t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
    const app = path.join(base, 'app');
    initRepo(app);
    const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
    seedWorkflow(ledger, { id: ARCHIVED, state: { phase: 'running' }, jobs: archivedJobs(), events: [failedLaunch('term-dead-1', 'dsp-launch-1'), failedLaunch('term-dead-2', 'dsp-launch-2'),
      { kind: 'workflow-op-preserved', entityType: 'job', entityId: 'op-architecture.decide-8da14f299d', payload: { preservedRef: 'refs/heads/preserved/op-architecture.decide-8da14f299d' } }] });
    seedWorkflow(ledger, { id: OTHER, state: { phase: 'running' } });
    track(ledger);
    const world = { base, app, orca, ledger, machine, repoRoot, root, terminals: [], workers: [], trees: {}, closed: { terminals: [], workers: [] } };
    // The archived workflow's first tree went with its collector (its branch stayed, its row closed); the second one is the live shape.
    const first = treeAt(world, ARCHIVED);
    const checkpoint = commitIn(first.path, `checkpoint ${ARCHIVED}: step-1`);
    assert.ok(removeOrcaWorktree({ repoRoot: app, orcaId: first.id, dir: first.path, branch: first.branch, deleteBranch: null, orca, env: process.env }).ok);
    const second = treeAt(world, ARCHIVED);
    git(second.path, 'merge', '--ff-only', first.branch);
    const other = treeAt(world, OTHER);
    commitIn(other.path, `checkpoint ${OTHER}: step-1`);
    world.trees = { first, second, other, checkpoint };
    const tipOf = (ref) => git(app, 'rev-parse', `refs/heads/${ref}`);
    for (const name of [`preserved/${ARCHIVED}/gc`, `preserved/${ARCHIVED}/wrong-tree`, 'preserved/op-architecture.decide-8da14f299d', `preserved/${OTHER}/gc`]) git(app, 'branch', name, name.includes(OTHER) ? other.branch : second.branch);
    // A branch that only matches the name: it carries a commit of its own and no checkpoint of this workflow.
    git(app, 'branch', `ghost/wf-${ARCHIVED}`, 'main');
    git(app, 'checkout', '-q', `ghost/wf-${ARCHIVED}`);
    const ghost = commitIn(app, 'somebody else work');
    git(app, 'checkout', '-q', 'main');
    world.refs = { ghost, tipOf, main: tipOf('main') };
    world.reads = {
      ps: () => orca.ps(),
      terminals: () => ({ ok: true, terminals: world.terminals }),
      workers: (run) => ({ ok: true, scope: { source: run == null ? 'all' : 'flag', run: run ?? null }, workers: run == null ? world.workers : world.workers.filter((w) => w.runId === run) }),
    };
    if (archiveIt) archive(ledger, ARCHIVED);
    return fn(world);
  });
}

/** An Orca terminal row as `terminal list` gives it. */
export const terminalRow = (handle, cwd, extra = {}) => ({ handle, title: 'codex', worktreePath: cwd, connected: true, agentIdentity: 'codex', ...extra });
/** A worker-list row in `state`. */
export const workerRow = (dispatchId, runId, terminalHandle, state, liveness = 'exited', worktree = null) => ({ dispatchId, runId, terminalState: state, workerState: 'settled', resource: { terminalHandle, ...(worktree ? { worktreeId: 'repo::' + worktree } : {}) },
  projection: { liveness: { verdict: liveness }, nextAction: null } });
