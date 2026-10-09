import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_RUBRIC, VERDICT_FILE, runCritic, criticWorkspace, removeCriticWorkspace } from '../../scripts/work/draw-critic.mjs';
import { criticFor } from '../../scripts/work/critic-pick.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { agentCliSpawns } from '../../scripts/checks/check-host-boundary.mjs';
import { fakeCriticOrca, passingVerdict } from '../helpers/fake-critic-orca.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

// The prompt of a Critic whose Task spec is a pointer: the text of the file the pointer names (the second line after PACKET FILE).
const taskOf = (spec) => { const lines = String(spec).split(String.fromCodePoint(10)).map((line) => line.trim()); const at = lines.findIndex((line) => line.startsWith('PACKET FILE:')); return at < 0 ? String(spec) : fs.readFileSync(lines[at + 1], 'utf8'); };

// The draw loop's independent critic is an Orca worker started through orchestration worker-start with the provider,
// model and effort of the member the Critic tier admits (scripts/work/critic-pick.mjs, draw-critic.mjs): it gets a Task spec naming its clean dir, the images and verdict.json, the runtime
// waits for its worker_done through the orchestration commands, reads the verdict, then stops and releases the worker.
// A timeout, a refusal or a missing verdict is a typed outcome with no verdict - never a pass. Every Orca call here goes
// to a fake client; nothing reaches a host.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const configured = allocationSettings().drawLoop;
const picked = criticFor(configured, { provider: 'devin', model: 'swe-2-max' }).critic;

const round = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-worker-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const png = path.join(dir, 'desktop.png');
  fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a', 'hex'));
  const html = path.join(dir, 'screen.html');
  fs.writeFileSync(html, '<!doctype html><html><body><h1>Ledger</h1></body></html>');
  return { dir, images: [{ path: png, label: 'desktop 1184px' }], html };
};
// A virtual clock: the wait loop sleeps on it, so a timeout is instant and exact.
const clock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };
const startOf = (orca) => orca.calls.find((c) => c[0] === 'worker-start')?.[1];
const cleanDirsLeft = (dir) => fs.readdirSync(dir).filter((n) => n.startsWith('starci-draw-critic-'));

test('the critic is started through worker-start with the configured provider, model and effort; its verdict is read; the worker is released', async (t) => {
  const r = round(t);
  let seen = null;
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 8), onStart: (a) => { seen = { dir: a.worktree, files: fs.readdirSync(a.worktree).sort(), pointer: a.spec, task: taskOf(a.spec) }; } });
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: picked, orca, placement: { tmpRoot: r.dir }, entry: 'term_op', ...clock() });
  assert.equal(critique.outcome, 'judged', critique.error);
  assert.equal(critique.verdict.beauty, 8);
  assert.deepEqual(critique.verdict.failed, []);
  const start = startOf(orca);
  assert.deepEqual({ agent: start.agent, model: start.model, effort: start.effort },
    { agent: picked.provider, model: picked.model, effort: picked.effort ?? undefined }, 'worker-start --agent --model --effort of the member the Critic tier admits');
  assert.equal(start.worktree, seen.dir, 'the worker is placed in the clean dir');
  assert.equal(start.from, 'term_op', 'the worker belongs to the Run of the terminal running the loop');
  assert.deepEqual(seen.files, ['render-1.png', 'rubric.yaml', 'screen.html'], 'the clean dir holds no drawing context');
  assert.ok(!seen.files.includes('TASK.md'), 'the Task file is not in the Critic directory (06c13f369)');
  const spec = seen.task;
  const at = (f) => path.join(seen.dir, f).replaceAll('\\', '/');
  for (const f of ['render-1.png', 'screen.html', 'rubric.yaml', VERDICT_FILE]) assert.ok(spec.includes(at(f)), `the Task spec names ${f}`);
  assert.match(spec, /the one file you may write is/, 'every other write is forbidden');
  assert.match(spec, /worker_done/);
  const names = orca.names();
  assert.ok(names.indexOf('check') > names.indexOf('worker-start'), 'the worker_done is awaited through the consuming orchestration check');
  const checks = orca.calls.filter((c) => c[0] === 'check').map((c) => c[1]);
  assert.deepEqual(checks[0], { run: 'run_critic', terminal: 'term_op' }, "the critic's own Run, named by its coordinator");
  assert.equal(checks.at(-1).ack, 'delivery_1', 'the Delivery is acknowledged once read');
  assert.deepEqual(names.slice(-4), ['worker-stop', 'worker-release', 'task-update', 'critic-workspace-remove'], 'the verdict is read, then the worker is released, its Task closed and its placement removed');
  assert.equal(orca.calls.find((c) => c[0] === 'worker-release')[1].dispatch, critique.critic.dispatchId);
  assert.deepEqual(critique.critic.cleanup, { stopped: true, released: true, taskClosed: true });
  assert.equal(critique.critic.launch, 'orchestration worker-start');
  assert.deepEqual(cleanDirsLeft(r.dir), [], 'the clean dir is removed');
});

