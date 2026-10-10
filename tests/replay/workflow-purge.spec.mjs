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
import { blobPath, getBlob, putBundle } from '../../engine/db/blob.mjs';
import { zipVisit } from '../../scripts/api/fs/zip-visit.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

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

const stopWorld = (world) => {
  const out = world.cli('archive', ['--workflow', wf, '--reason', 'fixture owner stop', '--by', 'owner'], { as: 'owner' });
  assert.equal(out.status, 0, out.stderr || out.stdout);
  world.purgeCallStart = orcaCalls(world).length;
};
const purgeArgs = (world, ...flags) => ['workflow', 'purge', '--repo', world.repo, '--workflow', wf, ...flags];
const writeBooks = (world, update) => fs.writeFileSync(world.env.STARCI_FAKE_ORCA_STATE, JSON.stringify(update(world.orca())));
const noPurgeEffects = (world, dir) => {
  assert.equal(fs.existsSync(dir), true);
  assert.equal(world.ledger((ledger) => ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get(wf).n), 1);
  assert.equal(orcaCalls(world).slice(world.purgeCallStart).some((call) => /^(terminal close|worktree rm|orchestration worker-release) /.test(call)), false);
  assert.equal(git(world.repo, 'rev-parse', `refs/heads/wf-${wf}`), git(dir, 'rev-parse', 'HEAD'));
};

test('native-shaped context-only Dispatches with positive resource absence do not retain a workflow tree or get released', t => {
  const { world, dir } = stoppedWorld(t);
  stopWorld(world);
  const historical = (dispatchId, runId) => ({ dispatchId, runId, workerState: 'unsupervised', terminalState: 'retained', agentTerminalHandle: 'term-' + dispatchId, resource: null,
    projection: { resource: { state: 'absent', reason: 'unsupervised' }, workspace: null, liveness: { verdict: 'unverifiable', reason: 'unsupervised_settled' }, nextAction: { kind: 'none', argv: [] } } });
  const contexts = [historical('dsp-context-own', 'run-1'), historical('dsp-context-foreign', 'run-history')];
  writeBooks(world, books => ({ ...books, workerRows: [...books.workerRows, ...contexts] }));
  const planned = world.starci(purgeArgs(world, '--plan'));
  assert.equal(planned.status, 0, planned.stderr || planned.stdout);
  assert.deepEqual(planned.json.blockers, []);
  assert.deepEqual(planned.json.workers.map(worker => worker.dispatchId), ['dsp-1']);
  assert.equal(fs.existsSync(dir), true);
  const applied = world.starci(purgeArgs(world, '--apply', '--expect', planned.json.sha));
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  assert.equal(fs.existsSync(dir), false);
  assert.deepEqual(world.orca().workerRows.filter(worker => worker.workerState === 'unsupervised'), contexts, 'historical Dispatch records and their liveness are untouched');
  const effects = orcaCalls(world).slice(world.purgeCallStart).filter(call => /^(terminal close|orchestration worker-release) /.test(call));
  for (const context of contexts) assert.equal(effects.some(call => call.includes(context.dispatchId) || call.includes(context.agentTerminalHandle)), false, 'resource absence never authorizes a close');
});

test('a caller-bound native worker listing cannot hide foreign resource custody or authorize an apply', t => {
  const { world, dir } = stoppedWorld(t);
  stopWorld(world);
  writeBooks(world, books => ({ ...books, workerListBoundRun: 'run-1', workerRows: [...books.workerRows,
    { dispatchId: 'dsp-hidden', runId: 'run-foreign', workerState: 'abandoned', terminalState: 'retained', resource: { terminalHandle: 'term-hidden', worktreeId: 'repo-product::' + dir }, projection: { resource: { state: 'owned' }, liveness: { verdict: 'unverifiable', reason: 'missing_status' }, nextAction: { kind: 'release', argv: ['orchestration', 'worker-release', '--dispatch', 'dsp-hidden'] } } },
  ] }));
  for (const flags of [['--plan'], ['--apply', '--ledger']]) {
    const refused = world.starci(purgeArgs(world, ...flags));
    assert.equal(refused.status, 1, refused.stderr || refused.stdout);
    assert.ok(refused.json.blockers.some(item => item.code === 'workflow-purge-orca-unreadable'));
    noPurgeEffects(world, dir);
  }
});

