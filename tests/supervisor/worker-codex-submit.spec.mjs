import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { createJob, jobOf, leaseConflicts, spawnWorkers } from '../../scripts/supervisor/workers.mjs';
import { sendEnterWithProof } from '../../scripts/kernel/wake-delivery.mjs';

const staged = 'OpenAI Codex\n› [Pasted Content 11099 chars]\n  gpt-6.1-sol';
const active = '• Working (1s • esc to interrupt)\n› Ask Codex to do anything';
const settings = { workers: { base: 1, max: 1 } };
function world(t, { stuck = false, terminal = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-submit-'));
  const env = { STARCI_LOCAL_ROOT: dir, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const m = openMachine({ env });
  t.after(() => { m.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const job = createJob(m, { cluster: 'codex-submit', files: ['scripts/submit.mjs'] }).job;
  const state = { screen: staged, connected: true, starts: 0, sends: [], shows: [], binds: [] };
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async () => ({ pool: 'codex-agent', agent: 'codex', model: 'gpt-6.1-sol' }),
    staging: () => ({ ok: true, path: dir, branch: 'fixture', base: 'abc', orcaId: 'fixture' }),
    guard: () => ({ receipt: { jobFile: 'guard.json' } }),
    bindGuard: args => { state.binds.push(args); return 'bound'; },
    start: ({ prompt }) => { state.prompt = prompt; state.starts += 1; return { ok: false, step: 'worker-start', effectState: 'unknown',
      dispatchId: 'ctx_submit', terminal, details: { reason: 'turn_start_unobserved', outcome: 'outcome_unknown' } }; },
    workerShow: args => { state.shows.push(args); return { ok: true, state: 'ready', dispatch: { assigneeHandle: 'term_submit' },
      effective: { agent: 'codex', model: 'gpt-6.1-sol' } }; },
    show: () => ({ ok: true, connected: state.connected, writable: true, exitCause: 'process-exited' }),
    read: () => ({ ok: true, screen: state.screen }),
    send: args => { state.sends.push(args); if (!stuck) state.screen = active; return { ok: true }; },
    sleep: () => {},
  };
  return { m, env, job, state, deps, spawn: () => spawnWorkers(m, { env, settings, deps }) };
}

test('Codex launch submits the pasted prompt with one proven Enter and records its terminal', async t => {
  const fx = world(t);
  const result = await fx.spawn();
  assert.equal(result.launched.length, 1);
  assert.deepEqual(fx.state.sends, [{ terminal: 'term_submit', text: '', enter: true }]);
  assert.equal(jobOf(fx.m, fx.job.job_id).worker_id, 'term_submit');
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'running');
  assert.equal(fx.state.binds[0].handle, 'term_submit');
});

test('Enter receipt cannot prove submission while a pasted prompt stays on the screen', () => {
  let reads = 0;
  const proof = sendEnterWithProof({ terminal: 'term_submit', reads: 2, deps: {
    read: () => { reads += 1; return { ok: true, screen: staged }; }, send: () => ({ ok: true }), sleep: () => {},
  } });
  assert.equal(proof.ok, false);
  assert.ok(reads >= 2);
});

test('next spawn reconciles an unknown launch without duplicating the worker, even at the cap', async t => {
  const fx = world(t, { stuck: true });
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning');
  fx.deps.send = args => { fx.state.sends.push(args); fx.state.screen = active; return { ok: true }; };
  const result = await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'running');
  assert.equal(result.launched.length, 1);
  assert.equal(fx.state.starts, 1);
  assert.equal(fx.state.sends.length, 2);
  assert.ok(leaseConflicts(fx.m, ['scripts/submit.mjs'], 'other').length);
});

test('next spawn records an already submitted worker without pressing Enter again', async t => {
  const fx = world(t, { stuck: true });
  await fx.spawn(); fx.state.screen = active;
  const sends = fx.state.sends.length;
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'running');
  assert.equal(jobOf(fx.m, fx.job.job_id).worker_id, 'term_submit');
  assert.equal(fx.state.sends.length, sends);
  assert.equal(fx.state.starts, 1);
});

test('next spawn fails a dead unknown worker and releases its leases with the reason', async t => {
  const fx = world(t, { stuck: true });
  await fx.spawn(); fx.state.connected = false;
  const sends = fx.state.sends.length;
  await fx.spawn();
  const job = jobOf(fx.m, fx.job.job_id);
  assert.equal(job.status, 'failed');
  assert.equal(job.result.reason, 'process-exited');
  assert.equal(job.worker_id, 'term_submit');
  assert.equal(leaseConflicts(fx.m, ['scripts/submit.mjs'], 'other').length, 0);
  assert.equal(fx.state.sends.length, sends);
});

test('host outage and unreadable frames retain uncertain effects and never send blindly', async t => {
  const fx = world(t);
  fx.deps.workerShow = () => ({ ok: false, hostUnavailable: true });
  await fx.spawn(); await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning');
  assert.equal(fx.state.sends.length, 0);
  fx.deps.workerShow = () => ({ ok: true, dispatch: { assigneeHandle: 'term_submit' }, effective: { agent: 'codex', model: 'gpt-6.1-sol' } });
  fx.deps.read = () => ({ ok: false });
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning');
  assert.equal(fx.state.starts, 1);
  assert.equal(fx.state.sends.length, 0);
});

test('a completed turn with its prompt in the transcript reconciles without another Enter', async t => {
  const fx = world(t, { stuck: true });
  await fx.spawn();
  fx.state.screen = `${fx.state.prompt}\n• Finished the assigned work.\n› Ask Codex to do anything`;
  const sends = fx.state.sends.length;
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'running');
  assert.equal(fx.state.sends.length, sends);
});

test('dry-run and a mismatched effective launch cannot submit an uncertain worker', async t => {
  const fx = world(t, { stuck: true });
  await fx.spawn();
  const sends = fx.state.sends.length, shows = fx.state.shows.length;
  await spawnWorkers(fx.m, { env: fx.env, settings, deps: fx.deps, dryRun: true });
  assert.equal(fx.state.shows.length, shows);
  fx.deps.workerShow = () => ({ ok: true, dispatch: { assigneeHandle: 'term_submit' }, effective: { agent: 'codex', model: 'wrong' } });
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning');
  assert.equal(fx.state.sends.length, sends);
});

test('Enter proof refuses an unreadable first frame and a shell after the send', () => {
  let sends = 0, reads = 0;
  const deps = { read: () => ({ ok: false }), send: () => { sends += 1; return { ok: true }; }, sleep: () => {} };
  assert.equal(sendEnterWithProof({ terminal: 'term_submit', deps }).ok, false);
  assert.equal(sends, 0);
  deps.read = () => ({ ok: true, screen: reads++ === 0 ? staged : `PS ${os.tmpdir()}>` });
  assert.equal(sendEnterWithProof({ terminal: 'term_submit', deps }).ok, false);
  assert.equal(sends, 1);
});