test('an unknown critic launch retains its placement until the worker exit is proven', async t => {
  const r = round(t), orca = fakeCriticOrca();
  orca.workerStart = () => ({ ok: false, effectState: 'unknown', dispatchId: 'uncertain-critic', error: 'receipt missing' });
  orca.workerShow = () => ({ ok: false });
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: picked, orca, placement: { tmpRoot: r.dir }, ...clock() });
  assert.equal(critique.outcome, 'launch-failed');
  assert.equal(critique.critic.independent, false);
  assert.equal(orca.names().includes('critic-workspace-remove'), false);
  assert.equal(critique.critic.placementRetained.dispatchId, 'uncertain-critic');
  assert.ok(fs.existsSync(critique.critic.placementRetained.dir));
});

test('a Codex drawer is judged by a Claude worker of the Critic tier, never by Codex', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: criticFor(configured, 'codex').critic, orca, placement: { tmpRoot: r.dir }, ...clock() });
  assert.equal(critique.outcome, 'judged');
  assert.deepEqual([startOf(orca).agent, startOf(orca).model], ['claude', 'claude-opus-5-5']);
});

test('a critic with no worker_done within timeoutMs is a timeout: no verdict, the worker stopped and released', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ mode: 'silent' });
  const c = clock();
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: { ...picked, timeoutMs: 60000 }, orca, placement: { tmpRoot: r.dir }, pollMs: 5000, ...c });
  assert.equal(critique.outcome, 'timeout');
  assert.equal(critique.verdict, null);
  assert.match(critique.error, /no worker_done within 60000ms/);
  assert.equal(c.now(), 60000, 'the wait is bounded by the critic timeout');
  assert.ok(orca.names().includes('worker-stop') && orca.names().includes('worker-release'), 'a timed-out critic is stopped and released');
  assert.deepEqual(cleanDirsLeft(r.dir), []);
});

test('a refusal, an ended worker, a missing verdict and a failed launch are typed outcomes, never a pass', async (t) => {
  const run = async (mode) => {
    const r = round(t);
    const orca = fakeCriticOrca({ mode });
    return { critique: await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: picked, orca, placement: { tmpRoot: r.dir }, ...clock() }), orca };
  };
  const escalated = await run('escalate');
  assert.deepEqual([escalated.critique.outcome, escalated.critique.verdict], ['refused', null]);
  assert.match(escalated.critique.error, /escalated/);
  const ended = await run('ended');
  assert.deepEqual([ended.critique.outcome, ended.critique.verdict], ['refused', null]);
  assert.match(ended.critique.error, /ended \(failed\) without worker_done/);
  const empty = await run('done-no-verdict');
  assert.deepEqual([empty.critique.outcome, empty.critique.verdict], ['verdict-missing', null]);
  for (const x of [escalated, ended, empty]) assert.ok(x.orca.names().includes('worker-release'), 'every started critic is released');
  const refused = await run('launch-failed');
  assert.deepEqual([refused.critique.outcome, refused.critique.verdict], ['launch-failed', null]);
  assert.match(refused.critique.error, /agent_unavailable/);
  assert.equal(refused.orca.names().includes('worker-release'), false, 'a start refused before any effect leaves nothing to release');
  const none = await runCritic({ ...round(t), rubric: DEFAULT_RUBRIC, critic: { provider: 'codex', model: 'gpt-6.1-sol' }, orca: fakeCriticOrca() });
  assert.equal(none.outcome, 'not-configured', 'a critic without a timeout is not configured');
});