test('genuine all-scope accounting keeps one retained abandoned resource held beside historical resource absence', t => {
  const { world, dir } = stoppedWorld(t);
  stopWorld(world);
  const history = { dispatchId: 'dsp-history', runId: 'run-history', workerState: 'unsupervised', terminalState: 'retained', agentTerminalHandle: 'term-history', resource: null,
    projection: { resource: { state: 'absent', reason: 'unsupervised' }, workspace: null, liveness: { verdict: 'unverifiable', reason: 'unsupervised_settled' }, nextAction: { kind: 'none', argv: [] } } };
  const holder = { dispatchId: 'dsp-held', runId: 'run-foreign', workerState: 'abandoned', terminalState: 'retained', resource: { terminalHandle: 'term-held', worktreeId: 'repo-product::' + dir },
    projection: { resource: { state: 'owned' }, liveness: { verdict: 'unverifiable', reason: 'missing_status' }, nextAction: { kind: 'release', argv: ['orchestration', 'worker-release', '--dispatch', 'dsp-held'] } } };
  writeBooks(world, books => ({ ...books, workerRows: [...books.workerRows, history, holder] }));
  const refused = world.starci(purgeArgs(world, '--apply', '--ledger'));
  assert.equal(refused.status, 1, refused.stderr || refused.stdout);
  assert.ok(refused.json.blockers.some(item => item.code === 'workflow-purge-custody-unknown'));
  assert.deepEqual(refused.json.listed.map(item => item.id), ['dsp-held']);
  noPurgeEffects(world, dir);
  assert.deepEqual(world.orca().workerRows.slice(-2), [history, holder]);
});

test('a worker page scoped to another Run refuses through the real CLI before effects', t => {
  const { world, dir } = stoppedWorld(t);
  stopWorld(world);
  writeBooks(world, books => ({ ...books, workerListScopes: { 'run-1': { source: 'flag', run: 'run-wrong' } } }));
  const refused = world.starci(purgeArgs(world, '--apply', '--ledger'));
  assert.equal(refused.status, 1, refused.stderr || refused.stdout);
  assert.ok(refused.json.blockers.some(item => item.code === 'workflow-purge-orca-unreadable'));
  noPurgeEffects(world, dir);
});

test('pointer-only ledger events and spilled machine events preserve Run, terminal and ref custody; a live proved worker refuses before any effect', (t) => {
  const { world, dir } = stoppedWorld(t);
  const preservedRef = 'preserved/private-spilled-evidence';
  git(world.repo, 'branch', preservedRef, `wf-${wf}`);
  world.ledger((ledger) => {
    for (const [kind, payload] of [
      ['kernel-start-failed', { runId: 'run-spilled', terminal: 'term-spilled', dispatch: 'dsp-spilled' }],
      ['workflow-op-preserved', { preservedRef: `refs/heads/${preservedRef}` }],
    ]) {
      const blob = ledger.write.storeBlob({ content: Buffer.from(JSON.stringify(payload)), mediaType: 'application/json' });
      ledger.appendEvent({ workflowId: wf, entityType: 'workflow', entityId: wf, kind, payloadSha: blob.sha256 });
    }
  });
  stopWorld(world);
  const machine = machineOf(world);
  try { machine.supEvent({ entityType: 'kernel', entityId: wf, kind: 'kernel-start-failed', payload: { runId: 'run-machine-spill', terminal: 'term-machine-spill', dispatch: 'dsp-machine-spill', detail: 'fixture'.repeat(4000) } }); } finally { machine.close(); }
  writeBooks(world, (books) => ({ ...books,
    terminals: { ...books.terminals, 'term-machine-spill': { handle: 'term-machine-spill', title: 'codex', worktree: dir, connected: true } },
    workerRows: [...books.workerRows, { dispatchId: 'dsp-spilled', runId: 'run-spilled', terminalState: 'release_unknown', resource: { terminalHandle: 'term-spilled', worktreeId: `repo-product::${dir}` }, projection: { liveness: { verdict: 'exited' } } }],
  }));
  const plan = world.starci(purgeArgs(world));
  assert.equal(plan.status, 0, plan.stderr || plan.stdout);
  assert.ok(plan.json.workers.some((worker) => worker.dispatchId === 'dsp-spilled'));
  assert.ok(plan.json.terminals.some((terminal) => terminal.handle === 'term-machine-spill'));
  assert.equal(plan.json.refs.find((ref) => ref.name === preservedRef)?.action, 'delete');
  writeBooks(world, (books) => ({ ...books, workerRows: books.workerRows.map((worker) => worker.dispatchId === 'dsp-spilled' ? { ...worker, terminalState: 'active', projection: { liveness: { verdict: 'unknown' } } } : worker) }));
  const refused = world.starci(purgeArgs(world, '--apply', '--ledger'));
  assert.equal(refused.status, 1);
  assert.ok(refused.json.blockers.some((blocker) => blocker.code === 'workflow-purge-worker-live'));
  noPurgeEffects(world, dir);
});

