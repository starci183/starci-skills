import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_RUBRIC, VERDICT_FILE, criticFor, runCritic } from '../scripts/work/draw-critic.mjs';
import { allocationSettings } from '../engine/config.mjs';
import { agentCliSpawns } from '../scripts/checks/check-host-boundary.mjs';
import { fakeCriticOrca, passingVerdict } from './helpers/fake-critic-orca.mjs';

// The draw loop's independent critic is an Orca worker started through orchestration worker-start with the provider,
// model and effort of runtimes.yaml allocation.drawLoop.critic (modules/kernel/contract-changes/
// draw-critic-worker-start.yaml): it gets a Task spec naming its clean dir, the images and verdict.json, the runtime
// waits for its worker_done through the orchestration commands, reads the verdict, then stops and releases the worker.
// A timeout, a refusal or a missing verdict is a typed outcome with no verdict - never a pass. Every Orca call here goes
// to a fake client; nothing reaches a host.

const ROOT = path.resolve(import.meta.dirname, '..');
const settings = allocationSettings().drawLoop;

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
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 8), onStart: (a) => { seen = { dir: a.worktree, files: fs.readdirSync(a.worktree).sort() }; } });
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: criticFor(settings, 'devin').critic, orca, tmpRoot: r.dir, entry: 'term_op', ...clock() });
  assert.equal(critique.outcome, 'judged', critique.error);
  assert.equal(critique.verdict.beauty, 8);
  assert.deepEqual(critique.verdict.failed, []);
  const start = startOf(orca);
  assert.deepEqual({ agent: start.agent, model: start.model, effort: start.effort },
    { agent: settings.critic.provider, model: settings.critic.model, effort: settings.critic.effort }, 'worker-start --agent --model --effort from allocation.drawLoop.critic');
  assert.equal(start.worktree, seen.dir, 'the worker is placed in the clean dir');
  assert.equal(start.from, 'term_op', 'the worker belongs to the Run of the terminal running the loop');
  assert.deepEqual(seen.files, ['render-1.png', 'rubric.yaml', 'screen.html'], 'the clean dir holds no drawing context');
  const spec = orca.calls.find((c) => c[0] === 'task-create')[1].spec;
  const at = (f) => path.join(seen.dir, f).replaceAll('\\', '/');
  for (const f of ['render-1.png', 'screen.html', 'rubric.yaml', VERDICT_FILE]) assert.ok(spec.includes(at(f)), `the Task spec names ${f}`);
  assert.match(spec, /the one file you may write is/, 'every other write is forbidden');
  assert.match(spec, /worker_done/);
  const names = orca.names();
  assert.ok(names.indexOf('inbox') > names.indexOf('worker-start'), 'the worker_done is awaited through the orchestration inbox');
  assert.deepEqual(names.slice(-3), ['worker-stop', 'worker-release', 'task-update'], 'the verdict is read, then the worker is released and its Task closed');
  assert.equal(orca.calls.find((c) => c[0] === 'worker-release')[1].dispatch, critique.critic.dispatchId);
  assert.deepEqual(critique.critic.cleanup, { stopped: true, released: true, taskClosed: true });
  assert.equal(critique.critic.launch, 'orchestration worker-start');
  assert.deepEqual(cleanDirsLeft(r.dir), [], 'the clean dir is removed');
});

test('a Codex drawer is judged by the Claude worker of criticWhenDrawer.codex', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: criticFor(settings, 'codex').critic, orca, tmpRoot: r.dir, ...clock() });
  assert.equal(critique.outcome, 'judged');
  assert.deepEqual([startOf(orca).agent, startOf(orca).model], ['claude', settings.criticWhenDrawer.codex.model]);
});

test('a critic with no worker_done within timeoutMs is a timeout: no verdict, the worker stopped and released', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ mode: 'silent' });
  const c = clock();
  const critique = await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: { ...settings.critic, timeoutMs: 60000 }, orca, tmpRoot: r.dir, pollMs: 5000, ...c });
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
    return { critique: await runCritic({ ...r, rubric: DEFAULT_RUBRIC, critic: settings.critic, orca, tmpRoot: r.dir, ...clock() }), orca };
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
  const none = await runCritic({ ...round(t), rubric: DEFAULT_RUBRIC, critic: { provider: 'codex', model: 'gpt-6-sol' }, orca: fakeCriticOrca() });
  assert.equal(none.outcome, 'not-configured', 'a critic without a timeout is not configured');
});

test('the critic runs no agent CLI as a child process', () => {
  const file = path.join(ROOT, 'scripts', 'work', 'draw-critic.mjs');
  const text = fs.readFileSync(file, 'utf8');
  assert.deepEqual(agentCliSpawns(text, file), []);
  assert.doesNotMatch(text, /from 'node:child_process'/, 'no child-process path is left');
  for (const c of [settings.critic, ...Object.values(settings.criticWhenDrawer ?? {})]) assert.equal(c.command, undefined, 'a critic is a provider, not a command');
});