test('the critic runs no agent CLI as a child process', () => {
  const file = path.join(ROOT, 'scripts', 'work', 'draw-critic.mjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.deepEqual(agentCliSpawns(text, file), []);
  assert.doesNotMatch(text, /from 'node:child_process'/, 'no child-process path is left');
  for (const c of [picked, criticFor(configured, 'codex').critic]) assert.equal(c.command, undefined, 'a critic is a provider, not a command');
});

// Orca places a worker only on a worktree it resolves: a bare temp directory is refused selector_not_found (live launch
// smoke 2026-10-01, scripts/kernel/launch-smoke.mjs). The placement is an Orca worktree of the repository the loop runs
// in (an agent's workspace is Orca's, owner decision WFWT), at the empty tree, registered by its Orca id and removed
// through Orca.
test('the critic placement is an Orca worktree at the empty tree, registered by its Orca id, and removed through Orca', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-place-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'product');
  fs.mkdirSync(repo);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'spec@starci.test');
  git('config', 'user.name', 'spec');
  fs.writeFileSync(path.join(repo, 'brief.md'), 'the drawing brief the critic must never see\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  const op = { workflowId: 'wf-critic-place', jobId: 'job-draw-1' };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const placed = criticWorkspace({ repoRoot: repo, context: op, env, orca });
  assert.equal(placed.ok, true, placed.error);
  assert.deepEqual(fs.readdirSync(placed.dir), ['.git'], 'the placement holds no file of the repository');
  assert.deepEqual(orca.names(), ['create'], 'Orca created it');
  assert.equal(orca.calls[0][1].setup, 'skip');
  assert.match(placed.orcaId, /::/);
  const listed = git('worktree', 'list', '--porcelain').split(/\r?\n\r?\n/).find((b) => b.includes('draw-critic-'));
  assert.ok(listed && path.resolve(listed.split(/\r?\n/)[0].slice('worktree '.length)) === path.resolve(placed.dir), 'a git worktree of the repository Orca resolves');
  assert.equal(spawnSync('git', ['ls-tree', '-r', 'HEAD'], { cwd: placed.dir, encoding: 'utf8' }).stdout.trim(), '', 'its HEAD is the empty tree');
  const row = withMachine((m) => m.worktreeRow(placed.dir), { env });
  assert.deepEqual([row.kind, row.orca_id, row.job_id, row.workflow_id, row.removed_at], ['critic', placed.orcaId, 'job-draw-1', 'wf-critic-place', null], 'registered by its Orca id, owned by the op job (the worktree GC reclaims it after the op settles)');
  const removed = removeCriticWorkspace({ dir: placed.dir, repoRoot: placed.repoRoot, orcaId: placed.orcaId, branch: placed.branch, env, orca });
  assert.equal(removed.ok, true, removed.reason);
  assert.deepEqual(orca.calls.at(-1), ['remove', { worktree: `id:${placed.orcaId}`, force: true }], 'Orca removed it');
  assert.equal(fs.existsSync(placed.dir), false);
  assert.doesNotMatch(git('worktree', 'list', '--porcelain'), /draw-critic-/);
  assert.equal(spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${placed.branch}`], { cwd: repo }).status, 1, 'its branch is gone too');
  assert.notEqual(withMachine((m) => m.worktreeRow(placed.dir), { env }).removed_at, null);
  const nowhere = criticWorkspace({ repoRoot: null, context: null, env, orca });
  assert.equal(nowhere.ok, false, 'no repository, no placement - the critic is launch-failed, never placed in a bare directory');
});

test('a critic with no placement is launch-failed and starts no worker', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 8) });
  orca.criticWorkspace = () => ({ ok: false, error: 'no git repository at /x to place the critic worktree in' });
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: picked, orca, ...clock() });
  assert.deepEqual([critique.outcome, critique.verdict], ['launch-failed', null]);
  assert.match(critique.error, /no placement: no git repository/);
  assert.equal(orca.names().includes('worker-start'), false);
});