for (const kind of ['worker', 'terminal']) test(`unknown ${kind} custody in a workflow tree refuses --apply --ledger before any effect`, (t) => {
  const { world, dir } = stoppedWorld(t);
  stopWorld(world);
  writeBooks(world, (books) => kind === 'worker' ? { ...books, workerRows: [...books.workerRows, { dispatchId: 'dsp-foreign', runId: 'run-foreign', terminalState: 'active', resource: { terminalHandle: 'term-foreign', worktreeId: `repo-product::${dir}` }, projection: { liveness: { verdict: 'unknown' } } }] }
    : { ...books, terminals: { ...books.terminals, 'term-foreign': { handle: 'term-foreign', title: 'owner shell', worktree: dir, connected: true } } });
  const refused = world.starci(purgeArgs(world, '--apply', '--ledger'));
  assert.equal(refused.status, 1, 'unproved custody never authorizes tree removal');
  assert.ok(refused.json.blockers.some((blocker) => blocker.code === 'workflow-purge-custody-unknown'));
  noPurgeEffects(world, dir);
});

/** Real storage writers, no job_artifacts: goal, attempt streams, check streams, event evidence and a bundle; the foreign workflow is excluded. */
function archiveEvidence(world) {
  const blobs = new Map();
  const store = (ledger, name) => {
    const bytes = Buffer.from(`private fixture ${name}\n`);
    const blob = ledger.write.storeBlob({ content: bytes, mediaType: 'text/plain' });
    blobs.set(blob.sha256, bytes);
    return blob.sha256;
  };
  world.ledger((ledger) => {
    const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('job-1').attempt_id;
    ledger.write.recordGoalInput({ workflowId: wf, key: 'source', goalRevision: 0, sha256: store(ledger, 'goal input'), origin: 'owner' });
    ledger.write.setAttemptTranscript({ attemptId, promptSha: store(ledger, 'prompt'), transcriptSha: store(ledger, 'transcript'), sessionSha: store(ledger, 'session') });
    ledger.write.recordTranscriptSnapshot({ attemptId, sha256: store(ledger, 'snapshot'), lines: 1, bytes: Buffer.byteLength('private fixture snapshot\n') });
    ledger.write.recordCheckRun({ attemptId, name: 'archive-fixture', phase: 'verify', runner: 'op', status: 'pass', exitCode: 0, stdoutSha: store(ledger, 'stdout'), stderrSha: store(ledger, 'stderr'), outputSha: store(ledger, 'output') });
    const bytes = Buffer.from(JSON.stringify({ evidence: 'fixture'.repeat(4000) }));
    const event = ledger.appendEvent({ workflowId: wf, entityType: 'workflow', entityId: wf, kind: 'archive-fixture', payload: JSON.parse(bytes) });
    blobs.set(event.payload_sha, getBlob(event.payload_sha));
    const bundle = path.join(world.base, 'bundle-input');
    fs.mkdirSync(bundle);
    fs.writeFileSync(path.join(bundle, 'capture.txt'), 'private fixture bundle member\n');
    const sha = putBundle(bundle);
    blobs.set(sha, getBlob(sha));
    const member = JSON.parse(getBlob(sha)).files['capture.txt'];
    blobs.set(member, getBlob(member));
    ledger.write.storeBlob({ content: getBlob(sha), mediaType: 'application/json' });
    ledger.write.recordGoalInput({ workflowId: wf, key: 'bundle', goalRevision: 0, sha256: sha, origin: 'owner' });
    seedWorkflow(ledger, { id: 'wf-foreign', state: { phase: 'running' } });
    const foreign = ledger.write.storeBlob({ content: Buffer.from('private foreign bytes'), mediaType: 'text/plain' });
    ledger.write.recordGoalInput({ workflowId: 'wf-foreign', key: 'source', goalRevision: 0, sha256: foreign.sha256, origin: 'owner' });
    ledger.write.citeBlob({ recordId: 'foreign.record', recordPath: 'foreign/index.yaml', field: 'asset', sha256: foreign.sha256 });
    world.foreignBlob = foreign.sha256;
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM job_artifacts').get().n, 0);
  });
  return blobs;
}

test('--ledger ZIP alone recovers every declared workflow blob and bundle member after fixture originals disappear; foreign bytes stay outside', (t) => {
  const { world } = stoppedWorld(t);
  const blobs = archiveEvidence(world);
  stopWorld(world);
  const applied = world.starci(purgeArgs(world, '--apply', '--ledger'));
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  const restored = path.join(world.base, 'restored-blobs');
  const entries = new Map();
  zipVisit(applied.json.results.ledger.archive, (entry) => { entries.set(entry.name, entry.data); });
  const archivedShas = [...entries.keys()].filter((name) => /^files\/blobs\/[a-f0-9]{64}$/.test(name)).map((name) => name.split('/').at(-1));
  assert.deepEqual(archivedShas.sort(), [...blobs.keys()].sort(), 'the ZIP contains the complete reference closure, even with no job_artifacts');
  assert.equal(entries.has(`files/blobs/${world.foreignBlob}`), false);
  for (const [sha, bytes] of blobs) {
    assert.deepEqual(entries.get(`files/blobs/${sha}`), bytes);
    const original = blobPath(sha);
    fs.rmSync(original);
    fs.rmSync(`${original}.json`);
    const file = path.join(restored, sha.slice(0, 2), sha);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, entries.get(`files/blobs/${sha}`));
    fs.writeFileSync(`${file}.json`, entries.get(`files/blobs/${sha}.json`));
    assert.deepEqual(getBlob(sha, { root: restored }), bytes, 'archive bytes and metadata recover through the real storage reader');
  }
  assert.ok(blobPath(world.foreignBlob), 'foreign workflow retains its original evidence');
});

for (const damage of ['missing', 'corrupt']) test(`${damage} check evidence refuses --ledger before host or ledger removal`, (t) => {
  const { world, dir } = stoppedWorld(t);
  archiveEvidence(world);
  stopWorld(world);
  const sha = world.ledger((ledger) => ledger.db.prepare("SELECT output_sha FROM check_runs WHERE name='archive-fixture'").get().output_sha);
  const file = blobPath(sha);
  if (damage === 'missing') fs.rmSync(file); else fs.writeFileSync(file, Buffer.alloc(fs.statSync(file).size));
  const refused = world.starci(purgeArgs(world, '--apply', '--ledger'));
  assert.equal(refused.status, 1);
  assert.ok(refused.json.blockers.some((blocker) => blocker.code === 'workflow-purge-archive-incomplete'));
  noPurgeEffects(world, dir);
  assert.equal(fs.existsSync(world.env.STARCI_ARCHIVE_ROOT), false);
});
